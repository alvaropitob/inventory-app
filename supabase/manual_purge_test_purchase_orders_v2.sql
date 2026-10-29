-- Limpieza física y conservadora de pedidos de prueba.
-- Ejecutar completo en Supabase SQL Editor con una cuenta propietaria (postgres).
-- Solo elimina pedidos sin cantidades recibidas ni filas hijas relacionadas.
-- No modifica movimientos ni lotes. Reporta el resultado mediante RAISE NOTICE.

BEGIN;

DO $purge$
DECLARE
  v_target text;
  v_order record;
  v_fk record;
  v_trigger record;
  v_has_received boolean;
  v_has_receptions boolean;
  v_has_reference boolean;
  v_delete_count integer;
  v_sql text;
  v_trigger_index integer;
  v_trigger_tables text[] := ARRAY[]::text[];
  v_trigger_names text[] := ARRAY[]::text[];
  v_trigger_states "char"[] := ARRAY[]::"char"[];
BEGIN
  FOREACH v_target IN ARRAY ARRAY[
    'PO-261027-4641',
    'PO-261026-2071',
    'PO-260315-4055'
  ]
  LOOP
    SELECT id, order_number, status
      INTO v_order
    FROM public.purchase_orders
    WHERE order_number = v_target
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE NOTICE '% | NO ENCONTRADO | No existe ese número de pedido.', v_target;
      CONTINUE;
    END IF;

    IF v_order.status NOT IN ('draft', 'requested', 'cancelled') THEN
      RAISE NOTICE '% | CONSERVADO | Estado %; solo se borran borradores, solicitados o cancelados sin recepción.',
        v_target, v_order.status;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.purchase_order_items
      WHERE purchase_order_id = v_order.id
        AND coalesce(quantity_received, 0) > 0
    ) INTO v_has_received;

    IF v_has_received THEN
      RAISE NOTICE '% | CONSERVADO | Tiene cantidades recibidas; no se modificó el pedido ni el inventario.', v_target;
      CONTINUE;
    END IF;

    -- Comprueba recepciones aunque la FK no esté declarada.
    IF to_regclass('public.technical_receptions') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'technical_receptions'
           AND column_name = 'order_id'
       ) THEN
      EXECUTE
        'SELECT EXISTS (
           SELECT 1 FROM public.technical_receptions WHERE order_id = $1
         )'
        INTO v_has_receptions
        USING v_order.id;

      IF v_has_receptions THEN
        RAISE NOTICE '% | CONSERVADO | Tiene una recepción técnica vinculada; no se modificó el inventario.', v_target;
        CONTINUE;
      END IF;
    END IF;

    v_has_reference := false;

    -- Revisa filas reales de las tablas públicas con FK hacia el pedido o sus líneas.
    -- Se permite únicamente purchase_order_items -> purchase_orders, cuya línea
    -- se elimina mediante ON DELETE CASCADE.
    FOR v_fk IN
      SELECT
        c.conrelid::regclass AS child_table,
        c.confrelid,
        string_agg(
          format('child.%I = parent.%I', child_col.attname, parent_col.attname),
          ' AND ' ORDER BY child_key.ordinality
        ) AS join_condition
      FROM pg_constraint c
      JOIN pg_class child_rel ON child_rel.oid = c.conrelid
      JOIN pg_namespace child_ns ON child_ns.oid = child_rel.relnamespace
      JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS child_key(attnum, ordinality) ON true
      JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS parent_key(attnum, ordinality)
        ON parent_key.ordinality = child_key.ordinality
      JOIN pg_attribute child_col
        ON child_col.attrelid = c.conrelid AND child_col.attnum = child_key.attnum
      JOIN pg_attribute parent_col
        ON parent_col.attrelid = c.confrelid AND parent_col.attnum = parent_key.attnum
      WHERE c.contype = 'f'
        AND child_ns.nspname = 'public'
        AND c.confrelid IN (
          'public.purchase_orders'::regclass,
          'public.purchase_order_items'::regclass
        )
        AND NOT (
          c.confrelid = 'public.purchase_orders'::regclass
          AND c.conrelid = 'public.purchase_order_items'::regclass
        )
      GROUP BY c.oid, c.conrelid, c.confrelid
    LOOP
      IF v_fk.confrelid = 'public.purchase_orders'::regclass THEN
        v_sql := format(
          'SELECT EXISTS (
             SELECT 1 FROM public.purchase_orders AS parent
             JOIN %s AS child ON %s
             WHERE parent.id = $1
           )',
          v_fk.child_table,
          v_fk.join_condition
        );
      ELSE
        v_sql := format(
          'SELECT EXISTS (
             SELECT 1 FROM public.purchase_order_items AS parent
             JOIN %s AS child ON %s
             WHERE parent.purchase_order_id = $1
           )',
          v_fk.child_table,
          v_fk.join_condition
        );
      END IF;

      EXECUTE v_sql INTO v_has_reference USING v_order.id;
      IF v_has_reference THEN
        EXIT;
      END IF;
    END LOOP;

    IF v_has_reference THEN
      RAISE NOTICE '% | CONSERVADO | Hay filas relacionadas por FK; no se modificó el pedido ni el inventario.', v_target;
      CONTINUE;
    END IF;

    -- Desactiva solo los triggers de DELETE que llaman fn_audit_log en pedidos
    -- y líneas. Conserva y restaura el modo previo de cada trigger.
    v_trigger_tables := ARRAY[]::text[];
    v_trigger_names := ARRAY[]::text[];
    v_trigger_states := ARRAY[]::"char"[];

    FOR v_trigger IN
      SELECT
        n.nspname || '.' || c.relname AS table_name,
        t.tgname AS trigger_name,
        t.tgenabled AS prior_state
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public'
        AND c.oid IN (
          'public.purchase_orders'::regclass,
          'public.purchase_order_items'::regclass
        )
        AND p.proname = 'fn_audit_log'
        AND (t.tgtype & 8) = 8
        AND NOT t.tgisinternal
        AND t.tgenabled <> 'D'
    LOOP
      v_trigger_tables := array_append(v_trigger_tables, v_trigger.table_name);
      v_trigger_names := array_append(v_trigger_names, v_trigger.trigger_name);
      v_trigger_states := array_append(v_trigger_states, v_trigger.prior_state);

      EXECUTE format(
        'ALTER TABLE %s DISABLE TRIGGER %I',
        v_trigger.table_name,
        v_trigger.trigger_name
      );
    END LOOP;

    DELETE FROM public.purchase_orders WHERE id = v_order.id;
    GET DIAGNOSTICS v_delete_count = ROW_COUNT;

    IF coalesce(array_length(v_trigger_names, 1), 0) > 0 THEN
      FOR v_trigger_index IN 1..array_length(v_trigger_names, 1)
      LOOP
        IF v_trigger_states[v_trigger_index] = 'A' THEN
          EXECUTE format(
            'ALTER TABLE %s ENABLE ALWAYS TRIGGER %I',
            v_trigger_tables[v_trigger_index], v_trigger_names[v_trigger_index]
          );
        ELSIF v_trigger_states[v_trigger_index] = 'R' THEN
          EXECUTE format(
            'ALTER TABLE %s ENABLE REPLICA TRIGGER %I',
            v_trigger_tables[v_trigger_index], v_trigger_names[v_trigger_index]
          );
        ELSE
          EXECUTE format(
            'ALTER TABLE %s ENABLE TRIGGER %I',
            v_trigger_tables[v_trigger_index], v_trigger_names[v_trigger_index]
          );
        END IF;
      END LOOP;
    END IF;

    IF v_delete_count = 1 THEN
      RAISE NOTICE '% | ELIMINADO | Pedido borrado y líneas eliminadas en cascada; sin auditoría de DELETE.', v_target;
    ELSE
      RAISE NOTICE '% | NO ELIMINADO | No se encontró al momento del borrado.', v_target;
    END IF;
  END LOOP;
END;
$purge$;

COMMIT;
