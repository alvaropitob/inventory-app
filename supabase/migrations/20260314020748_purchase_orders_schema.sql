-- Drop the type if it exists to make it idempotent
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('draft', 'requested', 'partially_received', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    created_by UUID NOT NULL REFERENCES public.users(id),
    status order_status DEFAULT 'draft' NOT NULL,
    expected_delivery_date DATE,
    notes TEXT,
    total_estimated_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.catalog_items(id),
    quantity_requested INTEGER NOT NULL CHECK (quantity_requested > 0),
    quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
    estimated_unit_price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(purchase_order_id, item_id)
);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for purchase_orders
CREATE POLICY "Users can view all purchase orders" ON purchase_orders FOR SELECT USING (true);
CREATE POLICY "Users can create purchase orders" ON purchase_orders FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update purchase orders" ON purchase_orders FOR UPDATE USING (true);
CREATE POLICY "Users can delete draft purchase orders" ON purchase_orders FOR DELETE USING (status = 'draft');

-- Policies for purchase_order_items
CREATE POLICY "Users can view all purchase order items" ON purchase_order_items FOR SELECT USING (true);
CREATE POLICY "Users can create purchase order items" ON purchase_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update purchase order items" ON purchase_order_items FOR UPDATE USING (true);
CREATE POLICY "Users can delete purchase order items" ON purchase_order_items FOR DELETE USING (true);

-- Triggers to update updated_at timestamp
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Add triggers for audit log (insert, update, delete)
CREATE TRIGGER audit_purchase_orders_insert
AFTER INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_purchase_orders_update
AFTER UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_purchase_orders_delete
BEFORE DELETE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_purchase_order_items_insert
AFTER INSERT ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_purchase_order_items_update
AFTER UPDATE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_purchase_order_items_delete
BEFORE DELETE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
