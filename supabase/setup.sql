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
