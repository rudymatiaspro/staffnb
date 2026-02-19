
-- Create storage buckets for task-proofs and avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('task-proofs', 'task-proofs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for task-proofs
CREATE POLICY "Authenticated can upload task proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-proofs');
CREATE POLICY "Task proofs are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'task-proofs');

-- Storage policies for avatars
CREATE POLICY "Authenticated can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Avatars are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- Add priority and photo_proof_url to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS photo_proof_url TEXT;

-- Add extra fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Add photo_url to incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS title TEXT;
