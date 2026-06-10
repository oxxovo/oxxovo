-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO apply_season_recommendations RPC 함수 (2026-05-29)
-- Apply Recommendation (1.5) 모델 — 본체 작업 6 atomic transaction.
--
-- 호출: admin이 /admin/applications에서 "추천 적용" 클릭
--   → app/admin/applications/actions.ts applyRecommendation server action
--   → createSupabaseAdmin().rpc('apply_season_recommendations', {p_season_id, p_admin_email})
--
-- 동작 (SQL 차원 transaction + FOR UPDATE 락):
--   1. season_recommendations WHERE status='recommended' FOR UPDATE 락
--   2. 추천 row 0건이면:
--      - 같은 season에 다른 status row 있음 → 'race_or_already_applied' raise
--      - 아예 없음 → 'no_recommendations' raise
--   3. 추천 application_ids 수집
--   4. genesis_applications WHERE id = ANY(top_ids) → status='selected'
--   5. genesis_applications WHERE 채점 완료 + integrity_flag=false
--      + NOT (id = ANY(top_ids)) → status='rejected'
--      ⚠️ integrity_flag=true는 손대지 않음 ([[project-system-error-not-user-rejection]],
--         [[project-message-policy]] 정신 — 의심은 운영진 검토, 자동 처리 X)
--   6. season_recommendations → status='applied', applied_at, applied_by
--   7. RETURN (selected_count, rejected_count)
--
-- 사업 본질 가정:
--   - 본선 진출 자동 선정 = AI 점수 자동 + admin 1회 클릭 (검토 + 트리거)
--     ([[project-scoring-integrity-rules]])
--   - integrity_flag 의심은 admin 수동 검토 (자동 매핑 금지)
--   - SECURITY DEFINER — service_role만 호출 (admin 인증은 server action에서)
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_season_recommendations(
  p_season_id TEXT,
  p_admin_email TEXT
) RETURNS TABLE(selected_count INT, rejected_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recommended_count INT;
  v_total_recommendations INT;
  v_top_ids UUID[];
  v_selected_rows INT;
  v_rejected_rows INT;
BEGIN
  -- 1. FOR UPDATE 락으로 추천 row 잠그기 + 상태 확인
  SELECT COUNT(*) INTO v_recommended_count
  FROM public.season_recommendations
  WHERE season_id = p_season_id AND status = 'recommended'
  FOR UPDATE;

  -- 2. 추천 0건이면 — race 또는 이미 applied인지 구분
  IF v_recommended_count = 0 THEN
    SELECT COUNT(*) INTO v_total_recommendations
    FROM public.season_recommendations
    WHERE season_id = p_season_id;

    IF v_total_recommendations > 0 THEN
      RAISE EXCEPTION 'race_or_already_applied';
    ELSE
      RAISE EXCEPTION 'no_recommendations';
    END IF;
  END IF;

  -- 3. 추천 application_ids 수집
  SELECT array_agg(application_id) INTO v_top_ids
  FROM public.season_recommendations
  WHERE season_id = p_season_id AND status = 'recommended';

  -- 4. Top N → 'selected'
  UPDATE public.genesis_applications
  SET status = 'selected'
  WHERE id = ANY(v_top_ids);
  GET DIAGNOSTICS v_selected_rows = ROW_COUNT;

  -- 5. 나머지 채점 완료 + integrity_flag=false → 'rejected'
  --    integrity_flag=true는 손대지 않음 (admin 수동 검토 흐름).
  UPDATE public.genesis_applications ga
  SET status = 'rejected'
  FROM public.scoring_results sr
  WHERE ga.id = sr.application_id
    AND sr.season_id = p_season_id
    AND sr.round = 'application'
    AND sr.judged_status = 'completed'
    AND sr.integrity_flag = FALSE
    AND NOT (ga.id = ANY(v_top_ids));
  GET DIAGNOSTICS v_rejected_rows = ROW_COUNT;

  -- 6. season_recommendations → status='applied'
  UPDATE public.season_recommendations
  SET status = 'applied',
      applied_at = now(),
      applied_by = p_admin_email,
      updated_at = now()
  WHERE season_id = p_season_id AND status = 'recommended';

  RETURN QUERY SELECT v_selected_rows, v_rejected_rows;
END;
$$;

-- service_role만 호출. server action(createSupabaseAdmin)이 호출.
GRANT EXECUTE ON FUNCTION public.apply_season_recommendations(TEXT, TEXT)
  TO service_role;

-- admin role / anon에는 EXECUTE 권한 부여 X (방어 차원).
REVOKE EXECUTE ON FUNCTION public.apply_season_recommendations(TEXT, TEXT)
  FROM PUBLIC;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 함수 정의 확인
SELECT proname, pronargs, prosecdef AS security_definer
FROM pg_proc
WHERE proname = 'apply_season_recommendations'
  AND pronamespace = 'public'::regnamespace;
-- 기대: proname='apply_season_recommendations', pronargs=2, security_definer=true

-- 2) 권한 확인 — service_role만
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'apply_season_recommendations';
-- 기대: grantee='service_role', privilege_type='EXECUTE' 1행만

-- 3) 함수 호출 dry run — 실제 적용 전에 빈 시즌으로 테스트
--    (시즌 0이 아직 추천 없는 상태라면 'no_recommendations' 예외 raise되어야 함)
DO $$
BEGIN
  BEGIN
    PERFORM public.apply_season_recommendations('season_0', 'test@oxxovo.com');
    RAISE NOTICE 'UNEXPECTED — function returned without exception';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE 'TEST OK — raised expected exception: %', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE 'OTHER EXCEPTION: % (%)', SQLERRM, SQLSTATE;
  END;
END $$;
-- 기대 NOTICE: "TEST OK — raised expected exception: no_recommendations"
-- (시즌 0에 추천 row가 이미 있다면 다른 결과 — 그 경우 실제 동작 확인)
