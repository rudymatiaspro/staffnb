
-- ══════════════════════════════════════════════════════════════════
-- Étape 2 : Tables et fonctions (après commit des enum values)
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- TABLE: messages
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel     TEXT NOT NULL,
  content     TEXT NOT NULL,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT '',
  sender_team TEXT NOT NULL DEFAULT '',
  mentions    TEXT[] DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view messages"
  ON public.messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Author or manager can delete messages"
  ON public.messages FOR DELETE
  USING (sender_id = auth.uid() OR is_manager_or_owner());

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ──────────────────────────────────────────────────────────────────
-- TABLE: malus_contests
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.malus_contests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_event_id  UUID REFERENCES public.score_events(id) ON DELETE CASCADE,
  contestant_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contestant_name TEXT NOT NULL DEFAULT '',
  reason          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  arbiter_id      UUID REFERENCES public.profiles(id),
  arbiter_name    TEXT,
  arbiter_note    TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.malus_contests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff see own contests; managers see all"
  ON public.malus_contests FOR SELECT
  USING (contestant_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Staff can create own contest"
  ON public.malus_contests FOR INSERT
  WITH CHECK (contestant_id = auth.uid());

CREATE POLICY "Manager can resolve contests"
  ON public.malus_contests FOR UPDATE
  USING (is_manager_or_owner());

ALTER PUBLICATION supabase_realtime ADD TABLE public.malus_contests;

-- ──────────────────────────────────────────────────────────────────
-- TABLE: shift_swap_requests
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_name   TEXT NOT NULL DEFAULT '',
  target_user_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_name TEXT DEFAULT '',
  shift_id         UUID REFERENCES public.planning_shifts(id) ON DELETE CASCADE,
  target_shift_id  UUID REFERENCES public.planning_shifts(id) ON DELETE SET NULL,
  note             TEXT DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_by      UUID REFERENCES public.profiles(id),
  reviewed_by_name TEXT,
  rejection_reason TEXT,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff see own swaps; managers see all"
  ON public.shift_swap_requests FOR SELECT
  USING (requester_id = auth.uid() OR target_user_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Staff can create swap requests"
  ON public.shift_swap_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Manager can update swap requests"
  ON public.shift_swap_requests FOR UPDATE
  USING (is_manager_or_owner());

ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_swap_requests;

-- ──────────────────────────────────────────────────────────────────
-- TABLE: notifications
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  read        BOOLEAN NOT NULL DEFAULT false,
  ref_id      UUID,
  ref_type    TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can mark own as read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ──────────────────────────────────────────────────────────────────
-- INDEX pour performance
-- ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_malus_contests_contestant ON public.malus_contests(contestant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

-- ──────────────────────────────────────────────────────────────────
-- Mise à jour des fonctions RLS pour inclure admin et chef
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'admin', 'chef')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS user_role
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;
