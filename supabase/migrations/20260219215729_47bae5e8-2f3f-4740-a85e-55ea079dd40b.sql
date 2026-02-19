
-- ─── Stock tables ────────────────────────────────────────────────────────────

-- Table stock (current level per product)
CREATE TABLE IF NOT EXISTS public.stock (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id       UUID REFERENCES public.products(id) ON DELETE CASCADE UNIQUE NOT NULL,
  current_quantity NUMERIC DEFAULT 0 NOT NULL,
  unit             TEXT,
  alert_threshold  NUMERIC DEFAULT 0,
  max_threshold    NUMERIC,
  last_updated     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view stock"
  ON public.stock FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can manage stock"
  ON public.stock FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Table stock_entries (movement journal)
CREATE TABLE IF NOT EXISTS public.stock_entries (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id          UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity            NUMERIC NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('delivery','manual_adjustment','inventory_correction','loss','internal_use')),
  reason              TEXT,
  note                TEXT,
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  inventory_session_id UUID,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view stock entries"
  ON public.stock_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can insert stock entries"
  ON public.stock_entries FOR INSERT
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "Owner can delete stock entries"
  ON public.stock_entries FOR DELETE
  USING (is_owner());

-- Table inventory_sessions
CREATE TABLE IF NOT EXISTS public.inventory_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  status       TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','validated','cancelled')),
  report_url   TEXT
);
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager/owner can manage inventory sessions"
  ON public.inventory_sessions FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "All authenticated can view inventory sessions"
  ON public.inventory_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table inventory_items (detail per session)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          UUID REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  product_id          UUID REFERENCES public.products(id) ON DELETE CASCADE,
  theoretical_quantity NUMERIC,
  counted_quantity    NUMERIC,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager/owner can manage inventory items"
  ON public.inventory_items FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "All authenticated can view inventory items"
  ON public.inventory_items FOR SELECT
  USING (auth.uid() IS NOT NULL);
