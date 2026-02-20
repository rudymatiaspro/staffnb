
-- ─── Table restaurants ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text NOT NULL UNIQUE,  -- code unique généré ex: CAS42
  address         text,
  city            text,
  country         text DEFAULT 'France',
  phone           text,
  email           text,
  logo_url        text,
  timezone        text DEFAULT 'Europe/Paris',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Link profiles to restaurants ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL;

-- ─── Link user_roles to restaurants (for Master multi-restaurant) ─────────────
CREATE TABLE IF NOT EXISTS public.restaurant_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            text NOT NULL DEFAULT 'staff',  -- owner, manager, chef, staff
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

-- ─── RLS on restaurants ───────────────────────────────────────────────────────
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- God/Admin: full access
CREATE POLICY "God/admin can manage restaurants"
  ON public.restaurants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('god', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('god', 'admin')));

-- Authenticated: read active restaurants they belong to
CREATE POLICY "Authenticated can view their restaurant"
  ON public.restaurants FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- God/admin see all
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('god', 'admin'))
      -- Members see their own restaurant
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND restaurant_id = restaurants.id)
      -- Restaurant members
      OR EXISTS (SELECT 1 FROM public.restaurant_members WHERE user_id = auth.uid() AND restaurant_id = restaurants.id)
    )
  );

-- ─── RLS on restaurant_members ────────────────────────────────────────────────
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "God/admin can manage restaurant_members"
  ON public.restaurant_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('god', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('god', 'admin')));

CREATE POLICY "Owner can manage their restaurant members"
  ON public.restaurant_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.user_id = auth.uid() AND rm.restaurant_id = restaurant_members.restaurant_id AND rm.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      WHERE rm.user_id = auth.uid() AND rm.restaurant_id = restaurant_members.restaurant_id AND rm.role = 'owner'
    )
  );

CREATE POLICY "Members can view their restaurant members"
  ON public.restaurant_members FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('god', 'admin'))
      OR EXISTS (SELECT 1 FROM public.restaurant_members rm WHERE rm.user_id = auth.uid() AND rm.restaurant_id = restaurant_members.restaurant_id)
    )
  );

-- ─── Trigger updated_at on restaurants ───────────────────────────────────────
CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
