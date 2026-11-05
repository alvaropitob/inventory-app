-- Reinicio controlado de datos operativos.
-- Conserva productos, proveedores, ubicaciones, secciones, equipos, usuarios,
-- roles, relaciones de acceso, rangos ambientales y otra configuración.
-- Ejecutar con el SQL Editor de Supabase usando una cuenta propietaria.
-- Primero se muestra una vista previa. Para borrar, cambiar v_apply a TRUE,
-- revisar las tablas/cantidades, pausar el uso de la aplicación y ejecutar de nuevo.
-- Recomendado: crear un backup/snapshot de Supabase antes de confirmar.

BEGIN;

DO $reset_operational_data$
DECLARE
  v_apply boolean := FALSE; -- Seguro por defecto: FALSE solo informa; TRUE ejecuta el TRUNCATE.
  v_name text;
  v_relation oid;
  v_root_list text;
  v_protected_list text;
  v_table record;
  v_count bigint;
BEGIN
  CREATE TEMP TABLE _operational_reset_roots (
    relation_oid oid PRIMARY KEY
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _operational_reset_targets (
    relation_oid oid PRIMARY KEY
  ) ON COMMIT DROP;

  -- Datos operativos de los módulos usados por la aplicación.
  FOREACH v_name IN ARRAY ARRAY[
    'inventory_batches',
    'stock_movements',
    'inventory_fractional_movements',
    'inventory_disposal_requests',
    'quality_verifications',
    'purchase_orders',
    'purchase_order_items',
    'technical_receptions',
    'environmental_readings',
    'audit_logs',
    'safety_incidents',
    'safety_alert_monthly_reports',
    'supplier_evaluations',
    'maintenance_records'
  ] LOOP
    v_relation := to_regclass(format('public.%I', v_name));
    IF v_relation IS NULL THEN
      RAISE EXCEPTION 'No existe public.%. No se borró ningún dato; verifica el esquema antes de continuar.', v_name;
    END IF;
    INSERT INTO _operational_reset_roots VALUES (v_relation)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Calcula la cascada real de tablas que referencian estas tablas por FK,
  -- incluidos descendientes indirectos y dependencias en otros esquemas.
  INSERT INTO _operational_reset_targets (relation_oid)
  WITH RECURSIVE dependent_relations(relation_oid) AS (
    SELECT relation_oid FROM _operational_reset_roots
    UNION
    SELECT constraints.conrelid
    FROM pg_constraint AS constraints
    JOIN dependent_relations AS parent
      ON constraints.confrelid = parent.relation_oid
    JOIN pg_class AS child_relation
      ON child_relation.oid = constraints.conrelid
    WHERE constraints.contype = 'f'
      AND child_relation.relkind IN ('r', 'p')
  )
  SELECT DISTINCT relation_oid FROM dependent_relations;

  -- La cascada nunca debe alcanzar tablas maestras ni de acceso.
  SELECT string_agg(format('%I.%I', namespaces.nspname, relations.relname), ', ' ORDER BY namespaces.nspname, relations.relname)
  INTO v_protected_list
  FROM _operational_reset_targets AS targets
  JOIN pg_class AS relations ON relations.oid = targets.relation_oid
  JOIN pg_namespace AS namespaces ON namespaces.oid = relations.relnamespace
  WHERE targets.relation_oid NOT IN (SELECT relation_oid FROM _operational_reset_roots)
    AND (
      relations.relname IN (
        'users', 'roles', 'user_roles', 'categories', 'sections',
        'suppliers', 'locations', 'catalog_items', 'equipments'
      )
    );

  IF v_protected_list IS NOT NULL THEN
    RAISE EXCEPTION 'La cascada alcanzaría datos de configuración protegidos: %. No se borró ningún dato.', v_protected_list;
  END IF;

  RAISE NOTICE 'VISTA PREVIA — tablas que serían vaciadas:';
  RAISE NOTICE 'Los equipos se conservan; al confirmar se restablecerá su estado a active y se limpiarán sus fechas de mantenimiento/calibración.';
  FOR v_table IN
    SELECT targets.relation_oid,
           namespaces.nspname AS schema_name,
           relations.relname AS table_name
    FROM _operational_reset_targets AS targets
    JOIN pg_class AS relations ON relations.oid = targets.relation_oid
    JOIN pg_namespace AS namespaces ON namespaces.oid = relations.relnamespace
    ORDER BY namespaces.nspname, relations.relname
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', v_table.relation_oid::regclass)
      INTO v_count;
    RAISE NOTICE '%.% | % filas', v_table.schema_name, v_table.table_name, v_count;
  END LOOP;

  IF NOT v_apply THEN
    RAISE NOTICE 'MODO VISTA PREVIA: no se borró ningún dato. Cambia v_apply a TRUE solo después de revisar el listado.';
    RETURN;
  END IF;

  SELECT string_agg(relation_oid::regclass::text, ', ' ORDER BY relation_oid::regclass::text)
  INTO v_root_list
  FROM _operational_reset_roots;

  IF v_root_list IS NULL THEN
    RAISE EXCEPTION 'No se encontraron tablas raíz; operación cancelada.';
  END IF;

  -- Los equipos permanecen como configuración; se limpian estados/fechas que
  -- dependen del historial de mantenimiento. Se hace antes del TRUNCATE para
  -- que cualquier evento de auditoría generado por este UPDATE también se limpie.
  IF to_regclass('public.equipments') IS NOT NULL THEN
    UPDATE public.equipments
    SET status = 'active',
        last_preventive_maintenance = NULL,
        next_preventive_maintenance = NULL,
        last_calibration = NULL,
        next_calibration = NULL;
  END IF;

  EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', v_root_list);

  RAISE NOTICE 'REINICIO COMPLETADO: se borraron los datos operativos de prueba y sus dependencias; se conservaron maestros, equipos, usuarios, roles y configuración.';
END;
$reset_operational_data$;

COMMIT;
