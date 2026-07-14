-- ============================================================
--  PARH BHI LO! — Database setup (run this in Supabase SQL Editor)
-- ============================================================
-- 1) Soft-ban support: lets admins disable a member without
--    deleting their account or their data.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2) Seed "domain" topic tags (idempotent — safe to re-run).
--    New tags are appended after the current highest sort_order.
-- ============================================================
INSERT INTO public.topic_tags (name, color, sort_order, archived)
SELECT
  v.name,
  v.color,
  (ROW_NUMBER() OVER ())::int + COALESCE((SELECT MAX(sort_order) FROM public.topic_tags), 0),
  false
FROM (VALUES
  ('Tech',             '#3B82F6'),
  ('AI & ML',          '#8B5CF6'),
  ('Programming',      '#0891B2'),
  ('Science',          '#10B981'),
  ('Space',            '#6366F1'),
  ('Health',           '#EC4899'),
  ('Psychology',       '#E11D48'),
  ('Politics',         '#EF4444'),
  ('Economy',          '#F59E0B'),
  ('Business',         '#0EA5E9'),
  ('Startups',         '#7C3AED'),
  ('Cryptocurrency',   '#F97316'),
  ('World',            '#0D9488'),
  ('Environment',      '#16A34A'),
  ('Sports',           '#22C55E'),
  ('History',          '#B45309'),
  ('Culture',          '#DB2777'),
  ('Design',           '#D946EF'),
  ('Philosophy',       '#64748B'),
  ('Education',        '#14B8A6')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.topic_tags t WHERE t.name = v.name
);

-- ============================================================
-- 3) Leaderboard view (safe to re-run).
--    SECURITY DEFINER so it bypasses RLS and shows everyone's
--    totals on the leaderboard.
-- ============================================================
DROP VIEW IF EXISTS public.user_stats_view;

CREATE VIEW public.user_stats_view WITH (security_definer = true) AS
SELECT
  p.id                                                    AS user_id,
  p.display_name,
  p.role,
  COALESCE(SUM(CASE WHEN ai.is_read THEN ai.points_earned ELSE 0 END), 0)
    + COALESCE(SUM(vn.points_earned), 0)                  AS total_points,
  COUNT(ai.id) FILTER (WHERE ai.is_read)                 AS total_articles_read,
  COUNT(vn.id)                                            AS total_voice_notes,
  COUNT(ai.id) FILTER (WHERE NOT ai.is_read)              AS total_missed
FROM public.profiles p
LEFT JOIN public.article_interactions ai ON ai.user_id = p.id
LEFT JOIN public.voice_notes vn           ON vn.user_id = p.id
GROUP BY p.id, p.display_name, p.role;

GRANT SELECT ON public.user_stats_view TO authenticated, anon;

-- ============================================================
-- 4) Realtime: chat_messages must emit change events, otherwise
--    new DMs only appear after a page reload. This adds the table
--    to the supabase_realtime publication (idempotent).
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
END $$;
