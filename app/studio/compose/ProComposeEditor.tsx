'use client'

// PRO compose editor -- the real, launch participant editor (replaces the old
// ComposeEditor UI). DaVinci-style 3-pane (media pool | preview | single-track
// timeline) + Descript-style beginner card ordering, wired to the REAL backend:
// loadComposeState clips -> EDL {jobId,startMs,endMs} -> createRender -> submit
// (moderation + CryptoBind). Backend is reused unchanged; this file is the UX.
//
// Genesis Rule: ONE video lane, order / trim / cut ONLY. No transitions, effects,
// overlays, or track layers -- a hard cut by design. Tone matches /studio.
//
// Build phases (this file grows through them):
//   P1 core wiring (real pool + timeline + EDL + render)      -- THIS commit
//   P2 frame-accurate scrub + seamless chaining preview       -- next
//   P3 submit flow (moderation + crypto + applicant + resume) -- included (reused)
//   P4 Descript card mode + waveform + shortcuts + snap        -- next
//   P5 draft tier filter + replace old editor + regression     -- next
//   P6 real thumbnails (thumbnail_url) instead of <video> frame -- next

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  SourceClip,
  ComposeApplicant,
  ComposeSubmitCtx,
  ComposeSubmission,
  ComposeResumeRender,
  EditorRenderStatus,
  ComposeEditorProps,
} from './ComposeEditor'
import { isSubmittableRenderStatus } from '@/lib/studio-shared'
import { createRawPreview, type PreviewEngine, type PreviewTransition } from './preview'
import { createGLPreview } from './preview-gl'
import { hasAnyEffect, EXPOSED_SLIDERS, LUT_OPTIONS, EXPOSED_TRANSITIONS, type EffectParams } from '@/lib/effects'
import { valueAt, type KeyframeTrack } from '@/lib/edl-keyframes'
import { FONT_SPECS, type TextLayer } from '@/lib/text-render'
import { TEXT_LIMITS, TEXT_CANVAS, validateTexts, type TextReason } from '@/lib/text-limits'
import { TextOverlay } from './TextOverlay'
import { TextTrack } from './TextTrack'
import { TextFitReadout } from './TextFit'
import { maxFittingSizePct } from '@/lib/text-metrics'
import { createMusicPreview, type MusicPreview, type MusicBed } from './music-preview'
import {
  MIN_SPLIT_MS,
  splitPointFromPlayhead,
  splitSegmentAt,
  type SplitReason,
} from '@/lib/edl-split'
import {
  availableFacets,
  filterMusicAssets,
  genreLabel,
  moodLabel,
  musicPickerLine,
  presentGenreKeys,
  presentMoodKeys,
  presentTempoKeys,
  tempoLabel,
  type MusicFilterSelection,
} from '@/lib/music-grid-labels'

// effects/speed are populated by the effect UI (E); undefined in C (no effect UI
// yet), which keeps the composition effect-free -> the raw preview stays accurate.
type Segment = {
  uid: string; jobId: string; startMs: number; endMs: number; speed?: number; effects?: EffectParams; fit?: 'contain' | 'cover'
  // ★D keyframes (2026-08-10). Segment-relative atMs (0 == this segment's own
  // startMs). Only exposure/contrast/saturation/vignette are keyframe-able
  // (decision ①(a), 2026-08-10 -- position/scale explicitly out of scope).
  keyframes?: Partial<Record<keyof EffectParams, KeyframeTrack>>
}
// Effect keys the keyframe toggle applies to -- must match render.ts's
// effectVideoFilters() kfOf() gate (only eq's 3 + vignette support ffmpeg's
// eval=frame; the others are typed <int>/<float>, no per-frame expression).
const KEYFRAME_KEYS: readonly (keyof EffectParams)[] = ['exposure', 'contrast', 'saturation', 'vignette']
type Aspect = '16:9' | '9:16'

let uidSeq = 0
const nextUid = () => `pseg_${++uidSeq}`
const fmt = (ms: number) => (ms / 1000).toFixed(1)

