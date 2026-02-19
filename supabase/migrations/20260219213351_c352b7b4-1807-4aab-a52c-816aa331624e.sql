
-- Add message type column to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS msg_type TEXT NOT NULL DEFAULT 'user'
  CHECK (msg_type IN ('user', 'system', 'incident', 'annonce'));

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(msg_type);
CREATE INDEX IF NOT EXISTS idx_messages_channel_type ON public.messages(channel, msg_type);
