
-- Cake references (the product catalog for pastry tracking)
CREATE TABLE public.cake_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('patisserie', 'desserts', 'pains')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  restaurant_id UUID REFERENCES public.restaurants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production logs (each batch out of the oven)
CREATE TABLE public.cake_production_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id UUID NOT NULL REFERENCES public.cake_references(id) ON DELETE CASCADE,
  reference_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'patisserie',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  logged_by UUID REFERENCES public.profiles(id),
  logged_by_name TEXT NOT NULL DEFAULT '',
  restaurant_id UUID REFERENCES public.restaurants(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cake_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cake_production_logs ENABLE ROW LEVEL SECURITY;

-- cake_references policies
CREATE POLICY "All authenticated can view cake references"
  ON public.cake_references FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can manage cake references"
  ON public.cake_references FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- cake_production_logs policies
CREATE POLICY "All authenticated can view production logs"
  ON public.cake_production_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert production logs"
  ON public.cake_production_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can manage production logs"
  ON public.cake_production_logs FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Trigger for updated_at
CREATE TRIGGER set_cake_references_updated_at
  BEFORE UPDATE ON public.cake_references
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default references
INSERT INTO public.cake_references (name, category, display_order) VALUES
  ('Pastéis de Nata', 'patisserie', 1),
  ('Pão de Deus', 'patisserie', 2),
  ('Folhado Misto', 'patisserie', 3),
  ('Palmito Classic', 'patisserie', 4),
  ('Palmito Red', 'patisserie', 5),
  ('Palmito Choco', 'patisserie', 6),
  ('Palmito Green', 'patisserie', 7),
  ('Broa Bread', 'pains', 1),
  ('CacoBurger Bread', 'pains', 2),
  ('Mafras', 'pains', 3),
  ('Mousse chocolate', 'desserts', 1),
  ('Pudim', 'desserts', 2),
  ('Baba Camelo', 'desserts', 3),
  ('Laranjeira', 'desserts', 4),
  ('Arroz doce', 'desserts', 5);