const DICT = {
  ko: {
    shell: 'PRO 편집기',
    back: '← Studio',
    pool: '미디어 풀',
    search: '클립 검색…',
    add: '추가',
    no_clips: '이번 라운드에 생성한 ready 클립이 없습니다. 먼저 Studio에서 클립을 생성하세요.',
    preview: '미리보기',
    total: '총 길이',
    empty_prev: '타임라인에 클립을 추가하세요',
    play: '재생',
    stop: '정지',
    timeline: '타임라인',
    single_track: '단일 트랙 · 순서 · 트림 · 컷만 (합성·오버레이 없음)',
    tl_hint: '풀에서 클립을 추가하고, 드래그로 순서를 바꾸고, 양끝을 끌어 트림하세요 — Genesis Rule.',
    drag_here: '풀에서 클립을 추가하세요',
    clip: '클립',
    sec: '초',
    remove: '제거',
    reset: '초기화',
    zoom_in: '확대',
    zoom_out: '축소',
    fit: '맞춤',
    zoom_hint: 'Ctrl+휠로 줌',
    why_title: '왜 편집 기능이 제한되나요?',
    why_intro: 'OXXOVO는 영상 편집이 아니라 순수 AI 창작을 겨루는 대회입니다.',
    why_allow: '대회의 초점을 AI 생성에 두기 위해, OXXOVO는 세 가지만 허용합니다:',
    why_seq: ['순서', '클립의 재생 순서 배열'],
    why_trim: ['트림', '클립의 앞 또는 끝을 짧게 자르기'],
    why_cut: ['컷', '전환효과 없이 클립을 하드컷으로 잇기'],
    why_close: '관건은 얼마나 편집하느냐가 아니라, 얼마나 효과적으로 AI로 창작하느냐입니다.',
    under: (n: number) => `최소 ${n}초가 필요합니다. 클립을 추가하거나 트림을 늘리세요.`,
    over: (n: number) => `${n}초를 초과했습니다. 트림하거나 클립을 줄이세요.`,
    clip_over: (n: number) => `클립 수가 최대 ${n}개를 초과했습니다.`,
    clip_count: (n: number, max: number) => `클립 ${n} / ${max}`,
    render: '완성본 만들기',
    rendering: '완성본 생성 중…',
    render_status: (s: string) => `상태: ${s}`,
    final_ready: '완성본이 준비되었습니다.',
    render_failed: '완성본 생성 실패',
    submit_title: '완성본 제출',
    submit_round: (r: string) => (r === 'main' ? '본선 라운드' : '예선 라운드'),
    submit_btn: '제출하기',
    submitting: '제출 중…',
    delete_final: '이 완성작 삭제',
    deleting: '삭제 중…',
    delete_final_confirm: '이 완성작을 삭제할까요? 편집 화면으로 돌아갑니다. (제출 전에만 가능)',
    submitted_ok: '제출 완료 — 채점 대기 중입니다. 제출 후에는 수정할 수 없습니다.',
    already_submitted: '이번 라운드에 이미 제출했습니다.',
    // ★Asynchronous submission -- the accepted-but-not-yet-finalized screen. The one
    // thing a participant needs to read here is that the DEADLINE is already met; the
    // rendering that follows is our problem, not theirs. No time estimate is shown:
    // it depends on the queue and would be a lie.
    acc_title: '제출 접수됨 · 처리 중',
    acc_at: (s: string) => `접수 시각: ${s}`,
    acc_before_deadline: '접수는 마감 전에 완료되었습니다. 마감 이후 처리에는 영향을 받지 않습니다.',
    acc_processing: '완성본을 순서대로 처리하고 있습니다. 이 화면을 닫아도 처리는 계속됩니다.',
    acc_render: (s: string) =>
      ({ queued: '대기 중', rendering: '처리 중', uploading: '업로드 중', ready: '처리 완료', submitted: '처리 완료', failed: '재확인 중' } as Record<string, string>)[s] ?? s,
    acc_render_label: '완성본 상태',
    acc_requeued: '처리 중 문제가 있어 자동으로 다시 처리하고 있습니다. 참가 자격에는 영향이 없습니다.',
    acc_failed: '처리 중 문제가 발생해 운영진이 확인하고 있습니다. 참가 자격에는 영향이 없습니다.',
    acc_no_resubmit: '단일 제출이므로 다시 제출하거나 수정할 수 없습니다.',
    submit_async_note: '완성본이 아직 생성 중이어도 지금 제출할 수 있습니다 — 접수는 마감 전에 기록되고, 완성본은 이어서 처리됩니다.',
    submit_warn: '제출하면 이 완성본이 채점에 들어가며 되돌릴 수 없습니다.',
    need_info: '예선은 이 제출이 곧 참가 신청입니다 — 작품 설명과 동의만 입력하세요.',
    publish_as: (n: string) => `이 작품은 '${n}'(으)로 공개됩니다 — 이름은 프로필에서 변경할 수 있어요.`,
    f_statement: (n: number, m: number) => `작품 설명 (${n}~${m}자)`,
    agree_rules: '대회 규칙에 동의합니다',
    agree_privacy: '개인정보 처리방침에 동의합니다',
    agree_integrity: '무결성 고지에 동의합니다',
    submit_err: (e: string) => `제출 실패: ${e}`,
    chars: '자',
    fx_title: '효과',
    fx_clip: '선택 클립',
    fx_global: '전체 그레이드',
    fx_no_clip: '타임라인에서 클립을 선택하면 효과를 조절할 수 있어요.',
    fx_lut: 'LUT (룩)',
    fx_speed: '속도',
    fx_reset: '초기화',
    fx_reset_clip: '클립 효과 초기화',
    fx_reset_global: '전체 그레이드 초기화',
    undo: '실행 취소',
    redo: '다시 실행',
    dbl_default: '더블클릭: 기본값으로',
    fx_transitions: '전환',
    fx_no_trans: '없음',
    fx_between: (a: number, b: number) => `클립 ${a} → ${b}`,
    approx_badge: '근사',
    approx_note: '그레인 미리보기는 근사치입니다 — 최종본의 입자 패턴은 다릅니다(양은 동일).',
    fx_preview_off: '이 브라우저에서는 효과 미리보기를 표시할 수 없어 원본 영상을 보여드립니다. 설정하신 효과는 그대로 저장되며 최종 렌더에는 정상 적용됩니다.',
    // --- text/title overlay ---
    text_title: '텍스트',
    text_default: '텍스트',
    text_add: '+ 텍스트 추가',
    text_max: (n: number) => `텍스트는 최대 ${n}개까지 추가할 수 있어요.`,
    text_none: '텍스트를 추가하면 여기서 편집할 수 있어요.',
    text_need_clip: '먼저 타임라인에 클립을 올리세요.',
    text_layer_n: (n: number) => `텍스트 ${n}`,
    text_content: '문구',
    text_content_ph: '표시할 문구 (Enter로 줄바꿈)',
    text_font: '글꼴',
    text_size: '크기',
    text_size_floor: (n: number) => `최소 ${n}%까지 — 그보다 작으면 화면에서 읽기 어렵고 최종본과 어긋날 수 있어요.`,
    text_color: '색상',
    text_stroke: '외곽선',
    text_stroke_w: '두께',
    text_align: '정렬',
    text_align_l: '왼쪽', text_align_c: '가운데', text_align_r: '오른쪽',
    text_pos: '위치',
    text_pos_hint: '미리보기에서 드래그하거나 9칸으로 배치하세요.',
    text_window: '표시 구간',
    text_from: '시작', text_to: '끝',
    text_fade: '페이드',
    text_fade_in: '들어옴', text_fade_out: '나감',
    text_delete: '삭제',
    text_drag: '드래그해서 위치 이동',
    tt_title: '자막 트랙',
    tt_none: '텍스트를 추가하면 표시 구간이 여기에 나타나요.',
    tt_hint: '바를 끌어 구간을 옮기고, 양 끝을 끌어 길이를 조절하세요.',
    tt_move: '끌어서 구간 이동',
    tt_trim_s: '시작 조절', tt_trim_e: '끝 조절',
    fit_w: '가로', fit_h: '세로', fit_ok: '화면 안에 들어갑니다',
    fix_split: 'Enter로 줄을 나누세요 — 문구를 그대로 두고 폭을 줄일 수 있어요.',
    fix_smaller: '글자 크기를 줄이세요.',
    fix_shorter: '글자 수를 줄이세요.',
    fix_font: (n: string) => `이 문구라면 ${n} 글꼴로는 들어갑니다.`,
    fix_up: '위치를 위쪽으로 옮기세요.',
    fix_fewer_lines: '줄 수를 줄이세요.',
    fix_none: `최소 크기(${TEXT_LIMITS.MIN_SIZE_PCT}%)에서도 들어가지 않아요. 줄을 나누거나 문구를 줄여 주세요.`,
    fix_glyph: (c: string) => `이 글꼴에 없는 글자: ${c} — 영상에서 빈칸으로 나옵니다.`,
    fit_cap: (n: number) => `화면에 들어가는 최대 크기 ${n}% — 이 눈금을 넘기면 잘립니다.`,
    // --- output aspect / per-clip fit ---
    aspect_hint: '출력 비율 — 미리보기가 즉시 바뀝니다',
    crop_badge: '크롭됨',
    fit_label: '채우기',
    fit_contain: '여백',
    fit_cover: '크롭',
    fit_contain_hint: '비율이 다르면 검은 여백 (원본 전체 보존).',
    fit_cover_hint: '⚠ 화면을 꽉 채우되 가장자리가 잘립니다 (중앙 기준). 미리보기에서 잘린 결과를 확인하세요.',
    // --- music bed ---
    music_title: '음악',
    music_none_assets: '음악 라이브러리 준비 중입니다.',
    music_need_clip: '먼저 타임라인에 클립을 올리세요.',
    // ★④-E 분할. 규칙과 상수는 lib/edl-split.ts에 있다.
    split: '분할',
    split_hint: '플레이헤드 위치에서 클립을 둘로 나눕니다. 전체 길이는 변하지 않습니다.',
    split_need_inside: '클립 안쪽에 플레이헤드를 두세요 (경계에서는 나눌 것이 없습니다).',
    split_why: (r: SplitReason, maxClips: number) =>
      r === 'too_many_clips'
        ? `클립 수 상한(${maxClips})에 도달했습니다. 분할도 클립 한 칸을 씁니다.`
        : r === 'too_short'
          ? `양쪽 조각이 최소 ${MIN_SPLIT_MS}ms는 되어야 합니다.`
          : '이 위치에서는 나눌 수 없습니다.',
    music_pick: '음악 선택',
    music_loading: '불러오는 중…',
    // ★[4] 필터·미리듣기. 장르·무드 라벨 자체는 lib/music-grid-labels.ts에 있다 —
    // 키는 워커가 쓰고 읽는 말은 앱이 가진다.
    music_filter_clear: '필터 해제',
    music_filter_none: '이 조건에 맞는 곡이 없습니다. 필터를 해제해 보세요.',
    music_use_this: '이 곡 사용',
    music_preview_close: '닫기',
    music_change: '변경',
    music_volume: '음악 볼륨',
    music_balance: '원본 소리',
    music_fade: '페이드',
    music_fade_in: '들어옴',
    music_fade_out: '나감',
    music_remove: '음악 제거',
    music_wysiwyg: '미리보기에서 들리는 그대로 최종본에 들어갑니다.',
    // --- AI music generation (Stage 6) ---
    music_ai_title: 'AI로 음악 생성',
    // ★GENRE AND MOOD ONLY. This example used to end in '화장품 광고' -- a
    // product category on the participant's screen, which is the one thing the
    // main-round theme must not leak through. Never name a product type, an
    // industry, '광고'/'CF', or a brand here; two genre/mood examples do the same
    // job of showing what a usable prompt looks like.
    music_ai_ph: '분위기를 설명하세요 (예: 밝고 경쾌한 일렉트로팝, 잔잔한 솔로 피아노). 특정 가수·곡을 흉내내는 요청은 거절됩니다.',
    music_ai_generate: '생성',
    music_ai_generating: '생성 중… 잠시 기다려 주세요.',
    music_ai_cost: (n: number) => `${n} 크레딧`,
    music_ai_remaining: (left: number, cap: number) => `이번 라운드 ${left}/${cap}회 남음`,
    music_ai_cap_reached: '이번 라운드 생성 횟수를 모두 사용했습니다',
    music_ai_default_title: 'AI 음악',
    restore_title: '직전 렌더가 실패했습니다',
    restore_body: '클립은 그대로 있습니다. 잃은 것은 배열뿐이고, 그 배열도 복원할 수 있습니다.',
    restore_cta: '배열 복원',
    restore_done: '배열을 복원했습니다. 다시 렌더하시면 됩니다.',
    music_ai_refund_note: '생성에 실패하면 크레딧은 자동으로 환불됩니다.',
    music_ai_reason: (r: string) =>
      (({
        music_imitation: '특정 가수·곡을 흉내내는 요청은 허용되지 않습니다. 분위기를 묘사해 주세요.',
        music_moderation: '프롬프트가 콘텐츠 정책에 맞지 않습니다. 다시 작성해 주세요.',
        music_insufficient_credits: '크레딧이 부족합니다.',
        music_prompt_too_long: '프롬프트가 너무 깁니다.',
        music_prompt_empty: '프롬프트를 입력해 주세요.',
        music_duration: '요청한 길이가 허용 범위를 벗어났습니다.',
        music_cap_reached: '생성 한도에 도달했습니다.',
        music_not_priced: '음악 생성 요금이 아직 설정되지 않았습니다. 운영진이 확인 중이며, 요금이 청구되지 않았습니다.',
        music_ai_disabled: 'AI 음악 생성이 아직 활성화되지 않았습니다.',
        music_disabled: '이 시즌에는 음악을 사용할 수 없습니다.',
      } as Record<string, string>)[r] ?? '음악 생성에 실패했습니다. 다시 시도해 주세요.'),
    text_reason: (r: TextReason) => ({
      too_many_texts: `텍스트가 너무 많아요 (최대 ${TEXT_LIMITS.MAX_TEXTS}개).`,
      text_content: `문구를 입력하세요 (최대 ${TEXT_LIMITS.MAX_CONTENT_LEN}자, ${TEXT_LIMITS.MAX_LINES}줄).`,
      text_font: '허용되지 않은 글꼴이에요.',
      text_size: `글자 크기는 ${TEXT_LIMITS.MIN_SIZE_PCT}%~${TEXT_LIMITS.MAX_SIZE_PCT}% 사이여야 해요.`,
      text_color: '색상 형식이 올바르지 않아요.',
      text_stroke: '외곽선 설정이 올바르지 않아요.',
      text_align: '정렬 값이 올바르지 않아요.',
      text_pos: '위치가 화면을 벗어났어요.',
      text_window: '표시 구간이 영상 길이를 벗어났어요.',
      text_fade: '페이드가 표시 구간보다 길어요.',
      text_trademark: '상표·브랜드명은 사용할 수 없어요. 문구를 수정해 주세요.',
      text_too_wide: '문구가 화면 폭을 넘어가요. 줄을 나누거나, 크기를 줄이거나, 글자 수를 줄여 주세요.',
      text_too_tall: '문구가 화면 아래로 넘어가요. 위쪽으로 옮기거나, 크기를 줄이거나, 줄 수를 줄여 주세요.',
      text_font_glyph: '이 글꼴에 없는 글자가 있어요 — 그대로 두면 영상에서 빈칸으로 나와요. 글꼴을 바꾸거나 문구를 수정해 주세요.',
    }[r]),
  },
  en: {
    shell: 'PRO editor',
    back: '← Studio',
    pool: 'Media pool',
    search: 'Search clips…',
    add: 'Add',
    no_clips: 'No ready clips for this round yet. Generate clips in Studio first.',
    preview: 'Preview',
    total: 'Total',
    empty_prev: 'Add clips to the timeline',
    play: 'Play',
    stop: 'Stop',
    timeline: 'Timeline',
    single_track: 'Single track · sequence · trim · cut only (no compositing/overlay)',
    tl_hint: 'Add clips from the pool, drag to reorder, drag the ends to trim — Genesis Rule.',
    drag_here: 'Add clips from the pool',
    clip: 'Clip',
    sec: 's',
    remove: 'Remove',
    reset: 'Reset',
    zoom_in: 'Zoom in',
    zoom_out: 'Zoom out',
    fit: 'Fit',
    zoom_hint: 'Ctrl+wheel to zoom',
    why_title: 'Why are editing tools limited?',
    why_intro: 'OXXOVO rewards pure AI creation — not editing.',
    why_allow: 'To keep the competition focused on AI generation, OXXOVO allows only three actions:',
    why_seq: ['Sequence', 'arrange the order of clips'],
    why_trim: ['Trim', 'shorten the beginning or end of a clip'],
    why_cut: ['Cut', 'join clips with a hard cut (no transition)'],
    why_close: 'The challenge is not how much you can edit, but how effectively you can create with AI.',
    under: (n: number) => `At least ${n}s required. Add a clip or extend a trim.`,
    over: (n: number) => `Over ${n}s. Trim or remove a clip.`,
    clip_over: (n: number) => `More than the max of ${n} clips.`,
    clip_count: (n: number, max: number) => `Clips ${n} / ${max}`,
    render: 'Make final',
    rendering: 'Rendering final…',
    render_status: (s: string) => `Status: ${s}`,
    final_ready: 'Your final is ready.',
    render_failed: 'Render failed',
    submit_title: 'Submit final',
    submit_round: (r: string) => (r === 'main' ? 'Main round' : 'Application round'),
    submit_btn: 'Submit',
    submitting: 'Submitting…',
    delete_final: 'Delete this final',
    deleting: 'Deleting…',
    delete_final_confirm: 'Delete this final? You return to editing. (Only before submission.)',
    submitted_ok: 'Submitted — awaiting scoring. Submissions cannot be edited.',
    already_submitted: 'Already submitted for this round.',
    acc_title: 'Submission received · processing',
    acc_at: (s: string) => `Received at ${s}`,
    acc_before_deadline: 'Your submission was received BEFORE the deadline. Processing afterwards does not affect it.',
    acc_processing: 'Finals are being processed in order. Processing continues even if you leave this page.',
    acc_render: (s: string) =>
      ({ queued: 'Waiting', rendering: 'Processing', uploading: 'Uploading', ready: 'Processed', submitted: 'Processed', failed: 'Being re-checked' } as Record<string, string>)[s] ?? s,
    acc_render_label: 'Final status',
    acc_requeued: 'Processing hit a problem and is being retried automatically. Your entry is not affected.',
    acc_failed: 'Processing hit a problem and staff are looking into it. Your entry is not affected.',
    acc_no_resubmit: 'Single submission — it cannot be resubmitted or edited.',
    submit_async_note: 'You can submit now even while the final is still rendering — receipt is recorded before the deadline and the final is processed afterwards.',
    submit_warn: 'Submitting enters this final into scoring and cannot be undone.',
    need_info: 'In the application round this submission is your entry — just add your statement and agree below.',
    publish_as: (n: string) => `This entry will be published as '${n}' — you can change your name in your profile.`,
    f_statement: (n: number, m: number) => `Creator statement (${n}–${m} chars)`,
    agree_rules: 'I agree to the tournament rules',
    agree_privacy: 'I agree to the privacy policy',
    agree_integrity: 'I agree to the integrity notice',
    submit_err: (e: string) => `Submission failed: ${e}`,
    chars: 'chars',
    fx_title: 'Effects',
    fx_clip: 'Selected clip',
    fx_global: 'Whole timeline',
    fx_no_clip: 'Select a clip in the timeline to adjust its effects.',
    fx_lut: 'LUT (look)',
    fx_speed: 'Speed',
    fx_reset: 'Reset',
    fx_reset_clip: 'Reset clip effects',
    fx_reset_global: 'Reset grade',
    undo: 'Undo',
    redo: 'Redo',
    dbl_default: 'Double-click: reset to default',
    fx_transitions: 'Transitions',
    fx_no_trans: 'None',
    fx_between: (a: number, b: number) => `Clip ${a} → ${b}`,
    approx_badge: 'approx',
    approx_note: 'Grain preview is approximate — the final grain pattern differs (the amount matches).',
    fx_preview_off: 'This browser cannot display the effect preview, so the original footage is shown. Your effects are saved and will be applied in full on the final render.',
    // --- text/title overlay ---
    text_title: 'Text',
    text_default: 'Text',
    text_add: '+ Add text',
    text_max: (n: number) => `Up to ${n} text layers.`,
    text_none: 'Add a text layer to edit it here.',
    text_need_clip: 'Add a clip to the timeline first.',
    text_layer_n: (n: number) => `Text ${n}`,
    text_content: 'Content',
    text_content_ph: 'Text to show (Enter for a new line)',
    text_font: 'Font',
    text_size: 'Size',
    text_size_floor: (n: number) => `Minimum ${n}% — smaller text is hard to read and may not match the final.`,
    text_color: 'Color',
    text_stroke: 'Outline',
    text_stroke_w: 'Width',
    text_align: 'Align',
    text_align_l: 'Left', text_align_c: 'Center', text_align_r: 'Right',
    text_pos: 'Position',
    text_pos_hint: 'Drag on the preview, or use the 9-grid.',
    text_window: 'Show from/to',
    text_from: 'From', text_to: 'To',
    text_fade: 'Fade',
    text_fade_in: 'In', text_fade_out: 'Out',
    text_delete: 'Delete',
    text_drag: 'Drag to move',
    tt_title: 'Caption track',
    tt_none: 'Add a text layer and its show window appears here.',
    tt_hint: 'Drag a bar to move its window; drag an edge to resize.',
    tt_move: 'Drag to move the window',
    tt_trim_s: 'Trim start', tt_trim_e: 'Trim end',
    fit_w: 'Width', fit_h: 'Height', fit_ok: 'Fits the frame',
    fix_split: 'Press Enter to split the line — keeps every word, narrows the block.',
    fix_smaller: 'Reduce the text size.',
    fix_shorter: 'Use fewer characters.',
    fix_font: (n: string) => `This text would fit in ${n}.`,
    fix_up: 'Move the text higher in the frame.',
    fix_fewer_lines: 'Use fewer lines.',
    fix_none: `It does not fit even at the minimum size (${TEXT_LIMITS.MIN_SIZE_PCT}%). Split the line or shorten the text.`,
    fix_glyph: (c: string) => `Characters this font cannot draw: ${c} — they render as blank space.`,
    fit_cap: (n: number) => `Largest size that fits: ${n}% — past this tick the text is clipped.`,
    // --- output aspect / per-clip fit ---
    aspect_hint: 'Output aspect — the preview reframes instantly',
    crop_badge: 'CROPPED',
    fit_label: 'Fill',
    fit_contain: 'Fit',
    fit_cover: 'Crop',
    fit_contain_hint: 'Black bars when the aspect differs (keeps the whole frame).',
    fit_cover_hint: '⚠ Fills the frame but the edges are cropped (from center). Check the cropped result in the preview.',
    // --- music bed ---
    music_title: 'Music',
    music_none_assets: 'Music library coming soon.',
    music_need_clip: 'Add a clip to the timeline first.',
    // ★④-E split. The rule and the constant live in lib/edl-split.ts.
    split: 'Split',
    split_hint: 'Cut the clip in two at the playhead. Total length does not change.',
    split_need_inside: 'Put the playhead inside a clip (there is nothing to cut on a boundary).',
    split_why: (r: SplitReason, maxClips: number) =>
      r === 'too_many_clips'
        ? `You have reached the clip limit (${maxClips}). A split spends a clip slot too.`
        : r === 'too_short'
          ? `Each piece has to be at least ${MIN_SPLIT_MS}ms.`
          : 'This position cannot be split.',
    music_pick: 'Pick music',
    music_loading: 'Loading…',
    // ★[4] filter + preview. The genre/mood wording itself lives in
    // lib/music-grid-labels.ts -- the worker owns the keys, the app owns the words.
    music_filter_clear: 'Clear filters',
    music_filter_none: 'No tracks match these filters. Try clearing them.',
    music_use_this: 'Use this track',
    music_preview_close: 'Close',
    music_change: 'Change',
    music_volume: 'Music volume',
    music_balance: 'Original audio',
    music_fade: 'Fade',
    music_fade_in: 'In',
    music_fade_out: 'Out',
    music_remove: 'Remove music',
    music_wysiwyg: 'What you hear in the preview is what ships in the final.',
    // --- AI music generation (Stage 6) ---
    music_ai_title: 'Generate music with AI',
    // Genre and mood only -- see the KO note. No product category, no industry.
    music_ai_ph: 'Describe the mood (e.g. bright upbeat electro-pop, or a calm solo piano). Requests that imitate a specific artist or song are refused.',
    music_ai_generate: 'Generate',
    music_ai_generating: 'Generating… please wait.',
    music_ai_cost: (n: number) => `${n} credits`,
    music_ai_remaining: (left: number, cap: number) => `${left}/${cap} left this round`,
    music_ai_cap_reached: 'No generations left this round',
    music_ai_default_title: 'AI music',
    restore_title: 'Your last render failed',
    restore_body: 'Your clips are all still here. Only the arrangement was lost, and it can be restored.',
    restore_cta: 'Restore arrangement',
    restore_done: 'Arrangement restored. Render again when you are ready.',
    music_ai_refund_note: 'Credits are automatically refunded if generation fails.',
    music_ai_reason: (r: string) =>
      (({
        music_imitation: 'Imitating a specific artist or song is not allowed. Please describe the mood instead.',
        music_moderation: 'The prompt does not meet the content policy. Please rewrite it.',
        music_insufficient_credits: 'Not enough credits.',
        music_prompt_too_long: 'The prompt is too long.',
        music_prompt_empty: 'Please enter a prompt.',
        music_duration: 'The requested length is out of range.',
        music_cap_reached: 'You have reached the generation limit.',
        music_not_priced: 'Music generation pricing is not configured yet. Staff are looking into it; you have not been charged.',
        music_ai_disabled: 'AI music generation is not enabled yet.',
        music_disabled: 'Music is not available this season.',
      } as Record<string, string>)[r] ?? 'Music generation failed. Please try again.'),
    text_reason: (r: TextReason) => ({
      too_many_texts: `Too many text layers (max ${TEXT_LIMITS.MAX_TEXTS}).`,
      text_content: `Enter some text (max ${TEXT_LIMITS.MAX_CONTENT_LEN} chars, ${TEXT_LIMITS.MAX_LINES} lines).`,
      text_font: 'That font is not allowed.',
      text_size: `Size must be ${TEXT_LIMITS.MIN_SIZE_PCT}%–${TEXT_LIMITS.MAX_SIZE_PCT}%.`,
      text_color: 'Invalid color format.',
      text_stroke: 'Invalid outline settings.',
      text_align: 'Invalid alignment.',
      text_pos: 'Position is off-screen.',
      text_window: 'The show window is outside the video length.',
      text_fade: 'Fade is longer than the show window.',
      text_trademark: 'Trademarks / brand names are not allowed. Please edit the text.',
      text_too_wide: 'This line is wider than the frame. Split it across lines, reduce the size, or shorten it.',
      text_too_tall: 'The text runs past the bottom of the frame. Move it up, reduce the size, or use fewer lines.',
      text_font_glyph: 'This font has no glyph for one of these characters — it would render as a blank gap. Change the font or edit the text.',
    }[r]),
  },
} as const

// Media-pool virtualization geometry (real <video> thumbs -- heavier than the
// demo swatches, so windowing matters). 3-col grid, fixed row height.
const POOL_COLS = 3
const POOL_ROW_H = 104
const POOL_OVERSCAN = 2
const ZOOM_MIN = 6
const ZOOM_MAX = 120

