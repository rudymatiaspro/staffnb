
-- Add missing columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_note_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- Create delivery_reports table
CREATE TABLE IF NOT EXISTS public.delivery_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  global_status TEXT CHECK (global_status IN ('conforme', 'incomplete')),
  items_ok INT DEFAULT 0,
  items_partial INT DEFAULT 0,
  items_missing INT DEFAULT 0,
  note TEXT,
  validated_by UUID REFERENCES public.profiles(id),
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_photo_url TEXT,
  bon_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delivery_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager/owner can manage delivery reports"
  ON public.delivery_reports FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

CREATE POLICY "Authenticated can view delivery reports"
  ON public.delivery_reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add supplier_ref column to products for deduplication
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_ref TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Create delivery-proofs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload delivery proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Delivery proofs are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-proofs');
