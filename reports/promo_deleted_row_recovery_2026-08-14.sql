-- Recovery for the accidental promo_videos delete (2026-08-14).
-- Deleted row identified by pairing analysis: A01_fashion_fusion (KR). Its
-- EN sibling survives
-- (id e78ac6ab-1987-4588-9fbf-cd008dee1785) and was used to reconstruct the
-- technical fields below. The R2 video file for the KR side was NEVER
-- touched -- deletePromoVideoAction only removes a Storage object when
-- video_url contains "/promo-videos/" (the Supabase bucket marker); these
-- 91 placeholder/content rows are R2 URLs (pub-bf4080d3cdcd....r2.dev), so
-- the delete action's storage-removal branch never ran for it. Confirmed
-- live 2026-08-14: HTTP 200, Content-Type video/mp4, Last-Modified
-- 2026-07-04 (unchanged since creation) on
-- https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_fusion_KR_9x16.mp4
--
-- What's EXACT (from the R2 file + the surviving EN sibling's row shape,
-- shared by 90 other untouched sibling rows): theme_note, video_url,
-- duration_seconds, aspect_ratio, resolution, actual_width/height, source,
-- status, cost_usd.
-- What's APPROXIMATED (not recoverable without a full PITR restore, which
-- this does not warrant): created_at (set to right after the EN sibling,
-- matching the pattern every other pair in this batch follows -- EN then KR
-- moments later) and caption/channels, assumed NULL to match the other 90
-- untouched sibling rows (the one row that has non-null caption/channels,
-- the EN sibling of THIS SAME pair, was the row TK was actively editing when
-- the accidental delete happened -- the KR side was not being edited).
-- approved/approved_by/approved_at/postiz_post_id/posted_channels/posted_at
-- all default to their never-touched state (false/null), matching every
-- sibling row -- this pair never got approved or published.

-- BLOCK 0 -- confirm current state before writing (read-only)
SELECT count(*) AS total_rows FROM public.promo_videos;
-- expect 92 (was 93 before the accidental delete)

SELECT id, theme_note FROM public.promo_videos
WHERE theme_note LIKE 'A%A01_fashion_fusion%';
-- expect exactly 1 row (EN only) -- confirms the KR side is still missing

-- BLOCK 1 -- reinsert the row (RETURNING so the editor shows the result)
INSERT INTO public.promo_videos (
  created_at, theme_note, duration_seconds, aspect_ratio, resolution,
  status, video_url, actual_width, actual_height, cost_usd, source
) VALUES (
  '2026-07-04T05:29:43.3Z',
  'A시즌주제 · A01_fashion_fusion (KR)',
  18, '9:16', '1080x1920', 'ready',
  'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/promo/content_video/content_A01_fashion_fusion_KR_9x16.mp4',
  1080, 1920, 0, 'uploaded'
)
RETURNING id, created_at, theme_note, video_url;

-- BLOCK 2 -- verify: back to 93, pair complete again
SELECT count(*) AS total_rows FROM public.promo_videos;
-- expect 93

SELECT id, theme_note, approved FROM public.promo_videos
WHERE theme_note LIKE 'A%A01_fashion_fusion%'
ORDER BY theme_note;
-- expect 2 rows (EN + KR), both approved=false