// ★D keyframes -- mini keyframe track (design: reports/lane_c_item4_d_ui_design_2026-08-10.md).
// Click empty track = add a point at the current interpolated value. Drag a
// point = move it (x=time, y=value). Double-click = delete (floor: 2 points,
// enforced by the caller never rendering this below 2). Linear only (decision
// ②, 2026-08-10) -- no curve picker, points always connect with a straight line.
function KeyframeMiniTrack({
  track,
  min,
  max,
  spanMs,
  onChange,
}: {
  track: KeyframeTrack
  min: number
  max: number
  spanMs: number
  onChange: (next: KeyframeTrack) => void
}) {
  const [selected, setSelected] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragIdx = useRef<number | null>(null)
  const pts = track.points

  const xPct = (atMs: number) => (spanMs > 0 ? Math.max(0, Math.min(1, atMs / spanMs)) : 0) * 100
  const yPct = (val: number) => (1 - (max > min ? (val - min) / (max - min) : 0)) * 100

  const msFromClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * spanMs)
  }
  const valFromClientY = (clientY: number) => {
    const el = trackRef.current
    if (!el) return min
    const r = el.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (clientY - r.top) / r.height))
    return Math.round(max - p * (max - min))
  }
  const commit = (next: { atMs: number; value: number }[]) => onChange({ points: [...next].sort((a, b) => a.atMs - b.atMs) })

  const onPointDown = (i: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(i)
    dragIdx.current = i
    const onMove = (ev: MouseEvent) => {
      const idx = dragIdx.current
      if (idx == null) return
      const atMs = msFromClientX(ev.clientX)
      const value = Math.max(min, Math.min(max, valFromClientY(ev.clientY)))
      commit(pts.map((p, j) => (j === idx ? { atMs, value } : p)))
    }
    const onUp = () => {
      dragIdx.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const onTrackClick = (e: React.MouseEvent) => {
    if (e.target !== trackRef.current) return // a point's own mousedown already handled it
    const atMs = msFromClientX(e.clientX)
    const value = Math.round(Math.max(min, Math.min(max, valueAt(track, atMs))))
    const next = [...pts, { atMs, value }]
    commit(next)
    setSelected(next.length - 1)
  }
  const onPointDoubleClick = (i: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pts.length <= 2) return // floor: dropping below 2 points is the caller's OFF toggle, not this component's job
    commit(pts.filter((_, j) => j !== i))
    setSelected(0)
  }

  const sel = pts[Math.min(selected, pts.length - 1)]
  return (
    <div className="mt-1">
      <div
        ref={trackRef}
        onClick={onTrackClick}
        className="relative h-8 w-full cursor-crosshair rounded border border-white/10 bg-[#070610]"
      >
        {pts.map((p, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={onPointDown(i)}
            onDoubleClick={onPointDoubleClick(i)}
            className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
              i === selected ? 'border-white bg-[#8b22ff]' : 'border-white/50 bg-[#8b22ff]/70'
            }`}
            style={{ left: `${xPct(p.atMs)}%`, top: `${yPct(p.value)}%` }}
          />
        ))}
      </div>
      {sel && (
        <input
          type="number"
          min={min}
          max={max}
          value={Math.round(sel.value)}
          onChange={(e) => {
            const value = Math.max(min, Math.min(max, Number(e.target.value) || 0))
            commit(pts.map((p, j) => (j === selected ? { ...p, value } : p)))
          }}
          className="mt-1 w-16 rounded border border-white/10 bg-[#070610] px-1.5 py-0.5 text-[10px] text-white"
        />
      )}
    </div>
  )
}

export default function ProComposeEditor(props: ComposeEditorProps) {
  const t = DICT[props.lang]
  const clipById = useMemo(() => new Map(props.clips.map((c) => [c.id, c])), [props.clips])

  const [segments, setSegments] = useState<Segment[]>([])
  // ★Offer to restore the arrangement of a render that failed, but ONLY when the
  // timeline came up empty. If the local draft already brought the arrangement
  // back, nothing was lost and a banner about loss would be its own small lie.
  type RestorableEdl = { jobId: string; startMs: number; endMs: number; fit?: 'contain' | 'cover' }
  const [restorable, setRestorable] = useState<RestorableEdl[] | null>(null)
  const [arrangementRestored, setArrangementRestored] = useState(false)
  const [texts, setTexts] = useState<TextLayer[]>([]) // text/title overlays (stage 5 renders, stage 6 edits)
  const [selText, setSelText] = useState<number | null>(null) // selected text layer index
  const [aspect, setAspect] = useState<Aspect>('16:9') // output aspect (letterbox/crop per clip)
  const [music, setMusic] = useState<MusicBed | null>(null) // music bed (null = clip audio only)
  const musicEnabled = props.musicEnabled ?? false
  // Freshly-generated AI tracks (this session) merged into the picker so a
  // just-finished generation is immediately selectable without a full reload.
  // ★genre/bpm are optional: the columns are not migrated, so they are absent today and
  // the facet controls below stay hidden until the data carries them (see
  // lib/music-grid-labels.ts availableFacets and the note on MusicAsset).
  type PickAsset = {
    id: string
    url: string
    title: string
    mood: string
    source: 'library' | 'ai'
    genre?: string | null
    bpm?: number | null
  }
  const [extraMusic, setExtraMusic] = useState<PickAsset[]>([])
  // ★Lazily-loaded library. See ComposeEditorProps.loadMusicAssets: the beds are
  // no longer shipped with the page, so they arrive here the first time the
  // picker is actually needed.
  const [loadedMusic, setLoadedMusic] = useState<PickAsset[] | null>(null)
  const [musicLoading, setMusicLoading] = useState(false)
  const musicAssets = useMemo<PickAsset[]>(() => {
    const base = props.musicAssets ?? loadedMusic ?? []
    const seen = new Set(base.map((a) => a.id))
    return [...base, ...extraMusic.filter((a) => !seen.has(a.id))]
  }, [props.musicAssets, loadedMusic, extraMusic])
  const loadMusic = useCallback(() => {
    if (!props.loadMusicAssets || loadedMusic !== null || musicLoading) return
    setMusicLoading(true)
    props
      .loadMusicAssets()
      // ★An empty array on failure, not a retry loop and not a thrown error. The
      // picker's "no tracks" state already exists and is honest here: nothing is
      // pickable right now. A bed cannot be silently substituted, and the render
      // path re-resolves the asset server-side regardless of what this list said.
      .then((a) => setLoadedMusic(a ?? []))
      .catch(() => setLoadedMusic([]))
      .finally(() => setMusicLoading(false))
  }, [props, loadedMusic, musicLoading])
  // Has the picker list actually been resolved? Distinguishes "there are no
  // tracks" from "we have not fetched them yet" -- without it an empty list
  // before the first fetch reads as "library coming soon", which is a lie.
  const musicListReady = props.musicAssets !== undefined || loadedMusic !== null
  const musicUrl = music ? (musicAssets.find((a) => a.id === music.assetId)?.url ?? null) : null

  // ---- [4] picker facets + preview ----------------------------------------
  // ★The facet rule is in lib/music-grid-labels.ts, not here, so it can be executed by
  // a test instead of eyeballed through a component. This holds only the selection.
  const [musicFacets, setMusicFacets] = useState<MusicFilterSelection>({})
  // Which controls may render AT ALL. With genre/bpm unmigrated every asset lacks them,
  // so those chips do not appear -- a filter that returns nothing would read as "there
  // is no cinematic music" rather than "this is not wired up yet". They light up on
  // their own once rows carry the columns.
  const musicFacetsAvailable = useMemo(() => availableFacets(musicAssets), [musicAssets])
  const musicFilterActive = !!(musicFacets.genre || musicFacets.mood || musicFacets.tempo)
  const visibleMusicAssets = useMemo(
    () => filterMusicAssets(musicAssets, musicFacets),
    [musicAssets, musicFacets],
  )
  // ★Preview is its own element, not the timeline's audio: auditioning a candidate must
  // not disturb the composition or the bed already selected. `preload="none"` so opening
  // the panel does not fetch a thousand files.
  const [musicPreviewId, setMusicPreviewId] = useState<string | null>(null)
  const musicPreviewUrl = musicPreviewId
    ? (musicAssets.find((a) => a.id === musicPreviewId)?.url ?? null)
    : null
  // ★A restored draft can already have a bed selected, and then the list is not
  // optional: without it the panel shows a bare asset id instead of the track
  // name, and the preview has no URL to play. So a selected bed loads the list
  // whether or not the participant ever touches the picker.
  useEffect(() => {
    if (musicEnabled && music && !musicListReady) loadMusic()
  }, [musicEnabled, music, musicListReady, loadMusic])

  // AI music-gen panel state (Stage 6). Gated on props.musicAiEnabled.
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiState, setAiState] = useState<'idle' | 'generating' | 'error'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  const aiPollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Per-round AI-music ceiling. `aiGenerated` counts what this session added on
  // top of the server's figure, so the counter moves as soon as a generation is
  // enqueued rather than only after a reload. The server re-checks the cap on
  // every call -- this is display, never the enforcement.
  const [aiGenerated, setAiGenerated] = useState(0)
  const musicCap = props.musicCap ?? 0
  const musicLeft = Math.max(0, musicCap - ((props.musicUsed ?? 0) + aiGenerated))
  const musicCapReached = musicCap > 0 && musicLeft <= 0
  const [dragUid, setDragUid] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')

  // render + submit state (reused from the live editor's proven flow)
  const [renderState, setRenderState] = useState<EditorRenderStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [submitDone, setSubmitDone] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // ★Asynchronous submission. Seeded from the SERVER so a participant who reloads
  // during the 24h buffer still sees their acceptance -- client state is not where a
  // submission lives. Advanced locally by a successful submit and by polling.
  const [accepted, setAccepted] = useState<ComposeSubmission>(props.submission ?? null)
  const [ap, setAp] = useState<ComposeApplicant>({
    creatorName: '', creatorStatement: '', country: '', channelUrl: '',
    agreedRules: false, agreedPrivacy: false, agreedIntegrity: false,
  })

  // Timeline zoom (px/second) -- presentation only, never touches the EDL.
  const [pxPerSec, setPxPerSec] = useState(24)
  const tlRef = useRef<HTMLDivElement>(null)

  // ---- draft persistence + resume (reused semantics) ------------------------
  const draftKey = props.seasonId ? `oxxovo_compose_draft_${props.seasonId}` : null
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    type Edl = { jobId: string; startMs: number; endMs: number; fit?: 'contain' | 'cover' }
    const edlEq = (a: Edl[], b: Edl[]) =>
      a.length === b.length && a.every((s, i) => s.jobId === b[i].jobId && s.startMs === b[i].startMs && s.endMs === b[i].endMs)
    let draftSegs: Edl[] | null = null
    let draftAp: Partial<ComposeApplicant> | null = null
    let draftTexts: TextLayer[] | null = null
    let draftAspect: Aspect | null = null
    let draftMusic: MusicBed | null = null
    if (draftKey && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(draftKey)
        if (raw) {
          const d = JSON.parse(raw) as { segments?: Edl[]; texts?: TextLayer[]; aspect?: Aspect; music?: MusicBed | null; ap?: Partial<ComposeApplicant> }
          draftSegs = Array.isArray(d.segments) ? d.segments : null
          draftTexts = Array.isArray(d.texts) ? d.texts : null
          draftAspect = d.aspect === '9:16' || d.aspect === '16:9' ? d.aspect : null
          draftMusic = d.music && typeof d.music.assetId === 'string' ? d.music : null
          draftAp = d.ap ?? null
        }
      } catch { /* malformed -- ignore */ }
    }
    const rr = props.resumeRender
    const sourceEdl: Edl[] = draftSegs && draftSegs.length ? draftSegs : rr?.edl ?? []
    const rebuilt = sourceEdl
      .filter((e) => clipById.has(e.jobId))
      .map((e) => ({ uid: nextUid(), jobId: e.jobId, startMs: e.startMs, endMs: e.endMs, fit: e.fit }))
    if (rebuilt.length) setSegments(rebuilt)
    // Only restore texts alongside a restored composition (they reference its
    // timeline). The server re-validates on render regardless.
    if (rebuilt.length && draftTexts && draftTexts.length) setTexts(draftTexts)
    if (rebuilt.length && draftAspect) setAspect(draftAspect)
    if (rebuilt.length && draftMusic) setMusic(draftMusic)
    if (!rebuilt.length && props.restorableRender?.edl?.length) {
      // Keep only segments whose clip still exists, exactly as the resume path
      // does -- offering to restore a timeline that references a deleted clip
      // would restore a hole.
      const usable = props.restorableRender.edl.filter((e) => clipById.has(e.jobId))
      if (usable.length) setRestorable(usable)
    }
    // ★ADOPT AN IN-FLIGHT RENDER, not only a finished one. This used to require
    // status==='ready', which quietly reproduced the 2026-07-31 defect one layer
    // down: submission is allowed while the render is still queued, but a
    // participant who requested the render and then RELOADED came back with
    // renderId=null, so `renderSubmittable` was false and the submit control was
    // not on the page. It worked only inside the tab that started the render --
    // exactly the case asynchronous submission exists to survive. The EDL guard is
    // unchanged: a render is only adopted onto the arrangement it was made from.
    if (rr && isSubmittableRenderStatus(rr.status)) {
      const chosen = rebuilt.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
      if (edlEq(chosen, rr.edl)) {
        setRenderId(rr.id)
        setRenderState({
          status: rr.status,
          videoUrl: rr.status === 'ready' ? rr.videoUrl : null,
          totalSeconds: rr.totalSeconds,
        })
      }
    }
    if (draftAp?.creatorStatement) setAp((a) => ({ ...a, creatorStatement: draftAp.creatorStatement ?? a.creatorStatement }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined' || submitDone) return
    const empty = segments.length === 0 && !ap.creatorStatement.trim()
    if (empty) return
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        segments: segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs, fit: s.fit })),
        texts,
        aspect,
        music,
        ap: { creatorStatement: ap.creatorStatement },
      }))
    } catch { /* quota -- non-fatal */ }
  }, [segments, texts, aspect, music, ap, submitDone, draftKey])

  useEffect(() => {
    if (submitDone && draftKey && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(draftKey) } catch { /* ignore */ }
    }
  }, [submitDone, draftKey])

  // ---- length / caps --------------------------------------------------------
  const totalMs = segments.reduce((a, s) => a + (s.endMs - s.startMs), 0)
  const minMs = props.minSeconds * 1000
  const maxMs = props.maxSeconds * 1000
  const over = totalMs > maxMs
  const under = props.minSeconds > 0 && segments.length > 0 && totalMs < minMs
  const tooMany = segments.length > props.maxClips
  // `accepted` (below) also gates this: once the round's submission is accepted it is
  // single-submission and terminal, so a new render would have nowhere to go.
  const canRender = segments.length > 0 && !over && !under && !tooMany && !busy

  // ---- sequence ops (order / trim / cut) ------------------------------------
  const addClip = (clip: SourceClip) => {
    if (segments.length >= props.maxClips) return
    commit('add')
    setSegments((s) => [...s, { uid: nextUid(), jobId: clip.id, startMs: 0, endMs: Math.round(clip.durationSeconds * 1000) }])
  }
  const removeSeg = (uid: string) => { commit('rm'); setSegments((s) => s.filter((x) => x.uid !== uid)); if (sel === uid) setSel(null) }
  const reorderTo = (fromUid: string, toUid: string) => {
    if (fromUid === toUid) return
    commit('reorder')
    setSegments((s) => {
      const from = s.findIndex((x) => x.uid === fromUid)
      const to = s.findIndex((x) => x.uid === toUid)
      if (from < 0 || to < 0) return s
      const copy = [...s]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })
  }

  // Edge trim via pointer drag; px delta -> ms using the live zoom (exact at any zoom).
  const trim = useRef<{ uid: string; edge: 'start' | 'end'; x0: number; orig: number } | null>(null)
  const onTrimDown = (e: React.PointerEvent, s: Segment, edge: 'start' | 'end') => {
    e.preventDefault(); e.stopPropagation()
    commit(`trim:${s.uid}:${edge}`) // one undo step per trim gesture (snapshot before drag)
    trim.current = { uid: s.uid, edge, x0: e.clientX, orig: edge === 'start' ? s.startMs : s.endMs }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onTrimMove = useCallback((e: React.PointerEvent) => {
    const tr = trim.current
    if (!tr) return
    const dMs = ((e.clientX - tr.x0) / pxPerSec) * 1000
    setSegments((list) =>
      list.map((x) => {
        if (x.uid !== tr.uid) return x
        const clip = clipById.get(x.jobId)
        const durMs = clip ? Math.round(clip.durationSeconds * 1000) : x.endMs
        if (tr.edge === 'start') return { ...x, startMs: Math.max(0, Math.min(Math.round(tr.orig + dMs), x.endMs - 200)) }
        return { ...x, endMs: Math.min(durMs, Math.max(Math.round(tr.orig + dMs), x.startMs + 200)) }
      }),
    )
  }, [pxPerSec, clipById])
  const onTrimUp = () => { trim.current = null }

  // ---- zoom -----------------------------------------------------------------
  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
  const zoomBy = (f: number) => setPxPerSec((z) => Math.round(clampZoom(z * f)))
  const fitZoom = () => {
    const el = tlRef.current
    if (el && totalMs > 0) setPxPerSec(clampZoom((el.clientWidth - 32) / (totalMs / 1000)))
  }
  const tickSec = pxPerSec < 12 ? 10 : pxPerSec < 30 ? 5 : 2
  const totalSec = totalMs / 1000
  const trackW = totalSec * pxPerSec

  // ---- media-pool virtualization + search -----------------------------------
  const pool = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? props.clips.filter((c) => c.prompt.toLowerCase().includes(needle)) : props.clips
  }, [props.clips, q])
  const poolRef = useRef<HTMLDivElement>(null)
  const [poolScroll, setPoolScroll] = useState(0)
  const [poolH, setPoolH] = useState(420)
  useEffect(() => {
    const el = poolRef.current
    if (!el) return
    const update = () => setPoolH(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const poolRows = Math.ceil(pool.length / POOL_COLS)
  const startRow = Math.max(0, Math.floor(poolScroll / POOL_ROW_H) - POOL_OVERSCAN)
  const endRow = Math.min(poolRows, Math.ceil((poolScroll + poolH) / POOL_ROW_H) + POOL_OVERSCAN)
  const visiblePool = pool.slice(startRow * POOL_COLS, endRow * POOL_COLS)

  // ---- preview (PLUGGABLE engine: GL when effects are set, else raw) ---------
  // TK contract: "effects on -> GL, effects off -> raw." The composition carries
  // NO effects in C (no effect UI), so raw is used + accurate. When E sets any
  // effect, `compositionHasEffects` flips and the WYSIWYG GL engine takes over.
  // GL renders the render's authoritative filter math (render is the source of
  // truth; the preview follows). Falls back to raw if WebGL is unavailable.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playheadMs, setPlayheadMs] = useState(0) // composition-global playhead (scrub / seek / live playback)
  const [globalFx, setGlobalFx] = useState<EffectParams>({}) // whole-timeline grade (E)
  const [transitions, setTransitions] = useState<PreviewTransition[]>([]) // clip-boundary transitions (E)
  const engineRef = useRef<PreviewEngine | null>(null)
  const previewClips = useMemo(
    () => new Map(props.clips.map((c) => [c.id, { id: c.id, url: c.url }])),
    [props.clips],
  )
  const webglOk = useMemo(() => {
    // The GL engine is WebGL2 (glow needs FBO multipass + a dynamic-loop gaussian);
    // no WebGL2 -> fall back to the raw preview.
    if (typeof document === 'undefined') return false
    try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
  }, [])
  // ★D keyframes: a segment can carry a live keyframes map while its static
  // effects[key] sits at neutral (toggling ON seeds the track FROM whatever
  // effects[key] already was, which is 0 on a never-touched slider) --
  // hasAnyEffect() alone would miss it, silently dropping to the v1 EDL path
  // (no GL preview, no keyframes in the signed submission).
  const hasAnyKeyframes = (s: Segment) => !!s.keyframes && Object.values(s.keyframes).some((tr) => tr && tr.points.length > 0)
  const compositionHasEffects = hasAnyEffect(globalFx) || transitions.length > 0 || segments.some((s) => hasAnyEffect(s.effects) || hasAnyKeyframes(s) || (s.speed !== undefined && Math.round(s.speed * 1000) !== 1000))
  // ★ NEVER SHOW A BLACK PREVIEW. If the GL engine cannot draw (cross-origin
  // texture upload refused, shader/context failure), it reports up here and we
  // stay on the raw engine for the rest of the session: the user sees the
  // ORIGINAL footage plus an honest "effects not shown in preview" note rather
  // than a dead black canvas. The render still applies every effect.
  const [glBlocked, setGlBlocked] = useState(false)
  const useGL = webglOk && compositionHasEffects && !glBlocked
  useEffect(() => {
    const engine = useGL
      ? createGLPreview({ onPlayingChange: setPlaying, onDegrade: () => setGlBlocked(true), onProgress: setPlayheadMs })
      : createRawPreview({ onPlayingChange: setPlaying, onProgress: setPlayheadMs })
    engineRef.current = engine
    if (videoRef.current) engine.mount(videoRef.current)
    return () => engine.destroy()
  }, [useGL])

  // ---- music bed preview (standalone <audio>, driven by the composition clock) --
  const musicRef = useRef<MusicPreview | null>(null)
  useEffect(() => {
    musicRef.current = createMusicPreview()
    return () => { musicRef.current?.destroy(); musicRef.current = null }
  }, [])
  // Load/clear the bed when the selected music or its resolved URL changes.
  useEffect(() => { musicRef.current?.setBed(music, musicUrl) }, [music, musicUrl])
  // Stop the AI-gen poll on unmount so it never fires into a dead component.
  useEffect(() => () => { if (aiPollRef.current) clearTimeout(aiPollRef.current) }, [])
  // Follow the master clock: gain envelope + drift guard while playing, and set the
  // clip <video> volume to the balance (original clip audio ducked under the bed).
  useEffect(() => {
    musicRef.current?.tick(playheadMs)
    const v = videoRef.current
    if (v) v.volume = music ? Math.max(0, Math.min(1, music.clipVolume / 100)) : 1
  }, [playheadMs, playing, music])
  // Effects are set but the preview cannot render them (no WebGL2, or GL degraded).
  const fxPreviewUnavailable = compositionHasEffects && !useGL
  // composition-global start (ms) of each segment -- for clip-click seek + spans.
  const segStarts = useMemo(() => {
    const arr: number[] = []; let a = 0
    for (const s of segments) { arr.push(a); a += Math.max(0, s.endMs - s.startMs) }
    return arr
  }, [segments])
  const movePlayhead = (compMs: number) => {
    const clamped = Math.max(0, Math.min(compMs, totalMs))
    setPlayheadMs(clamped)
    engineRef.current?.seek(clamped, segments, previewClips, globalFx, transitions)
    musicRef.current?.seek(clamped)
  }
  const startPreview = () => {
    if (!segments.length) return
    setSel(null)
    const atEnd = playheadMs >= totalMs - 10 // at the tail -> restart from the top
    const from = atEnd ? 0 : playheadMs
    if (atEnd) setPlayheadMs(0)
    engineRef.current?.play(segments, previewClips, globalFx, transitions, from)
    musicRef.current?.play(from)
  }
  const stopPreview = () => { engineRef.current?.pause(); musicRef.current?.pause() }
  const selSeg = segments.find((s) => s.uid === sel) ?? null
  // Idle preview = the frame at the playhead. Fires on composition/engine changes
  // so adding/replacing a clip repaints immediately (no stale prior clip) and
  // paused slider edits update WYSIWYG. Playback drives its own per-frame draw.
  const playheadRef = useRef(0)
  useEffect(() => { playheadRef.current = playheadMs })
  useEffect(() => {
    if (playing) return
    const eng = engineRef.current; if (!eng) return
    if (!segments.length) { eng.clear(); return }
    eng.seek(Math.max(0, Math.min(playheadRef.current, totalMs)), segments, previewClips, globalFx, transitions)
  }, [playing, segments, globalFx, transitions, previewClips, useGL, totalMs])

  // ---- scrubber (progress bar): click / drag to seek, playing or paused ------
  const scrubRef = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const scrubWasPlaying = useRef(false) // resume playback on release if it was playing
  const scrubMs = useRef(0)
  const scrubRaf = useRef(0)
  const compFromX = (clientX: number) => {
    const el = scrubRef.current
    if (!el || totalMs <= 0) return 0
    const r = el.getBoundingClientRect()
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * totalMs)
  }
  const onScrubDown = (e: React.PointerEvent) => {
    if (!segments.length) return
    scrubbing.current = true
    scrubWasPlaying.current = playing
    if (playing) { engineRef.current?.pause(); musicRef.current?.pause() } // hold A/V so both follow the drag
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const ms = compFromX(e.clientX); scrubMs.current = ms
    movePlayhead(ms)
  }
  const onScrubMove = (e: React.PointerEvent) => {
    if (!scrubbing.current) return
    const ms = compFromX(e.clientX); scrubMs.current = ms
    setPlayheadMs(ms) // responsive fill; the seek itself is throttled to rAF
    cancelAnimationFrame(scrubRaf.current)
    scrubRaf.current = requestAnimationFrame(() => engineRef.current?.seek(ms, segments, previewClips, globalFx, transitions))
    musicRef.current?.seek(ms) // reposition the (held) bed to the drag point
  }
  const onScrubUp = (e: React.PointerEvent) => {
    if (!scrubbing.current) return
    scrubbing.current = false
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    if (scrubWasPlaying.current) {
      engineRef.current?.play(segments, previewClips, globalFx, transitions, scrubMs.current)
      musicRef.current?.play(scrubMs.current)
    }
  }
  const togglePlay = () => { if (!segments.length) return; if (playing) stopPreview(); else startPreview() }

  // Drag the SELECTED text layer directly on the preview to set its anchor. A
  // press that doesn't move is a normal play/pause click; a drag repositions and
  // suppresses the click. Coords are normalized to the video's displayed box.
  const textDrag = useRef<{ down: boolean; moved: boolean }>({ down: false, moved: false })
  const onPreviewPointerDown = () => {
    if (selText === null || !segments.length) return
    textDrag.current = { down: true, moved: false }
  }
  const onPreviewPointerMove = (e: React.PointerEvent) => {
    if (!textDrag.current.down || selText === null) return
    const video = videoRef.current
    if (!video) return
    const vr = video.getBoundingClientRect()
    if (vr.width < 2 || vr.height < 2) return
    const x = Math.max(0, Math.min(1, (e.clientX - vr.left) / vr.width))
    const y = Math.max(0, Math.min(1, (e.clientY - vr.top) / vr.height))
    textDrag.current.moved = true
    updateText(selText, { xNorm: Number(x.toFixed(4)), yNorm: Number(y.toFixed(4)) }, 'text-pos')
  }
  const onPreviewPointerUp = () => { textDrag.current.down = false }
  const onPreviewClick = () => {
    if (textDrag.current.moved) { textDrag.current.moved = false; return } // was a drag, not a click
    togglePlay()
  }
  const playPct = totalMs > 0 ? Math.min(100, (playheadMs / totalMs) * 100) : 0
  // Segment currently under the playhead (for the crop badge -- mirrors the raw
  // engine's locateComposition span math).
  const curSeg = useMemo(() => {
    let acc = 0
    for (const s of segments) { const span = Math.max(0, s.endMs - s.startMs); if (playheadMs < acc + span) return s; acc += span }
    return segments[segments.length - 1] as Segment | undefined
  }, [segments, playheadMs])

  // ---- history: undo / redo -------------------------------------------------
  // Covers effects/speed/LUT/transitions/global grade (Phase 1) AND structural
  // ops -- add / remove / reorder / trim / clear (Phase 2). The doc is captured
  // as {segments, globalFx, transitions}; every mutation is already immutable
  // (spread/map/filter), so storing the *references* is a safe frozen snapshot.
  // Continuous edits (slider drags) coalesce by key+time into ONE undo step;
  // discrete edits (LUT/transition/reset/dbl-click) each push their own step.
  type Doc = { segments: Segment[]; globalFx: EffectParams; transitions: PreviewTransition[]; texts: TextLayer[]; aspect: Aspect; music: MusicBed | null }
  const undoRef = useRef<Doc[]>([])
  const redoRef = useRef<Doc[]>([])
  // Availability is STATE (not read off the refs during render) so the buttons
  // re-render correctly; the ref arrays hold the actual snapshots.
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const lastCommit = useRef<{ key: string; t: number }>({ key: '', t: 0 })
  const HIST_MAX = 100
  const COALESCE_MS = 400
  const commit = (key: string, coalesce = false) => {
    // eslint-disable-next-line react-hooks/purity -- commit() only runs from event handlers, never during render
    const now = Date.now()
    const merged = coalesce && key === lastCommit.current.key && now - lastCommit.current.t < COALESCE_MS
    lastCommit.current = { key, t: now }
    if (merged) return
    undoRef.current.push({ segments, globalFx, transitions, texts, aspect, music })
    if (undoRef.current.length > HIST_MAX) undoRef.current.shift()
    redoRef.current = []
    setCanUndo(true); setCanRedo(false)
  }
  const applyDoc = (d: Doc) => {
    setSegments(d.segments)
    setGlobalFx(d.globalFx)
    setTransitions(d.transitions)
    setTexts(d.texts)
    setAspect(d.aspect)
    setMusic(d.music)
    setSel((cur) => (cur && d.segments.some((s) => s.uid === cur) ? cur : null))
    setSelText((cur) => (cur !== null && cur < d.texts.length ? cur : null))
  }
  const undo = () => {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push({ segments, globalFx, transitions, texts, aspect, music })
    applyDoc(prev)
    lastCommit.current = { key: '', t: 0 } // a fresh edit after undo starts a new step
    setCanUndo(undoRef.current.length > 0); setCanRedo(true)
  }
  const redo = () => {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push({ segments, globalFx, transitions, texts, aspect, music })
    applyDoc(next)
    lastCommit.current = { key: '', t: 0 }
    setCanUndo(true); setCanRedo(redoRef.current.length > 0)
  }
  // ---- ④-E clip split ------------------------------------------------------
  // ★The RULE is lib/edl-split.ts, not here: a rule inside a component is a rule no
  // test can execute (same reason text-track-lanes / music-picker-scope exist). This
  // holds only the wiring and the refusal message.
  const [splitNote, setSplitNote] = useState<SplitReason | null>(null)
  const splitPoint = useMemo(() => splitPointFromPlayhead(segments, playheadMs), [segments, playheadMs])
  // Enabled only when a split would actually succeed, so the button is not an offer
  // that fails. The refusal path still exists for the keyboard route.
  const canSplit = useMemo(() => {
    if (!splitPoint) return false
    return splitSegmentAt(segments, transitions, splitPoint.index, splitPoint.sourceCutMs, {
      maxClips: props.maxClips,
      newUid: () => 'probe',
    }).ok
  }, [segments, transitions, splitPoint, props.maxClips])

  const splitAtPlayhead = () => {
    if (!splitPoint) { setSplitNote('cut_outside'); return }
    const res = splitSegmentAt(segments, transitions, splitPoint.index, splitPoint.sourceCutMs, {
      maxClips: props.maxClips,
      newUid: nextUid,
    })
    if (!res.ok) { setSplitNote(res.reason); return }
    // ★ONE commit, and NOT coalesced. The segment insert and the transition shift must
    // undo together, and two splits in a row must be two undo steps -- 2026-08-02 had a
    // coalesce key that made one undo revert two separate edits.
    commit('split')
    setSegments(res.segments)
    setTransitions(res.transitions)
    setSel(res.selectUid)
    setSplitNote(null)
  }

  // ---- text/title overlay helpers -------------------------------------------
  const addText = () => {
    if (texts.length >= TEXT_LIMITS.MAX_TEXTS || totalMs <= 0) return
    const end = Math.min(totalMs, 4000)
    const layer: TextLayer = {
      content: t.text_default, font: 'pretendard', sizePct: 8, color: '#ffffff',
      align: 'center', xNorm: 0.5, yNorm: 0.8, startMs: 0, endMs: end, fadeInMs: 300, fadeOutMs: 300,
    }
    commit('text-add')
    setTexts((ts) => [...ts, layer])
    setSelText(texts.length)
  }
  // patch a layer; pass coalesceKey (e.g. 'text-size') for continuous drags so a
  // slide collapses into one undo step (mirrors the effect sliders).
  //
  // ★THE KEY CARRIES THE LAYER INDEX, like every other per-item key in this file
  // (`trim:${uid}:${edge}`, `fx:${uid}:${key}`, `spd:${uid}`). Text was the one
  // exception, and it cost an undo step: two layers dragged within COALESCE_MS
  // shared the key, so the second edit merged into the first and one undo
  // reverted BOTH -- back to the state before either. Hard to reach while the
  // only way to move a window was the inspector's slider on the single selected
  // layer; easy the moment the caption track put every layer's bar on screen at
  // once, which is exactly what it is for.
  // The intended merge is unaffected: the bar edge and the inspector slider act
  // on the same layer, so they still produce the same key and stay one step.
  const updateText = (i: number, patch: Partial<TextLayer>, coalesceKey?: string) => {
    commit(coalesceKey ? `${coalesceKey}:${i}` : 'text-edit', !!coalesceKey)
    setTexts((ts) => ts.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  }
  const removeText = (i: number) => {
    commit('text-remove')
    setTexts((ts) => ts.filter((_, k) => k !== i))
    setSelText((cur) => (cur === i ? null : cur !== null && cur > i ? cur - 1 : cur))
  }

  // one-time keydown listener reaches the latest undo/redo via refs (assigned in
  // an effect, not during render).
  const undoFn = useRef(undo)
  const redoFn = useRef(redo)
  const togglePlayFn = useRef<() => void>(() => {})
  useEffect(() => { undoFn.current = undo; redoFn.current = redo; togglePlayFn.current = togglePlay })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      const onControl = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON'
      // Space toggles play/pause (editor standard). Ignored while typing or on a
      // focused control, so it never nudges a slider or re-clicks a button.
      if ((e.key === ' ' || e.code === 'Space') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (onControl) return
        e.preventDefault(); togglePlayFn.current(); return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      if (tag === 'TEXTAREA' || tag === 'SELECT') return // preserve native editing
      if (tag === 'INPUT' && (el as HTMLInputElement).type !== 'range') return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoFn.current() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoFn.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- effect UI (E): per-clip + global, neutral(0) default -----------------
  const [fxTab, setFxTab] = useState<'clip' | 'global'>('clip')
  const setSegFx = (uid: string, key: keyof EffectParams, val: number) => {
    commit(`fx:${uid}:${key}`, true)
    setSegments((s) => s.map((x) => (x.uid === uid ? { ...x, effects: { ...x.effects, [key]: val } } : x)))
  }
  // ★D keyframes. track=undefined removes the field (reverts to the static
  // effects[key] value) -- the OFF toggle path.
  const setSegKeyframe = (uid: string, key: keyof EffectParams, track: KeyframeTrack | undefined) => {
    commit(`kf:${uid}:${key}`)
    setSegments((s) => s.map((x) => {
      if (x.uid !== uid) return x
      const kf = { ...x.keyframes }
      if (track) kf[key] = track
      else delete kf[key]
      return { ...x, keyframes: kf }
    }))
  }
  // Toggle keyframing for one field on the selected clip. ON seeds 2 points at
  // the current static value (no jump on entry). OFF drops the track --
  // effects[key] is untouched, so it reads back the value the track was
  // seeded from (or whatever a later plain slider edit set it to).
  const toggleKeyframe = (key: keyof EffectParams) => {
    if (!selSeg) return
    if (selSeg.keyframes?.[key]) { setSegKeyframe(selSeg.uid, key, undefined); return }
    const val = Number(selSeg.effects?.[key]) || 0
    const span = Math.max(1, selSeg.endMs - selSeg.startMs)
    setSegKeyframe(selSeg.uid, key, { points: [{ atMs: 0, value: val }, { atMs: span, value: val }] })
  }
  const setSegLut = (uid: string, lut: string) => {
    commit(`lut:${uid}`)
    setSegments((s) => s.map((x) => (x.uid === uid ? { ...x, effects: { ...x.effects, lut } } : x)))
  }
  const setSegSpeed = (uid: string, speed: number) => {
    commit(`spd:${uid}`, true)
    setSegments((s) => s.map((x) => (x.uid === uid ? { ...x, speed } : x)))
  }
  // Per-clip fill mode for the output aspect: cover = crop-fill, contain = letterbox.
  const setSegFit = (uid: string, fit: 'contain' | 'cover') => {
    commit(`fit:${uid}`)
    setSegments((s) => s.map((x) => (x.uid === uid ? { ...x, fit } : x)))
  }
  // ---- music bed helpers ----------------------------------------------------
  const pickMusic = (assetId: string, source: 'library' | 'ai') => {
    commit('music-pick')
    setMusic({ assetId, source, volume: 70, clipVolume: 40, startMs: 0, endMs: totalMs || undefined, fadeInMs: 500, fadeOutMs: 500 })
  }
  const updateMusic = (patch: Partial<MusicBed>, coalesceKey?: string) => {
    if (!music) return
    commit(coalesceKey ?? 'music-edit', !!coalesceKey)
    setMusic({ ...music, ...patch })
  }
  const removeMusic = () => { commit('music-remove'); setMusic(null) }
  // AI music generation (Stage 6). Enqueue -> poll the asset to ready/failed;
  // on ready, merge it into the picker + auto-select. Refund on failure is
  // server-side (refundMusicGeneration) -- the UI just surfaces the outcome.
  const genMusic = async () => {
    if (!props.onGenerateMusic || !props.pollMusic || aiState === 'generating') return
    if (musicCapReached) { setAiState('error'); setAiError(t.music_ai_cap_reached); return }
    const prompt = aiPrompt.trim()
    if (!prompt) { setAiState('error'); setAiError(t.music_ai_reason('music_prompt_empty')); return }
    setAiState('generating'); setAiError(null)
    // Request a track that covers the composition (server caps via config).
    const reqDur = Math.max(1, Math.ceil((totalMs || props.maxSeconds * 1000) / 1000))
    const res = await props.onGenerateMusic(prompt, reqDur)
    if (!res.ok) { setAiState('error'); setAiError(t.music_ai_reason(res.error)); return }
    // A slot is consumed the moment the row is enqueued -- a queued/generating
    // bed occupies the cap server-side too, so the counter must not wait for
    // 'ready'. A failed generation is refunded AND frees its slot on reload.
    setAiGenerated((n) => n + 1)
    const assetId = res.assetId
    const poll = async () => {
      const st = await props.pollMusic!(assetId)
      if (!st) { setAiState('error'); setAiError(t.music_ai_reason('failed')); return }
      if (st.status === 'ready' && st.url) {
        setExtraMusic((prev) =>
          prev.some((a) => a.id === assetId)
            ? prev
            : [...prev, { id: assetId, url: st.url as string, title: st.title || t.music_ai_default_title, mood: st.mood || 'AI', source: 'ai' }],
        )
        pickMusic(assetId, 'ai')
        setAiState('idle'); setAiPrompt('')
        return
      }
      if (st.status === 'failed') { setAiState('error'); setAiError(t.music_ai_reason(st.error || 'failed')); return }
      aiPollRef.current = setTimeout(() => { void poll() }, 3000) // still queued/generating
    }
    aiPollRef.current = setTimeout(() => { void poll() }, 3000)
  }
  const setGlobalKey = (key: keyof EffectParams, val: number) => { commit(`gfx:${key}`, true); setGlobalFx((g) => ({ ...g, [key]: val })) }
  const setGlobalLut = (lut: string) => { commit('glut'); setGlobalFx((g) => ({ ...g, lut })) }
  const setBoundaryTransition = (afterIndex: number, type: string) => {
    commit(`tr:${afterIndex}`)
    setTransitions((tr) => {
      const rest = tr.filter((x) => x.afterIndex !== afterIndex)
      return type ? [...rest, { afterIndex, type, durationMs: 500 }].sort((a, b) => a.afterIndex - b.afterIndex) : rest
    })
  }
  const resetClipFx = (uid: string) => {
    commit(`rcf:${uid}`)
    setSegments((s) => s.map((x) => (x.uid === uid ? { ...x, effects: undefined, speed: undefined } : x)))
  }
  const resetGlobalFx = () => { commit('rgf'); setGlobalFx({}) }
  // live-apply while a preview is playing so sliders update WYSIWYG immediately
  // (update refs in place -- do NOT restart playback).
  useEffect(() => {
    if (playing) engineRef.current?.update?.(segments, previewClips, globalFx, transitions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, globalFx, transitions])

  // ---- render + poll (reused) -----------------------------------------------
  const doRender = async () => {
    setErr(null); setBusy(true); setSubmitDone(false); setSubmitErr(null); setRenderId(null)
    setRenderState({ status: 'queued', videoUrl: null, totalSeconds: totalSec })
    // Send EDL v2 (effects/transitions/global) so the worker applies them and the
    // composed final matches the WYSIWYG preview. No effects -> bare v1 array (keeps
    // the edl1 hash + the existing effect-free render path).
    // Pre-validate text layers with the SAME rules the server enforces, so a bad
    // layer (e.g. size < 5%) is explained inline before a round-trip.
    const tv = validateTexts(texts, totalMs, aspect)
    if (!tv.ok) {
      setErr(tv.index >= 0 ? `${t.text_reason(tv.reason)} (${t.text_layer_n(tv.index + 1)})` : t.text_reason(tv.reason))
      setRenderState(null); setBusy(false); return
    }
    // EDL v2 when the composition carries effects OR text; else a bare v1 array
    // (keeps the edl1 hash + effect-free render path). Text is signed via the TX
    // section of the v2 canonical (append-only -> text-free hashes unchanged).
    const isV2 = compositionHasEffects || texts.length > 0 || !!aspect || !!music
    const edl = isV2
      ? {
          version: 2 as const,
          segments: segments.map((s) => ({
            jobId: s.jobId, startMs: s.startMs, endMs: s.endMs,
            ...(s.speed !== undefined && Math.round(s.speed * 1000) !== 1000 ? { speed: s.speed } : {}),
            ...(hasAnyEffect(s.effects) ? { effects: s.effects } : {}),
            ...(s.fit === 'cover' ? { fit: 'cover' as const } : {}),
            ...(hasAnyKeyframes(s) ? { keyframes: s.keyframes } : {}),
          })),
          ...(transitions.length ? { transitions: transitions.map((tr) => ({ afterIndex: tr.afterIndex, type: tr.type, durationMs: tr.durationMs })) } : {}),
          ...(hasAnyEffect(globalFx) ? { global: globalFx } : {}),
          ...(texts.length ? { texts } : {}),
          ...(aspect ? { aspect } : {}),
          ...(music ? { music } : {}),
        }
      : segments.map((s) => ({ jobId: s.jobId, startMs: s.startMs, endMs: s.endMs }))
    const res = await props.onRender(edl)
    if (!res.ok) {
      // Map a server text-reason to a friendly message; other reasons pass through.
      const textReasons = ['too_many_texts', 'text_content', 'text_font', 'text_size', 'text_color', 'text_stroke', 'text_align', 'text_pos', 'text_window', 'text_fade', 'text_trademark']
      setErr(textReasons.includes(res.error) ? t.text_reason(res.error as TextReason) : res.error)
      setRenderState(null); setBusy(false); return
    }
    setRenderId(res.renderId)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, props.demo ? 600 : 2500))
      const st = await props.pollRender(res.renderId)
      if (!st) continue
      setRenderState(st)
      if (st.status === 'ready' || st.status === 'failed') break
    }
    setBusy(false)
  }

  // ---- submit (reused: moderation + crypto happen server-side) --------------
  const ctx: ComposeSubmitCtx | undefined = props.submitCtx
  const needInfo = ctx?.needsApplicantInfo ?? false
  const sMin = ctx?.statementMin ?? 150
  const sMax = ctx?.statementMax ?? 250
  const stmtLen = ap.creatorStatement.trim().length
  const infoValid = !needInfo || (stmtLen >= sMin && stmtLen <= sMax && ap.agreedRules && ap.agreedPrivacy && ap.agreedIntegrity)
  // ★The server's own list, imported -- not a copy of it. The copy is what made
  // every asynchronous submission path unreachable on 2026-07-31.
  const renderSubmittable = !!renderId && !!renderState && isSubmittableRenderStatus(renderState.status)
  const canSubmit =
    !!props.onSubmit && renderSubmittable && !submitting && !submitDone && infoValid && !ctx?.alreadySubmitted && !accepted
  const doSubmit = async () => {
    if (!props.onSubmit || !renderId) return
    setSubmitErr(null); setSubmitting(true)
    const applicant: ComposeApplicant | undefined = needInfo
      ? { creatorName: '', creatorStatement: ap.creatorStatement.trim(), agreedRules: ap.agreedRules, agreedPrivacy: ap.agreedPrivacy, agreedIntegrity: ap.agreedIntegrity }
      : undefined
    const res = await props.onSubmit(renderId, applicant)
    if (res.ok) {
      setSubmitDone(true)
      // A ready render is accepted AND finalized in the same call (the synchronous
      // path is preserved); anything else is accepted only, and the buffer's sweep --
      // or the poll below, which self-finalizes -- completes it.
      const finalizedNow = renderState?.status === 'ready' && !!renderState.videoUrl
      setAccepted({
        acceptedAt: new Date().toISOString(),
        finalized: finalizedNow,
        renderId,
        renderStatus: renderState?.status ?? null,
        state: finalizedNow ? 'finalized' : 'intent',
      })
    } else setSubmitErr(res.error)
    setSubmitting(false)
  }

  // ★Buffer poll. While a submission is accepted but not finalized, keep the render
  // status live -- and, because pollRender self-finalizes an owner's ready render, this
  // is also what turns "processing" into "submitted" without waiting for the hourly
  // tick. Deliberately slow: this runs for as long as the page is open.
  const acceptedRenderId = accepted?.renderId ?? null
  const acceptedFinalized = accepted?.finalized ?? false
  useEffect(() => {
    const rid = acceptedRenderId
    if (!rid || acceptedFinalized) return
    let alive = true
    const tick = async () => {
      const st = await props.pollRender(rid)
      if (!alive || !st) return
      setRenderState(st)
      setAccepted((a) => (a ? { ...a, finalized: !!st.finalized, renderStatus: st.status } : a))
    }
    void tick()
    const iv = setInterval(tick, props.demo ? 1500 : 10000)
    return () => { alive = false; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedRenderId, acceptedFinalized])
  // ★Keep a RESUMED in-flight render moving. The buffer poll above only runs once
  // a submission has been accepted; a render picked up from a reload has not been
  // submitted yet, so without this it would sit at 'queued' on screen until the
  // participant reloaded again -- and the submit control, though reachable, would
  // never turn into a preview.
  const liveRenderId = renderId
  const liveRenderStatus = renderState?.status ?? null
  useEffect(() => {
    if (!liveRenderId || accepted) return
    if (liveRenderStatus !== 'queued' && liveRenderStatus !== 'rendering' && liveRenderStatus !== 'uploading') return
    let alive = true
    const tick = async () => {
      const st = await props.pollRender(liveRenderId)
      if (!alive || !st) return
      setRenderState(st)
    }
    const iv = setInterval(tick, props.demo ? 1500 : 10000)
    return () => { alive = false; clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRenderId, liveRenderStatus, accepted])

  const doDeleteRender = async () => {
    if (!props.onDelete || !renderId) return
    if (typeof window !== 'undefined' && !window.confirm(t.delete_final_confirm)) return
    setDeleting(true)
    const res = await props.onDelete(renderId)
    setDeleting(false)
    if (res.ok) { setRenderState(null); setRenderId(null); setSubmitErr(null) }
    else setSubmitErr(res.error)
  }

  // ---- UI helpers -----------------------------------------------------------
  const paneHead = 'text-[11px] uppercase tracking-[0.2em] text-[#b66cff] font-bold'
  const renderReady = renderState?.status === 'ready' && !!renderState.videoUrl
  const isRendering = busy && !!renderState && renderState.status !== 'ready' && renderState.status !== 'failed'
  // Accepted-and-still-processing: the panel below replaces the whole render/submit
  // area. Once finalized it falls through to the ordinary "submitted" message.
  const inBuffer = !!accepted && !accepted.finalized
  const acceptedAtLabel = accepted ? new Date(accepted.acceptedAt).toLocaleString(props.lang === 'ko' ? 'ko-KR' : 'en-US') : ''
  // Only these two states mean "something went wrong"; every other state during the
  // buffer is ordinary queueing. finalize_rejected / render_overdue are staff-review
  // paths, so they read the same as a failure to the participant -- never an accusation,
  // and never a loss of standing.
  const bufferTrouble =
    accepted?.state === 'render_failed' || accepted?.state === 'render_overdue' || accepted?.state === 'finalize_rejected'
  const bufferRetrying = accepted?.state === 'render_requeued'

  return (
    <div className="flex flex-col gap-3">
      {/* ★RESTORE BANNER. A stalled render that the lease sweep gave up on becomes
          'failed', which drops it out of resume -- correct, because resuming a dead
          row shows a render that will never finish, but it also empties the
          timeline. The clips were never at risk; only the arrangement was, and the
          first line says exactly that so nobody spends the round wondering what
          they lost. Shown only when the timeline actually came up empty. */}
      {restorable && !arrangementRestored && segments.length === 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#8b22ff]/35 bg-[#8b22ff]/8 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#d9b8ff]">{t.restore_title}</p>
            <p className="mt-0.5 text-[11px] text-white/60">{t.restore_body}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSegments(
                restorable.map((e) => ({
                  uid: nextUid(),
                  jobId: e.jobId,
                  startMs: e.startMs,
                  endMs: e.endMs,
                  fit: e.fit,
                })),
              )
              setArrangementRestored(true)
            }}
            className="rounded-lg border border-[#8b22ff]/50 px-3 py-1.5 text-xs font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/15">
            {t.restore_cta}
          </button>
        </div>
      )}
      {arrangementRestored && (
        <p className="rounded-xl border border-white/10 bg-[#08060f] px-4 py-2 text-[11px] text-white/55">{t.restore_done}</p>
      )}
      {/* 3-PANE: mobile vertical; lg = pool | preview (top), timeline full-width bottom */}
      <div className="flex flex-col gap-3 lg:grid lg:h-[calc(100vh-220px)] lg:min-h-[560px] lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_280px] lg:gap-3 lg:overflow-hidden">

        {/* PANE 1 — MEDIA POOL */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-1 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.pool}</h2>
            <span className="text-[10px] text-white/35">{pool.length} {t.clip}</span>
          </div>
          <div className="border-b border-white/8 px-3 py-2.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
              className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#8b22ff] focus:outline-none" />
          </div>
          <div ref={poolRef} onScroll={(e) => setPoolScroll(e.currentTarget.scrollTop)}
            className="min-h-[320px] overflow-y-auto p-3 lg:min-h-0 lg:flex-1">
            {pool.length === 0 ? (
              <p className="px-2 py-10 text-center text-[11px] text-white/35">{t.no_clips}</p>
            ) : (
              <div className="relative" style={{ height: poolRows * POOL_ROW_H }}>
                {visiblePool.map((c, i) => {
                  const idx = startRow * POOL_COLS + i
                  const row = Math.floor(idx / POOL_COLS)
                  const col = idx % POOL_COLS
                  return (
                    <div key={c.id} className="absolute p-1"
                      style={{ top: row * POOL_ROW_H, left: `${(col * 100) / POOL_COLS}%`, width: `${100 / POOL_COLS}%`, height: POOL_ROW_H }}>
                      <button draggable onDragStart={() => setDragUid(`pool_${c.id}`)} onClick={() => addClip(c)}
                        disabled={segments.length >= props.maxClips} title={c.prompt}
                        className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black text-left transition hover:border-[#8b22ff]/60 disabled:opacity-40">
                        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                          {/* real clip first frame (P6 swaps to thumbnail_url).
                              crossOrigin: the GL preview textures this SAME url, and a
                              no-cors thumbnail fetch would leave an opaque response in
                              that cache slot which can never serve the CORS request ->
                              tainted texture. One mode per url. See preview-gl.ts. */}
                          <video src={c.url} crossOrigin="anonymous" preload="metadata" muted playsInline className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-[#8b22ff]/0 text-[16px] font-black text-white opacity-0 transition group-hover:bg-[#8b22ff]/25 group-hover:opacity-100">＋</span>
                        </div>
                        <div className="flex items-center justify-between px-1.5 py-1 text-[9px] text-white/45">
                          <span className="truncate">{c.prompt.slice(0, 14) || t.clip}</span>
                          <span className="shrink-0 tabular-nums">{c.durationSeconds.toFixed(0)}{t.sec}</span>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* PANE 2 — PREVIEW */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-2 lg:row-start-1 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.preview}</h2>
            <div className="flex items-center gap-2">
              {/* output aspect selector -- the preview reframes immediately */}
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[.02] p-0.5" title={t.aspect_hint}>
                {(['16:9', '9:16'] as const).map((a) => (
                  <button key={a} type="button" onClick={() => { if (aspect !== a) { commit('aspect'); setAspect(a) } }}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${aspect === a ? 'bg-[#8b22ff]/25 text-[#d9b8ff]' : 'text-white/45 hover:text-white/70'}`}>{a}</button>
                ))}
              </div>
              <span className="text-[11px] font-bold text-[#b66cff]">{totalSec.toFixed(1)}{t.sec} · {segments.length} {t.clip}</span>
            </div>
          </div>
          <div onClick={onPreviewClick} onPointerDown={onPreviewPointerDown} onPointerMove={onPreviewPointerMove} onPointerUp={onPreviewPointerUp}
            title={segments.length ? (playing ? t.stop : t.play) : undefined}
            style={{ touchAction: selText !== null && segments.length ? 'none' : undefined }}
            className={`relative flex min-h-[220px] flex-1 items-center justify-center bg-black p-3 ${segments.length ? (selText !== null ? 'cursor-move' : 'cursor-pointer') : ''}`}>
            {/* Aspect box = the OUTPUT canvas. The video + GL canvas fill it and are
                letterboxed/cropped by object-fit (set per current clip by the engine),
                so the framing matches the worker render. The <video> stays mounted
                even when empty so the engine keeps its element ref. */}
            <div className={`absolute inset-0 m-auto overflow-hidden rounded-xl bg-black ${segments.length ? '' : 'hidden'}`}
              style={{ aspectRatio: aspect === '9:16' ? '9 / 16' : '16 / 9', maxWidth: '100%', maxHeight: '100%' }}>
              {/* GL engine opts into crossOrigin on this element itself and loads the
                  BARE clip url (R2 CORS applied on the bucket; the ?gl=1 cache key is
                  gone). It degrades to raw + an honest note on any CORS/media failure
                  -- a black preview is never shown. object-fit is owned by the engine
                  (per current clip) -- NOT set here, so a React re-render never
                  clobbers it. */}
              <video ref={videoRef} playsInline className="absolute inset-0 h-full w-full rounded-xl" />
              {/* Text overlay draws on the OUTPUT canvas (this box) -- over bars / crop
                  exactly as the render does. */}
              <TextOverlay texts={texts} playheadMs={playheadMs} visible={segments.length > 0} editingIndex={selText} />
              {curSeg?.fit === 'cover' && (
                <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">{t.crop_badge}</span>
              )}
            </div>
            {segments.length === 0 && <span className="text-xs text-white/30">{t.empty_prev}</span>}
          </div>
          {fxPreviewUnavailable && (
            <p className="border-t border-amber-400/20 bg-amber-400/5 px-4 py-2 text-[10px] leading-relaxed text-amber-300/90">
              ⚠ {t.fx_preview_off}
            </p>
          )}
          <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2.5">
            <button onClick={playing ? stopPreview : startPreview} disabled={!segments.length}
              className="rounded-lg border border-[#8b22ff]/50 px-3 py-1 text-xs font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-40">
              {playing ? `■ ${t.stop}` : `▶ ${t.play}`}
            </button>
            <span className="w-[74px] shrink-0 text-[10px] tabular-nums text-white/45">{(playheadMs / 1000).toFixed(1)} / {totalSec.toFixed(1)}{t.sec}</span>
            <div ref={scrubRef} onPointerDown={onScrubDown} onPointerMove={onScrubMove} onPointerUp={onScrubUp}
              className={`relative h-2 flex-1 rounded-full bg-white/10 ${segments.length ? 'cursor-pointer' : ''}`}>
              <div className={`pointer-events-none absolute inset-y-0 left-0 rounded-full ${over ? 'bg-[#ff6b6b]' : 'bg-[#8b22ff]'}`}
                style={{ width: `${playPct}%` }} />
              {segments.length > 0 && (
                <div className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)]"
                  style={{ left: `${playPct}%` }} />
              )}
            </div>
            {segments.length > 0 && (
              <button onClick={() => { commit('clear'); setSegments([]); setSel(null); setPlayheadMs(0); stopPreview() }} className="text-[10px] text-white/35 transition hover:text-[#ff8888]">{t.reset}</button>
            )}
          </div>
        </section>

        {/* PANE 3 — TIMELINE */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-span-3 lg:col-start-1 lg:row-start-2 lg:overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
            <div className="flex items-center gap-3">
              <h2 className={paneHead}>{t.timeline}</h2>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40">{t.single_track}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg border border-white/10 p-0.5">
                <button onClick={undo} disabled={!canUndo} title={`${t.undo} (Ctrl+Z)`}
                  className="flex h-6 w-6 items-center justify-center rounded text-[14px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">↶</button>
                <button onClick={redo} disabled={!canRedo} title={`${t.redo} (Ctrl+Shift+Z)`}
                  className="flex h-6 w-6 items-center justify-center rounded text-[14px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">↷</button>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-white/10 p-0.5" title={t.zoom_hint}>
                <button onClick={() => zoomBy(1 / 1.4)} disabled={pxPerSec <= ZOOM_MIN} title={t.zoom_out}
                  className="flex h-6 w-6 items-center justify-center rounded text-[15px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">−</button>
                <span className="w-[52px] text-center text-[10px] tabular-nums text-white/45">{Math.round(pxPerSec)}px/s</span>
                <button onClick={() => zoomBy(1.4)} disabled={pxPerSec >= ZOOM_MAX} title={t.zoom_in}
                  className="flex h-6 w-6 items-center justify-center rounded text-[15px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">+</button>
                <button onClick={fitZoom} disabled={!segments.length} title={t.fit}
                  className="ml-0.5 flex h-6 items-center rounded px-1.5 text-[10px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30">{t.fit}</button>
              </div>
              {/* ★④-E split at the playhead. Disabled unless the split would actually
                  succeed -- and the title says WHY when it would not, because a dead
                  control with no reason reads as a broken editor. */}
              <button type="button" onClick={splitAtPlayhead} disabled={!canSplit}
                title={canSplit ? t.split_hint : splitPoint ? t.split_why(splitNote ?? 'too_many_clips', props.maxClips) : t.split_need_inside}
                className="flex h-6 items-center rounded border border-white/10 px-2 text-[10px] font-bold text-white/60 transition hover:border-white/30 hover:text-white disabled:opacity-30">
                {t.split}
              </button>
              <span className="text-[10px] text-white/30">{t.clip_count(segments.length, props.maxClips)}</span>
            </div>
            {splitNote && (
              <p className="mt-1 text-[10px] text-amber-300/80">{t.split_why(splitNote, props.maxClips)}</p>
            )}
          </div>
          <div ref={tlRef} className="min-h-[150px] flex-1 overflow-x-auto p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragUid?.startsWith('pool_')) { const id = dragUid.slice(5); const c = clipById.get(id); if (c) addClip(c) } setDragUid(null) }}
            onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15) } }}>
            <div style={{ width: segments.length ? trackW : undefined, minWidth: '100%' }}>
              {segments.length > 0 && (
                <div className="relative mb-1 h-4 select-none">
                  {Array.from({ length: Math.floor(totalSec / tickSec) + 1 }, (_, k) => k * tickSec).map((tick) => (
                    <span key={tick} className="absolute top-0 h-4 border-l border-white/10 pl-1 text-[8px] tabular-nums text-white/30" style={{ left: tick * pxPerSec }}>
                      {tick}{t.sec}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex h-24 items-stretch gap-1">
                {segments.map((s, i) => {
                  const segMs = s.endMs - s.startMs
                  return (
                    <div key={s.uid} data-seg draggable
                      onDragStart={(e) => { if (trim.current) { e.preventDefault(); return } setDragUid(s.uid) }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.stopPropagation(); if (dragUid && !dragUid.startsWith('pool_')) reorderTo(dragUid, s.uid); setDragUid(null) }}
                      onClick={() => { setSel(s.uid); movePlayhead(segStarts[i]) }}
                      style={{ width: Math.max(20, (segMs / 1000) * pxPerSec) }}
                      className={`group relative flex shrink-0 cursor-grab items-center justify-center overflow-hidden rounded-lg border bg-[#141021] text-[10px] transition ${
                        sel === s.uid ? 'border-[#b66cff] ring-1 ring-[#8b22ff]' : dragUid === s.uid ? 'border-[#8b22ff]' : 'border-[#8b22ff]/25 hover:border-[#8b22ff]/70'
                      }`}>
                      <span onPointerDown={(e) => onTrimDown(e, s, 'start')} onPointerMove={onTrimMove} onPointerUp={onTrimUp}
                        className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize rounded-l-lg bg-[#8b22ff]/50 opacity-0 transition group-hover:opacity-100" />
                      <span className="pointer-events-none flex flex-col items-center text-white/70">
                        <span className="font-bold">{i + 1}</span>
                        <span className="text-[9px] text-white/45 tabular-nums">{fmt(segMs)}{t.sec}</span>
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); removeSeg(s.uid) }} title={t.remove}
                        className="absolute right-1 top-1 z-10 rounded bg-black/40 px-1 text-[10px] text-white/50 opacity-0 transition hover:text-[#ff8888] group-hover:opacity-100">×</button>
                      <span onPointerDown={(e) => onTrimDown(e, s, 'end')} onPointerMove={onTrimMove} onPointerUp={onTrimUp}
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize rounded-r-lg bg-[#8b22ff]/50 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  )
                })}
                {segments.length === 0 && (
                  <div className="flex min-w-full flex-1 items-center justify-center rounded-lg border border-dashed border-white/12 text-[11px] text-white/25">{t.drag_here}</div>
                )}
              </div>
              {/* Caption track. Inside this width:trackW box on purpose -- it then
                  shares the ruler's time axis and inherits zoom + h-scroll. */}
              {segments.length > 0 && (
                <TextTrack
                  texts={texts} totalMs={totalMs} pxPerSec={pxPerSec}
                  selectedIndex={selText} playheadMs={playheadMs} boundariesMs={segStarts}
                  labels={{ title: t.tt_title, none: t.tt_none, hint: t.tt_hint, move: t.tt_move, trimStart: t.tt_trim_s, trimEnd: t.tt_trim_e }}
                  onSelect={setSelText}
                  onWindow={(i, patch, key) => updateText(i, patch, key)} />
              )}
            </div>
            <p className="mt-3 text-[10px] text-white/30">{t.tl_hint}</p>
          </div>
        </section>

        {/* PANE 4 -- EFFECTS INSPECTOR. Right sidebar so the preview stays visible
            while sliders are adjusted (the WYSIWYG loop); its own scroll means the
            panel never pushes the preview off-screen. Timeline spans the row below. */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#08060f] lg:col-start-3 lg:row-start-1 lg:min-h-0 lg:overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/8 px-3.5 py-2.5">
            <h2 className={paneHead}>{t.fx_title}</h2>
            {segments.length > 0 && (
              <div className="ml-auto inline-flex rounded-lg border border-white/10 bg-white/[.02] p-0.5">
                {([['clip', t.fx_clip], ['global', t.fx_global]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFxTab(id)}
                    className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold transition ${fxTab === id ? 'bg-[#8b22ff]/25 text-[#d9b8ff]' : 'text-white/45 hover:text-white/70'}`}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {segments.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-white/35">{t.empty_prev}</p>
            ) : (
              <>
                {fxTab === 'clip' && !selSeg && <p className="py-4 text-center text-[11px] text-white/35">{t.fx_no_clip}</p>}

                {(fxTab === 'global' || selSeg) && (() => {
                  const fx: EffectParams = (fxTab === 'clip' ? selSeg!.effects : globalFx) ?? {}
                  const setKey = (k: keyof EffectParams, v: number) => (fxTab === 'clip' ? setSegFx(selSeg!.uid, k, v) : setGlobalKey(k, v))
                  const setLut = (l: string) => (fxTab === 'clip' ? setSegLut(selSeg!.uid, l) : setGlobalLut(l))
                  const grainOn = (Number(fx.grain) || 0) > 0
                  return (
                    <div className="space-y-3">
                      {/* LUT */}
                      <label className="block">
                        <span className="text-[11px] text-white/55">{t.fx_lut}</span>
                        <select value={(fx.lut as string) || ''} onChange={(e) => setLut(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-1.5 text-xs text-white focus:border-[#8b22ff] focus:outline-none">
                          {LUT_OPTIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                      </label>
                      {/* sliders */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {EXPOSED_SLIDERS.map((spec) => {
                          const val = Number(fx[spec.key]) || 0
                          // ★D keyframes: only per-clip (global carries no keyframe map, data
                          // model decision), only the 4 ffmpeg-eval-capable params.
                          const canKeyframe = fxTab === 'clip' && !!selSeg && KEYFRAME_KEYS.includes(spec.key)
                          const kfTrack = canKeyframe ? selSeg!.keyframes?.[spec.key] : undefined
                          return (
                            <label key={spec.key} className="block">
                              <span className="flex items-center justify-between text-[11px] text-white/55">
                                <span className="flex items-center gap-1">
                                  {spec.label}{spec.parity === 'approximate' && <span className="ml-1 rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold text-amber-300">{t.approx_badge}</span>}
                                  {canKeyframe && (
                                    <button type="button" onClick={() => toggleKeyframe(spec.key)}
                                      title="Keyframe" aria-pressed={!!kfTrack}
                                      className={`ml-0.5 text-[10px] leading-none transition ${kfTrack ? 'text-[#8b22ff]' : 'text-white/25 hover:text-white/55'}`}>
                                      ◆
                                    </button>
                                  )}
                                </span>
                                <span className="tabular-nums text-white/35">{val}</span>
                              </span>
                              {kfTrack ? (
                                <KeyframeMiniTrack track={kfTrack} min={spec.min} max={spec.max} spanMs={selSeg!.endMs - selSeg!.startMs}
                                  onChange={(next) => setSegKeyframe(selSeg!.uid, spec.key, next)} />
                              ) : (
                                <input type="range" min={spec.min} max={spec.max} value={val} onChange={(e) => setKey(spec.key, Number(e.target.value))}
                                  onDoubleClick={() => { lastCommit.current = { key: '', t: 0 }; setKey(spec.key, 0) }} title={t.dbl_default}
                                  className="w-full accent-[#8b22ff]" />
                              )}
                            </label>
                          )
                        })}
                        {/* per-clip speed */}
                        {fxTab === 'clip' && (
                          <label className="block">
                            <span className="flex items-center justify-between text-[11px] text-white/55">
                              <span>{t.fx_speed}</span><span className="tabular-nums text-white/35">{(selSeg!.speed ?? 1).toFixed(2)}x</span>
                            </span>
                            <input type="range" min={0.25} max={4} step={0.05} value={selSeg!.speed ?? 1} onChange={(e) => setSegSpeed(selSeg!.uid, Number(e.target.value))}
                              onDoubleClick={() => { lastCommit.current = { key: '', t: 0 }; setSegSpeed(selSeg!.uid, 1) }} title={t.dbl_default}
                              className="w-full accent-[#8b22ff]" />
                          </label>
                        )}
                      </div>
                      {/* per-clip fill mode for the output aspect (letterbox / crop) */}
                      {fxTab === 'clip' && (
                        <div className="rounded-lg border border-white/10 bg-white/[.02] px-2.5 py-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white/55">{t.fit_label} <span className="text-white/30">({aspect})</span></span>
                            <div className="inline-flex rounded-lg border border-white/10 p-0.5">
                              {([['contain', t.fit_contain], ['cover', t.fit_cover]] as const).map(([f, lbl]) => (
                                <button key={f} type="button" onClick={() => setSegFit(selSeg!.uid, f)}
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${(selSeg!.fit ?? 'contain') === f ? 'bg-[#8b22ff]/25 text-[#d9b8ff]' : 'text-white/45 hover:text-white/70'}`}>{lbl}</button>
                              ))}
                            </div>
                          </div>
                          <p className="mt-1 text-[9px] leading-tight text-white/35">{selSeg!.fit === 'cover' ? t.fit_cover_hint : t.fit_contain_hint}</p>
                        </div>
                      )}
                      {grainOn && <p className="text-[10px] text-amber-300/80">⚠ {t.approx_note}</p>}
                      <div className="flex justify-end pt-1">
                        <button type="button"
                          onClick={() => (fxTab === 'clip' ? resetClipFx(selSeg!.uid) : resetGlobalFx())}
                          disabled={fxTab === 'clip'
                            ? !hasAnyEffect(selSeg!.effects) && (selSeg!.speed === undefined || Math.round(selSeg!.speed * 1000) === 1000)
                            : !hasAnyEffect(globalFx)}
                          className="text-[10px] text-white/40 transition hover:text-[#ff8888] disabled:opacity-30">
                          ↺ {fxTab === 'clip' ? t.fx_reset_clip : t.fx_reset_global}
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* transitions between clips */}
                {segments.length > 1 && (
                  <div className="mt-4 border-t border-white/8 pt-3">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-white/45">{t.fx_transitions}</p>
                    <div className="flex flex-wrap gap-2">
                      {segments.slice(0, -1).map((_, i) => {
                        const cur = transitions.find((x) => x.afterIndex === i)
                        return (
                          <label key={i} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.02] px-2 py-1">
                            <span className="text-[10px] text-white/45">{t.fx_between(i + 1, i + 2)}</span>
                            <select value={cur?.type ?? ''} onChange={(e) => setBoundaryTransition(i, e.target.value)}
                              className="rounded border border-white/10 bg-[#070610] px-1.5 py-0.5 text-[11px] text-white focus:border-[#8b22ff] focus:outline-none">
                              <option value="">{t.fx_no_trans}</option>
                              {EXPOSED_TRANSITIONS.map((tr) => <option key={tr.id} value={tr.id}>{tr.label}</option>)}
                            </select>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* text/title overlays */}
                <div className="mt-4 border-t border-white/8 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-white/45">{t.text_title}</p>
                    <button type="button" onClick={addText} disabled={texts.length >= TEXT_LIMITS.MAX_TEXTS}
                      className="rounded-md border border-[#8b22ff]/50 px-2 py-0.5 text-[10px] font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10 disabled:opacity-30">{t.text_add}</button>
                  </div>
                  {texts.length >= TEXT_LIMITS.MAX_TEXTS && <p className="mb-1 text-[10px] text-amber-300/70">{t.text_max(TEXT_LIMITS.MAX_TEXTS)}</p>}
                  {texts.length === 0 ? (
                    <p className="py-2 text-[11px] text-white/35">{t.text_none}</p>
                  ) : (
                    <>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {texts.map((l, i) => (
                          <button key={i} type="button" onClick={() => setSelText(i === selText ? null : i)} title={l.content}
                            className={`max-w-[130px] truncate rounded-md border px-2 py-1 text-[10px] transition ${i === selText ? 'border-[#b66cff] bg-[#8b22ff]/15 text-[#d9b8ff]' : 'border-white/10 text-white/55 hover:border-[#8b22ff]/50'}`}>
                            {l.content.split('\n')[0] || t.text_layer_n(i + 1)}
                          </button>
                        ))}
                      </div>
                      {selText !== null && texts[selText] && (() => {
                        const l = texts[selText]
                        const up = (patch: Partial<TextLayer>, key?: string) => updateText(selText, patch, key)
                        const span = l.endMs - l.startMs
                        const strokeOn = !!l.strokeColor && (l.strokePct ?? 0) > 0
                        const GRID_X: [number, TextLayer['align']][] = [[0.06, 'left'], [0.5, 'center'], [0.94, 'right']]
                        const GRID_Y = [0.1, 0.45, 0.82]
                        // ★Dynamic size cap. The slider stops where the text stops
                        // fitting THIS aspect, so a participant cannot drag into a
                        // value the server will reject. Nothing else is clamped --
                        // position and content stay exactly as they were set.
                        const canvas = TEXT_CANVAS[aspect] ?? TEXT_CANVAS['9:16']
                        const sizeCap = maxFittingSizePct(l, canvas[0], canvas[1], TEXT_LIMITS.MIN_SIZE_PCT, TEXT_LIMITS.MAX_SIZE_PCT)
                        return (
                          <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[.02] p-2.5">
                            {/* content */}
                            <label className="block">
                              <span className="text-[11px] text-white/55">{t.text_content}</span>
                              <textarea value={l.content} rows={2} maxLength={TEXT_LIMITS.MAX_CONTENT_LEN} placeholder={t.text_content_ph}
                                onChange={(e) => up({ content: e.target.value }, 'text-content')}
                                className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-[#070610] px-2.5 py-1.5 text-xs text-white focus:border-[#8b22ff] focus:outline-none" />
                            </label>
                            {/* font */}
                            <div>
                              <span className="text-[11px] text-white/55">{t.text_font}</span>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {FONT_SPECS.map((f) => (
                                  <button key={f.id} type="button" onClick={() => up({ font: f.id })}
                                    style={{ fontFamily: `"${f.family}"` }}
                                    className={`rounded-md border px-2.5 py-1 text-[12px] transition ${l.font === f.id ? 'border-[#b66cff] bg-[#8b22ff]/15 text-white' : 'border-white/10 text-white/55 hover:border-[#8b22ff]/50'}`}>
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* size + color */}
                            <div className="grid grid-cols-2 gap-3">
                              <label className="block">
                                <span className="flex items-center justify-between text-[11px] text-white/55">
                                  <span>{t.text_size}</span><span className="tabular-nums text-white/35">{Math.round(l.sizePct)}%</span>
                                </span>
                                {/* ★Safe-cap MARKER, not a hard stop. Capping `max`
                                    at sizeCap desynced the thumb from the number:
                                    lower the text and the cap drops below the value
                                    already set, so the thumb pins at max while the
                                    readout still says 12%. Clamping the value would
                                    fix that by silently changing what the
                                    participant placed, which is the one thing we do
                                    not do. A tick keeps the thumb honest and shows
                                    where the frame stops. */}
                                <span className="relative mt-1 block">
                                  <input type="range" min={TEXT_LIMITS.MIN_SIZE_PCT} max={TEXT_LIMITS.MAX_SIZE_PCT} step={0.5} value={l.sizePct}
                                    onChange={(e) => up({ sizePct: Number(e.target.value) }, 'text-size')}
                                    className="w-full accent-[#8b22ff]" />
                                  {sizeCap !== null && sizeCap < TEXT_LIMITS.MAX_SIZE_PCT && (
                                    <span aria-hidden title={t.fit_cap(sizeCap)}
                                      className="pointer-events-none absolute top-0 h-3 w-px bg-[#ffd24a]"
                                      style={{ left: `${((sizeCap - TEXT_LIMITS.MIN_SIZE_PCT) / (TEXT_LIMITS.MAX_SIZE_PCT - TEXT_LIMITS.MIN_SIZE_PCT)) * 100}%` }} />
                                  )}
                                </span>
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-white/55">{t.text_color}</span>
                                <input type="color" value={l.color} onChange={(e) => up({ color: e.target.value }, 'text-color')}
                                  className="mt-1 h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent" />
                              </label>
                            </div>
                            <p className="text-[9px] leading-tight text-white/35">{t.text_size_floor(TEXT_LIMITS.MIN_SIZE_PCT)}</p>
                            <TextFitReadout layer={l} canvas={canvas} fonts={FONT_SPECS}
                              atSizeFloor={l.sizePct <= TEXT_LIMITS.MIN_SIZE_PCT}
                              labels={{
                                width: t.fit_w, height: t.fit_h, ok: t.fit_ok,
                                tooWide: t.text_reason('text_too_wide') ?? '', tooTall: t.text_reason('text_too_tall') ?? '',
                                fixSplit: t.fix_split, fixSmaller: t.fix_smaller, fixShorter: t.fix_shorter,
                                fixFont: t.fix_font, fixUp: t.fix_up, fixFewerLines: t.fix_fewer_lines,
                                noSizeFits: t.fix_none, missingGlyph: t.fix_glyph,
                              }} />
                            {/* stroke */}
                            <div className="grid grid-cols-2 items-end gap-3">
                              <label className="block">
                                <span className="flex items-center gap-1.5 text-[11px] text-white/55">
                                  <input type="checkbox" checked={strokeOn}
                                    onChange={(e) => up(e.target.checked ? { strokeColor: l.strokeColor || '#000000', strokePct: l.strokePct || 6 } : { strokePct: 0 })} />
                                  {t.text_stroke}
                                </span>
                                <input type="color" disabled={!strokeOn} value={l.strokeColor || '#000000'} onChange={(e) => up({ strokeColor: e.target.value }, 'text-stroke')}
                                  className="mt-1 h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent disabled:opacity-30" />
                              </label>
                              <label className="block">
                                <span className="flex items-center justify-between text-[11px] text-white/55">
                                  <span>{t.text_stroke_w}</span><span className="tabular-nums text-white/35">{l.strokePct ?? 0}</span>
                                </span>
                                <input type="range" min={0} max={TEXT_LIMITS.MAX_STROKE_PCT} value={l.strokePct ?? 0} disabled={!strokeOn}
                                  onChange={(e) => up({ strokePct: Number(e.target.value) }, 'text-stroke')}
                                  className="w-full accent-[#8b22ff] disabled:opacity-30" />
                              </label>
                            </div>
                            {/* align */}
                            <div>
                              <span className="text-[11px] text-white/55">{t.text_align}</span>
                              <div className="mt-1 inline-flex rounded-lg border border-white/10 p-0.5">
                                {([['left', t.text_align_l], ['center', t.text_align_c], ['right', t.text_align_r]] as const).map(([a, lbl]) => (
                                  <button key={a} type="button" onClick={() => up({ align: a })}
                                    className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold transition ${l.align === a ? 'bg-[#8b22ff]/25 text-[#d9b8ff]' : 'text-white/45 hover:text-white/70'}`}>{lbl}</button>
                                ))}
                              </div>
                            </div>
                            {/* position: 9-grid */}
                            <div>
                              <span className="text-[11px] text-white/55">{t.text_pos}</span>
                              <div className="mt-1 grid w-[84px] grid-cols-3 gap-0.5">
                                {GRID_Y.map((yy) => GRID_X.map(([xx, al]) => {
                                  const active = Math.abs(l.xNorm - xx) < 0.02 && Math.abs(l.yNorm - yy) < 0.02
                                  return (
                                    <button key={`${xx}-${yy}`} type="button" title={t.text_drag}
                                      onClick={() => up({ xNorm: xx, yNorm: yy, align: al })}
                                      className={`h-6 rounded-sm border transition ${active ? 'border-[#b66cff] bg-[#8b22ff]/30' : 'border-white/10 bg-white/[.03] hover:border-[#8b22ff]/50'}`} />
                                  )
                                }))}
                              </div>
                              <p className="mt-1 text-[9px] text-white/35">{t.text_pos_hint}</p>
                            </div>
                            {/* show window */}
                            <div>
                              <span className="flex items-center justify-between text-[11px] text-white/55">
                                <span>{t.text_window}</span>
                                <span className="tabular-nums text-white/35">{(l.startMs / 1000).toFixed(1)}–{(l.endMs / 1000).toFixed(1)}{t.sec}</span>
                              </span>
                              <div className="mt-1 space-y-1">
                                <input type="range" min={0} max={totalMs} step={100} value={l.startMs}
                                  onChange={(e) => up({ startMs: Math.min(Number(e.target.value), l.endMs - 100) }, 'text-start')}
                                  className="w-full accent-[#8b22ff]" />
                                <input type="range" min={0} max={totalMs} step={100} value={l.endMs}
                                  onChange={(e) => up({ endMs: Math.max(Number(e.target.value), l.startMs + 100) }, 'text-end')}
                                  className="w-full accent-[#8b22ff]" />
                              </div>
                            </div>
                            {/* fade -- opacityKeyframes (2026-08-10) is an "advanced" generalization
                                of fadeIn/fadeOutMs: same visual result (0->1->0 envelope), but an
                                arbitrary point count instead of a fixed 2-stage ramp. Mutually
                                exclusive at render time (text-render.ts's textAlphaAt), so the UI
                                only ever shows one or the other, never both. */}
                            {l.opacityKeyframes ? (
                              <div>
                                <span className="flex items-center justify-between text-[11px] text-white/55">
                                  <span>{t.text_fade} (advanced)</span>
                                  <button type="button" onClick={() => up({ opacityKeyframes: undefined }, 'text-opkf-off')}
                                    className="text-[10px] text-white/40 hover:text-white/70">↺ simple</button>
                                </span>
                                <KeyframeMiniTrack
                                  track={{ points: l.opacityKeyframes.points.map((p) => ({ atMs: p.atMs, value: p.value * 100 })) }}
                                  min={0} max={100} spanMs={span}
                                  onChange={(next) => up({ opacityKeyframes: { points: next.points.map((p) => ({ atMs: p.atMs, value: p.value / 100 })) } }, 'text-opkf')}
                                />
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <label className="block">
                                    <span className="flex items-center justify-between text-[11px] text-white/55">
                                      <span>{t.text_fade} {t.text_fade_in}</span><span className="tabular-nums text-white/35">{((l.fadeInMs ?? 0) / 1000).toFixed(1)}{t.sec}</span>
                                    </span>
                                    <input type="range" min={0} max={span} step={50} value={l.fadeInMs ?? 0}
                                      onChange={(e) => up({ fadeInMs: Math.min(Number(e.target.value), span - (l.fadeOutMs ?? 0)) }, 'text-fadein')}
                                      className="w-full accent-[#8b22ff]" />
                                  </label>
                                  <label className="block">
                                    <span className="flex items-center justify-between text-[11px] text-white/55">
                                      <span>{t.text_fade} {t.text_fade_out}</span><span className="tabular-nums text-white/35">{((l.fadeOutMs ?? 0) / 1000).toFixed(1)}{t.sec}</span>
                                    </span>
                                    <input type="range" min={0} max={span} step={50} value={l.fadeOutMs ?? 0}
                                      onChange={(e) => up({ fadeOutMs: Math.min(Number(e.target.value), span - (l.fadeInMs ?? 0)) }, 'text-fadeout')}
                                      className="w-full accent-[#8b22ff]" />
                                  </label>
                                </div>
                                <div className="flex justify-end pt-1">
                                  <button type="button" onClick={() => {
                                    const fin = l.fadeInMs ?? 0, fout = l.fadeOutMs ?? 0
                                    const points = [
                                      { atMs: 0, value: fin > 0 ? 0 : 1 },
                                      ...(fin > 0 ? [{ atMs: fin, value: 1 }] : []),
                                      ...(fout > 0 ? [{ atMs: Math.max(fin, span - fout), value: 1 }] : []),
                                      { atMs: span, value: fout > 0 ? 0 : 1 },
                                    ]
                                    up({ opacityKeyframes: { points } }, 'text-opkf-on')
                                  }} className="text-[10px] text-white/40 hover:text-white/70">Advanced ▸</button>
                                </div>
                              </>
                            )}
                            <div className="flex justify-end pt-1">
                              <button type="button" onClick={() => removeText(selText)}
                                className="text-[10px] text-white/40 transition hover:text-[#ff8888]">✕ {t.text_delete}</button>
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>

                {/* music bed (allowlist-gated: only when the season enables music) */}
                {musicEnabled && (
                <div className="mt-4 border-t border-white/8 pt-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-white/45">{t.music_title}</p>
                  {musicListReady && musicAssets.length === 0 ? (
                    <p className="py-2 text-[11px] text-white/35">{t.music_none_assets}</p>
                  ) : !music ? (
                    <div className="space-y-2">
                      {/* ★Facet chips. Each group renders only when the LOADED data
                          carries that facet, and only the values actually present are
                          offered -- so a filter can never come back empty for a reason
                          the participant cannot see. genre/tempo are absent until the
                          columns are migrated. */}
                      {(musicFacetsAvailable.genre || musicFacetsAvailable.mood || musicFacetsAvailable.tempo) && (
                        <div className="space-y-1.5">
                          {musicFacetsAvailable.genre && (
                            <div className="flex flex-wrap gap-1">
                              {presentGenreKeys(musicAssets).map((k) => (
                                <button key={k} type="button"
                                  onClick={() => setMusicFacets((s) => ({ ...s, genre: s.genre === k ? null : k }))}
                                  className={`rounded px-2 py-0.5 text-[10px] transition ${musicFacets.genre === k ? 'bg-[#8b22ff] text-white' : 'border border-white/15 text-white/55 hover:border-white/35'}`}>
                                  {genreLabel(k, props.lang)}
                                </button>
                              ))}
                            </div>
                          )}
                          {musicFacetsAvailable.mood && (
                            <div className="flex flex-wrap gap-1">
                              {presentMoodKeys(musicAssets).map((k) => (
                                <button key={k} type="button"
                                  onClick={() => setMusicFacets((s) => ({ ...s, mood: s.mood === k ? null : k }))}
                                  className={`rounded px-2 py-0.5 text-[10px] transition ${musicFacets.mood === k ? 'bg-[#8b22ff] text-white' : 'border border-white/15 text-white/55 hover:border-white/35'}`}>
                                  {moodLabel(k, props.lang)}
                                </button>
                              ))}
                            </div>
                          )}
                          {musicFacetsAvailable.tempo && (
                            <div className="flex flex-wrap gap-1">
                              {presentTempoKeys(musicAssets).map((k) => (
                                <button key={k} type="button"
                                  onClick={() => setMusicFacets((s) => ({ ...s, tempo: s.tempo === k ? null : k }))}
                                  className={`rounded px-2 py-0.5 text-[10px] transition ${musicFacets.tempo === k ? 'bg-[#8b22ff] text-white' : 'border border-white/15 text-white/55 hover:border-white/35'}`}>
                                  {tempoLabel(k, props.lang)}
                                </button>
                              ))}
                            </div>
                          )}
                          {musicFilterActive && (
                            <button type="button" onClick={() => setMusicFacets({})}
                              className="text-[10px] text-white/40 underline transition hover:text-white/70">
                              {t.music_filter_clear} ({visibleMusicAssets.length}/{musicAssets.length})
                            </button>
                          )}
                        </div>
                      )}

                      {/* ★The list loads on first contact with this control, not on
                          page load. Focus fires for the keyboard too, so this is not
                          a mouse-only affordance. */}
                      <select value="" onFocus={loadMusic} onMouseDown={loadMusic}
                        onChange={(e) => {
                          const a = musicAssets.find((x) => x.id === e.target.value)
                          // ★Auditioning is separate from choosing: selecting in the
                          // list previews it, and the bed is only committed by the
                          // button below. Picking straight from a dropdown made the
                          // only way to hear a track an edit to the composition.
                          if (a) setMusicPreviewId(a.id)
                        }}
                        className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-1.5 text-xs text-white focus:border-[#8b22ff] focus:outline-none">
                        <option value="">{musicLoading ? t.music_loading : `${t.music_pick}…`}</option>
                        {visibleMusicAssets.map((a) => (
                          <option key={a.id} value={a.id}>{musicPickerLine(a, props.lang) || a.id}</option>
                        ))}
                      </select>

                      {/* ★Filter matched nothing: say so, rather than showing an empty
                          dropdown that reads as an empty library. */}
                      {musicListReady && musicFilterActive && visibleMusicAssets.length === 0 && (
                        <p className="text-[11px] text-white/35">{t.music_filter_none}</p>
                      )}

                      {/* ★[4] preview. Its own element, so auditioning never touches the
                          timeline or the selected bed. preload="none": opening the panel
                          must not fetch a thousand files. */}
                      {musicPreviewUrl && (() => {
                        const prev = musicAssets.find((a) => a.id === musicPreviewId)
                        return (
                          <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[.02] p-2">
                            <p className="truncate text-[11px] text-white/70">
                              {prev ? musicPickerLine(prev, props.lang) || prev.id : ''}
                            </p>
                            <audio controls preload="none" src={musicPreviewUrl} className="h-7 w-full" />
                            <div className="flex gap-2">
                              <button type="button"
                                onClick={() => { if (prev) { pickMusic(prev.id, prev.source); setMusicPreviewId(null) } }}
                                className="rounded bg-[#8b22ff] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-[#a04dff]">
                                {t.music_use_this}
                              </button>
                              <button type="button" onClick={() => setMusicPreviewId(null)}
                                className="rounded border border-white/15 px-2.5 py-1 text-[10px] text-white/55 transition hover:border-white/35">
                                {t.music_preview_close}
                              </button>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : (() => {
                    const selm = musicAssets.find((a) => a.id === music.assetId)
                    const span = (music.endMs ?? totalMs) - (music.startMs ?? 0)
                    return (
                      <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[.02] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          {/* ★Localised, not the raw key: `mood` used to be printed
                              straight through, and with the vocabulary confirmed that
                              value is English ('elegant'). */}
                          <span className="truncate text-[12px] text-white">{selm ? musicPickerLine(selm, props.lang) || selm.id : music.assetId}</span>
                          <button type="button" onClick={removeMusic} className="shrink-0 text-[10px] text-white/40 transition hover:text-[#ff8888]">✕ {t.music_remove}</button>
                        </div>
                        <label className="block">
                          <span className="flex items-center justify-between text-[11px] text-white/55"><span>{t.music_volume}</span><span className="tabular-nums text-white/35">{Math.round(music.volume)}%</span></span>
                          <input type="range" min={0} max={100} value={music.volume} onChange={(e) => updateMusic({ volume: Number(e.target.value) }, 'music-vol')} className="w-full accent-[#8b22ff]" />
                        </label>
                        <label className="block">
                          <span className="flex items-center justify-between text-[11px] text-white/55"><span>{t.music_balance}</span><span className="tabular-nums text-white/35">{Math.round(music.clipVolume)}%</span></span>
                          <input type="range" min={0} max={100} value={music.clipVolume} onChange={(e) => updateMusic({ clipVolume: Number(e.target.value) }, 'music-bal')} className="w-full accent-[#8b22ff]" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="flex items-center justify-between text-[11px] text-white/55"><span>{t.music_fade} {t.music_fade_in}</span><span className="tabular-nums text-white/35">{((music.fadeInMs ?? 0) / 1000).toFixed(1)}{t.sec}</span></span>
                            <input type="range" min={0} max={Math.max(0, span)} step={50} value={music.fadeInMs ?? 0} onChange={(e) => updateMusic({ fadeInMs: Math.min(Number(e.target.value), span - (music.fadeOutMs ?? 0)) }, 'music-fin')} className="w-full accent-[#8b22ff]" />
                          </label>
                          <label className="block">
                            <span className="flex items-center justify-between text-[11px] text-white/55"><span>{t.music_fade} {t.music_fade_out}</span><span className="tabular-nums text-white/35">{((music.fadeOutMs ?? 0) / 1000).toFixed(1)}{t.sec}</span></span>
                            <input type="range" min={0} max={Math.max(0, span)} step={50} value={music.fadeOutMs ?? 0} onChange={(e) => updateMusic({ fadeOutMs: Math.min(Number(e.target.value), span - (music.fadeInMs ?? 0)) }, 'music-fout')} className="w-full accent-[#8b22ff]" />
                          </label>
                        </div>
                        <p className="text-[9px] leading-tight text-white/35">{t.music_wysiwyg}</p>
                      </div>
                    )
                  })()}
                  {/* AI generation (Stage 6) -- shown only when the season's AI-music
                      switch is on. Season 0 ships library-only, so this stays unrendered
                      and no half-wired generate UI appears without a provider. */}
                  {props.musicAiEnabled && props.onGenerateMusic && (
                    <div className="mt-3 space-y-2 rounded-lg border border-[#8b22ff]/20 bg-[#8b22ff]/[.04] p-2.5">
                      <p className="text-[11px] font-semibold text-[#b66cff]">{t.music_ai_title}</p>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        maxLength={props.musicPromptMax ?? 500}
                        rows={2}
                        placeholder={t.music_ai_ph}
                        disabled={aiState === 'generating'}
                        className="w-full resize-none rounded-lg border border-white/10 bg-[#070610] px-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:border-[#8b22ff] focus:outline-none disabled:opacity-50"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/40">
                          {t.music_ai_cost(props.musicCreditCost ?? 0)}
                          {/* Per-round ceiling. A music bed is the same artefact whether it
                              was made while practising or for the entry, so the participant
                              has to SEE the budget draining -- a silent counter would let
                              someone spend the round's allowance without knowing it existed.
                              cap 0 = unlimited (season opt-in) -> no counter. */}
                          {musicCap > 0 && (
                            <span className={musicLeft > 0 ? 'ml-2 text-white/30' : 'ml-2 text-[#ffb27a]'}>
                              {t.music_ai_remaining(musicLeft, musicCap)}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={genMusic}
                          disabled={aiState === 'generating' || !aiPrompt.trim() || musicCapReached}
                          className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-40"
                        >
                          {aiState === 'generating' ? t.music_ai_generating : t.music_ai_generate}
                        </button>
                      </div>
                      {musicCapReached && <p className="text-[10px] text-[#ffb27a]">{t.music_ai_cap_reached}</p>}
                      {aiState === 'error' && aiError && <p className="text-[10px] text-[#ff8888]">{aiError}</p>}
                      <p className="text-[9px] leading-tight text-white/30">{t.music_ai_refund_note}</p>
                    </div>
                  )}
                </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* length warnings */}
      {(under || over || tooMany) && (
        <p className="text-[12px] text-[#ff8888]">
          {tooMany ? t.clip_over(props.maxClips) : over ? t.over(props.maxSeconds) : t.under(props.minSeconds)}
        </p>
      )}

      {/* RENDER + SUBMIT (reused backend flow) */}
      <div className="rounded-xl border border-white/10 bg-[#08060f] p-4">
        {inBuffer ? (
          /* ★ACCEPTED · PROCESSING. The submission is already recorded; nothing here is
             actionable, and no time estimate is shown -- the queue makes any estimate a
             lie. The line that matters is "received before the deadline". */
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[.07] p-4">
            <p className="text-sm font-bold text-emerald-200">✓ {t.acc_title}</p>
            <p className="text-[12px] text-white/70">{t.acc_at(acceptedAtLabel)}</p>
            <p className="text-[12px] font-bold text-emerald-300">{t.acc_before_deadline}</p>
            <p className="text-[12px] text-white/55">
              {t.acc_render_label}: {t.acc_render(accepted!.renderStatus ?? renderState?.status ?? 'queued')}
            </p>
            {bufferTrouble ? (
              <p className="text-[12px] text-amber-300/90">{t.acc_failed}</p>
            ) : bufferRetrying ? (
              <p className="text-[12px] text-amber-300/90">{t.acc_requeued}</p>
            ) : (
              <p className="text-[12px] text-white/55">{t.acc_processing}</p>
            )}
            <p className="text-[11px] text-white/35">{t.acc_no_resubmit}</p>
          </div>
        ) : (
        <>
        {/* A finalized submission ends the round -- say so instead of leaving a live
            "make final" button that submitRender would only reject. */}
        {(ctx?.alreadySubmitted || accepted) && !renderSubmittable ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">{t.already_submitted}</p>
        ) : !renderReady ? (
          <button onClick={doRender} disabled={!canRender || !!accepted || !!ctx?.alreadySubmitted}
            className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40">
            {isRendering ? t.rendering : t.render}
          </button>
        ) : null}
        {renderState && (
          <p className="mt-2 text-[12px] text-white/55">
            {renderState.status === 'failed' ? `${t.render_failed}${renderState.error ? ` — ${renderState.error}` : ''}` : t.render_status(renderState.status)}
          </p>
        )}
        {err && <p className="mt-2 text-[12px] text-[#ff8888]">{err}</p>}

        {(renderReady || renderSubmittable) && (
          <div className="mt-3 space-y-3">
            {renderReady && (
              <>
                <video src={renderState!.videoUrl!} controls className="w-full max-w-2xl rounded-lg border border-white/10 bg-black" />
                <p className="text-[12px] font-bold text-emerald-300">✓ {t.final_ready}</p>
              </>
            )}

            {submitDone ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{t.submitted_ok}</p>
            ) : ctx?.alreadySubmitted ? (
              <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">{t.already_submitted}</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] p-4">
                <p className="text-sm font-bold text-white">{t.submit_title} · <span className="text-[#b66cff]">{t.submit_round(ctx?.round ?? 'application')}</span></p>
                {props.nickname && <p className="text-[11px] text-white/45">{t.publish_as(props.nickname)}</p>}
                {needInfo && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-white/55">{t.need_info}</p>
                    <label className="block text-[11px] text-white/60">{t.f_statement(sMin, sMax)} <span className="text-white/35">({stmtLen}{t.chars})</span></label>
                    <textarea value={ap.creatorStatement} onChange={(e) => setAp((a) => ({ ...a, creatorStatement: e.target.value }))} rows={3}
                      className="w-full rounded-lg border border-white/10 bg-[#070610] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#8b22ff] focus:outline-none" />
                    {([['agreedRules', t.agree_rules], ['agreedPrivacy', t.agree_privacy], ['agreedIntegrity', t.agree_integrity]] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-[12px] text-white/70">
                        <input type="checkbox" checked={ap[k]} onChange={(e) => setAp((a) => ({ ...a, [k]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                {/* Only shown while the file is still coming: submitting now is the
                    whole point of the asynchronous path, and a participant staring at a
                    queued render needs to be told it is allowed. */}
                {!renderReady && <p className="text-[11px] text-emerald-300/80">{t.submit_async_note}</p>}
                <p className="text-[11px] text-amber-300/80">{t.submit_warn}</p>
                {submitErr && <p className="text-[12px] text-[#ff8888]">{t.submit_err(submitErr)}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={doSubmit} disabled={!canSubmit}
                    className="rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40">
                    {submitting ? t.submitting : t.submit_btn}
                  </button>
                  {props.onDelete && renderReady && (
                    <button onClick={doDeleteRender} disabled={deleting} className="text-[11px] text-white/40 transition hover:text-[#ff8888] disabled:opacity-40">
                      {deleting ? t.deleting : t.delete_final}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
