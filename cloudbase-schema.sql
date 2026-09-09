CREATE TABLE IF NOT EXISTS public.real_leveling_saves (
  user_id varchar(64) NOT NULL DEFAULT auth.uid(),
  mode varchar(10) NOT NULL DEFAULT 'demo',
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mode),
  CONSTRAINT real_leveling_mode_check CHECK (mode IN ('demo', 'real'))
);

ALTER TABLE public.real_leveling_saves ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.real_leveling_saves TO anon, authenticated;

DROP POLICY IF EXISTS real_leveling_select_own ON public.real_leveling_saves;
CREATE POLICY real_leveling_select_own ON public.real_leveling_saves
  FOR SELECT TO anon, authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS real_leveling_insert_own ON public.real_leveling_saves;
CREATE POLICY real_leveling_insert_own ON public.real_leveling_saves
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS real_leveling_update_own ON public.real_leveling_saves;
CREATE POLICY real_leveling_update_own ON public.real_leveling_saves
  FOR UPDATE TO anon, authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS real_leveling_saves_user_id_idx
  ON public.real_leveling_saves (user_id);
