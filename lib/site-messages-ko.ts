// New-site screen text -- KOREAN. A translation layer over lib/site-messages-en.ts.
//
// Filled: the left-menu item names and the Home hero / Featured line, which are in the
// mockup TK approved (2026-10-11). Everything else stays out until Jenny3 writes it --
// an improvised word can contradict one already fixed elsewhere. Every missing key
// falls back to English, so /ko works today and each key added here switches over by
// itself. Only keys that exist in the English file are allowed (a test enforces it).
import type { MessageKey } from '@/lib/site-messages-en'

export const KO: Partial<Record<MessageKey, string>> = {
  'hero.sub': 'AI와 사람이 함께 만드는 더 큰 세상',
  'home.featured': '추천 콘텐츠',

  'side.entertainment.home': '엔터테인먼트 홈',
  'side.entertainment.film': '영화',
  'side.entertainment.drama': '드라마',
  'side.entertainment.cf': 'CF (Commercial)',
  'side.entertainment.music': '음악·MV',
  'side.entertainment.stars': 'AI 스타',
  'side.entertainment.series': '오리지널 시리즈',
  'side.entertainment.featured': '추천 콘텐츠',
  'side.entertainment.library': '내 라이브러리',

  'side.daily.home': 'AI 뉴스 홈',
  'side.daily.latest': '최신 뉴스',
  'side.daily.companies': 'AI 기업',
  'side.daily.models': 'AI 모델',
  'side.daily.trends': '산업 동향',
  'side.daily.interviews': '인터뷰',
  'side.daily.analysis': '칼럼·분석',
  'side.daily.archive': '지난 뉴스',

  'side.market.home': 'AI 마켓 홈',
  'side.market.products': '전체 제품',
  'side.market.robots': 'AI 로봇',
  'side.market.software': 'AI 소프트웨어',
  'side.market.hardware': 'AI 하드웨어',
  'side.market.compare': '제품 비교',
  'side.market.guide': '구매 가이드',
  'side.market.featured': '추천 제품',
  'side.market.inquiry': '문의·상담',

  'side.education.home': '교육 홈',
  'side.education.courses': '교육 과정',
  'side.education.projects': '실습 프로젝트',
  'side.education.assessments': '평가·시험',
  'side.education.certification': '인증·자격',
  'side.education.tutorials': '튜토리얼',
  'side.education.mentoring': '멘토링',
  'side.education.community': '커뮤니티',
  'side.education.learning': '내 학습',

  'side.jobs.home': '채용 홈',
  'side.jobs.find': '일자리 찾기',
  'side.jobs.talent': '인재 찾기',
  'side.jobs.post': '채용 등록',
  'side.jobs.applications': '지원 현황',
  'side.jobs.companies': '기업 프로필',
  'side.jobs.guide': '커리어 가이드',
  'side.jobs.profile': '내 프로필',

  'side.games.home': 'AI 게임 홈',
  'side.games.chess': '체스',
  'side.games.go': '바둑',
  'side.games.janggi': '장기',
  'side.games.opponent': 'AI 상대 선택',
  'side.games.records': '대국 기록',
  'side.games.rankings': '랭킹',
  'side.games.tournaments': '토너먼트',
  'side.games.community': '커뮤니티',
}
