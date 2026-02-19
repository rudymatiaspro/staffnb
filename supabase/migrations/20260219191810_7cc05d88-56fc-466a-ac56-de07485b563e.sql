
-- ── Création de daily_menu_items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_menu_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('Entrée', 'Plat', 'Dessert')),
  status         TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'out_of_stock', 'limited')),
  portions_left  INTEGER,
  display_order  INTEGER NOT NULL DEFAULT 0,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.daily_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view menu" ON public.daily_menu_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manager/owner can manage menu" ON public.daily_menu_items
  FOR ALL USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_menu_items;

-- ── Seed menu pré-rempli pour aujourd'hui (Entrées) ──────────────────────────
INSERT INTO public.daily_menu_items (date, name, category, status, display_order) VALUES
  (CURRENT_DATE, 'Soupe du jour',          'Entrée', 'available', 1),
  (CURRENT_DATE, 'Salade maison',          'Entrée', 'available', 2),
  (CURRENT_DATE, 'Foie gras',              'Entrée', 'available', 3),
  (CURRENT_DATE, 'Saumon grillé',          'Plat',   'available', 4),
  (CURRENT_DATE, 'Magret de canard',       'Plat',   'available', 5),
  (CURRENT_DATE, 'Risotto aux champignons','Plat',   'available', 6),
  (CURRENT_DATE, 'Entrecôte',              'Plat',   'available', 7),
  (CURRENT_DATE, 'Tarte du jour',          'Dessert','available', 8),
  (CURRENT_DATE, 'Fondant chocolat',       'Dessert','available', 9),
  (CURRENT_DATE, 'Crème brûlée',           'Dessert','available', 10)
ON CONFLICT DO NOTHING;

-- ── Trigger: alertes portions automatiques ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_menu_portions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_portions INT;
  v_new_portions INT;
  v_target_team  TEXT;
  v_title        TEXT;
  v_body         TEXT;
  v_profile      RECORD;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_old_portions := OLD.portions_left;
  v_new_portions := NEW.portions_left;

  IF v_new_portions IS NOT DISTINCT FROM v_old_portions THEN
    RETURN NEW;
  END IF;

  -- 6 portions → alerter KITCHEN
  IF v_new_portions = 6 AND (v_old_portions IS NULL OR v_old_portions > 6) THEN
    v_target_team := 'KITCHEN';
    v_title := '⚠️ Stock bas — ' || NEW.name;
    v_body  := NEW.name || ' — plus que 6 portions restantes. Prévenez le chef.';

    FOR v_profile IN SELECT id FROM public.profiles WHERE team::TEXT = v_target_team LOOP
      INSERT INTO public.notifications (user_id, type, title, body, ref_type, ref_id)
      VALUES (v_profile.id, 'menu_alert', v_title, v_body, 'daily_menu_item', NEW.id);
    END LOOP;
  END IF;

  -- 2 portions → alerter FLOOR (Salle)
  IF v_new_portions = 2 AND (v_old_portions IS NULL OR v_old_portions > 2) THEN
    v_target_team := 'FLOOR';
    v_title := '🚨 Quasi rupture — ' || NEW.name;
    v_body  := NEW.name || ' — plus que 2 portions. Informez les clients.';

    FOR v_profile IN SELECT id FROM public.profiles WHERE team::TEXT = v_target_team LOOP
      INSERT INTO public.notifications (user_id, type, title, body, ref_type, ref_id)
      VALUES (v_profile.id, 'menu_alert', v_title, v_body, 'daily_menu_item', NEW.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_portions_alert ON public.daily_menu_items;

CREATE TRIGGER trg_menu_portions_alert
  AFTER UPDATE OF portions_left ON public.daily_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_menu_portions();
