
-- ─── Unit type enum for orders ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_unit AS ENUM ('kg', 'g', 'L', 'cL', 'pcs', 'carton', 'caisse');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Order status enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('draft', 'pending', 'validated', 'received', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Orders table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number      TEXT        NOT NULL, -- [FOUR]AAAAMMJJ-XX
  supplier          TEXT        NOT NULL DEFAULT '',
  status            order_status NOT NULL DEFAULT 'draft',
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name   TEXT        NOT NULL DEFAULT '',
  validated_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_by_name TEXT,
  validated_at      TIMESTAMP WITH TIME ZONE,
  rejection_reason  TEXT,
  notes             TEXT,
  is_recurring      BOOLEAN     NOT NULL DEFAULT false,
  recurrence_freq   TEXT,        -- 'daily' | 'weekly' | 'monthly'
  next_occurrence   DATE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─── Order items table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID    NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id      UUID    REFERENCES public.products(id) ON DELETE SET NULL,
  product_name    TEXT    NOT NULL DEFAULT '',
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit            order_unit NOT NULL DEFAULT 'pcs',
  unit_price      NUMERIC,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─── Order receipts table (réception) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_receipts (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            UUID    NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  received_by         UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_by_name    TEXT    NOT NULL DEFAULT '',
  received_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gap_note            TEXT,   -- obligatoire si écart
  has_gap             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─── Receipt items (quantités réellement reçues) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_receipt_items (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id      UUID    NOT NULL REFERENCES public.order_receipts(id) ON DELETE CASCADE,
  order_item_id   UUID    NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id      UUID    REFERENCES public.products(id) ON DELETE SET NULL,
  product_name    TEXT    NOT NULL DEFAULT '',
  ordered_qty     NUMERIC NOT NULL DEFAULT 0,
  received_qty    NUMERIC NOT NULL DEFAULT 0,
  unit            order_unit NOT NULL DEFAULT 'pcs',
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_receipts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_receipt_items ENABLE ROW LEVEL SECURITY;

-- ─── orders policies ──────────────────────────────────────────────────────────
CREATE POLICY "Authenticated can view orders"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can update orders"
  ON public.orders FOR UPDATE
  USING (is_manager_or_owner() OR created_by = auth.uid());

CREATE POLICY "Owner can delete orders"
  ON public.orders FOR DELETE
  USING (is_owner());

-- ─── order_items policies ─────────────────────────────────────────────────────
CREATE POLICY "Authenticated can view order items"
  ON public.order_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/creator can update order items"
  ON public.order_items FOR UPDATE
  USING (is_manager_or_owner());

CREATE POLICY "Owner can delete order items"
  ON public.order_items FOR DELETE
  USING (is_manager_or_owner());

-- ─── order_receipts policies ──────────────────────────────────────────────────
CREATE POLICY "Authenticated can view receipts"
  ON public.order_receipts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create receipts"
  ON public.order_receipts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can update receipts"
  ON public.order_receipts FOR UPDATE
  USING (is_manager_or_owner());

-- ─── order_receipt_items policies ────────────────────────────────────────────
CREATE POLICY "Authenticated can view receipt items"
  ON public.order_receipt_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create receipt items"
  ON public.order_receipt_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can update receipt items"
  ON public.order_receipt_items FOR UPDATE
  USING (is_manager_or_owner());

-- ─── Realtime ────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_receipts;
