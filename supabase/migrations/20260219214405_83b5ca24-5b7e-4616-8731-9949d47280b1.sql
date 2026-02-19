
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS recurrence_days TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_times TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS photo_proofs_required INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_proofs_titles TEXT[] DEFAULT '{}';
