// New-site screen text -- the ENGLISH CANONICAL catalog. Every other language is a
// translation of these keys (lib/site-messages.ts falls back to this file for any key
// a language lacks, so a screen never shows a blank).
//
// Wording: the top-menu / section / badge names (TK 2026-10-11) and the left-menu item
// names + Home hero lines (the approved mockup, TK 2026-10-11) are final. The aria
// words are TEMPORARY neutral English. Keys in PENDING_COPY are deliberately EMPTY: the
// wording does not exist yet (copy is Jenny3's, never invented here) and the view draws
// nothing for them. They are collected in reports/copy_requests_site_2026-10-11.md.
export const EN = {
  'brand': 'OXXOVO',

  // top menu (7 business axes)
  'nav.tournament': 'Tournament',
  'nav.entertainment': 'Entertainment',
  'nav.daily': 'Daily',
  'nav.market': 'Market',
  'nav.education': 'Education',
  'nav.jobs': 'Jobs',
  'nav.games': 'AI Games',

  // video sections (filters, section names)
  'section.all': 'All',
  'section.competition': 'Competition',
  'section.news': 'News',
  'section.film': 'Film',
  'section.drama': 'Drama',
  'section.cf': 'CF',
  'section.music': 'Music',

  // Home
  'hero.brand': 'OXXOVO',
  'hero.line1': 'AI x HUMAN',
  'hero.line2': 'A BRIGHTER TOMORROW',
  'hero.verbs': 'Create · Compete · Learn · Work · Play',
  // The line the mockup shows on the right of the hero. Its English is not written
  // (Korean was supplied: "AI와 사람이 함께 만드는 더 큰 세상"); nothing is drawn for it in English.
  'hero.sub': '',
  'home.featured': 'Featured',

  // card origin badges (fixed by TK 2026-10-11)
  'badge.competition': 'COMPETITION',
  'badge.original': 'OXXOVO ORIGINAL',
  'badge.daily': 'OXXOVO DAILY',
  'badge.commercial': 'COMMERCIAL',

  'card.aiGenerated': 'AI-generated',

  // accessibility names (temporary neutral English)
  'aria.account': 'Account',
  'aria.language': 'Language',
  'aria.topMenu': 'Sections',
  'aria.sideMenu': 'Section menu',
  'aria.adSlot': 'Tournament video',

  // left menus (approved mockup). First item of each page = that page's home.
  'side.entertainment.home': 'Entertainment Home',
  'side.entertainment.film': 'Film',
  'side.entertainment.drama': 'Drama',
  'side.entertainment.cf': 'CF (Commercial)',
  'side.entertainment.music': 'Music & MV',
  'side.entertainment.stars': 'AI Stars',
  'side.entertainment.series': 'Original Series',
  'side.entertainment.featured': 'Featured',
  'side.entertainment.library': 'My Library',

  'side.daily.home': 'AI News Home',
  'side.daily.latest': 'Latest',
  'side.daily.companies': 'AI Companies',
  'side.daily.models': 'AI Models',
  'side.daily.trends': 'Industry Trends',
  'side.daily.interviews': 'Interviews',
  'side.daily.analysis': 'Analysis',
  'side.daily.archive': 'Archive',

  'side.market.home': 'AI Market Home',
  'side.market.products': 'All Products',
  'side.market.robots': 'AI Robots',
  'side.market.software': 'AI Software',
  'side.market.hardware': 'AI Hardware',
  'side.market.compare': 'Compare',
  'side.market.guide': 'Buying Guide',
  'side.market.featured': 'Featured',
  'side.market.inquiry': 'Inquiry',

  'side.education.home': 'Education Home',
  'side.education.courses': 'Courses',
  'side.education.projects': 'Projects',
  'side.education.assessments': 'Assessments',
  'side.education.certification': 'Certification',
  'side.education.tutorials': 'Tutorials',
  'side.education.mentoring': 'Mentoring',
  'side.education.community': 'Community',
  'side.education.learning': 'My Learning',

  'side.jobs.home': 'Jobs Home',
  'side.jobs.find': 'Find Jobs',
  'side.jobs.talent': 'Find Talent',
  'side.jobs.post': 'Post a Job',
  'side.jobs.applications': 'Applications',
  'side.jobs.companies': 'Company Profiles',
  'side.jobs.guide': 'Career Guide',
  'side.jobs.profile': 'My Profile',

  'side.games.home': 'AI Games Home',
  'side.games.chess': 'Chess',
  'side.games.go': 'Go',
  'side.games.janggi': 'Janggi',
  'side.games.opponent': 'Choose Opponent',
  'side.games.records': 'Game Records',
  'side.games.rankings': 'Rankings',
  'side.games.tournaments': 'Tournaments',
  'side.games.community': 'Community',
} as const

export type MessageKey = keyof typeof EN

// Keys whose English wording has not been written. The only keys allowed to be empty.
export const PENDING_COPY: readonly MessageKey[] = ['hero.sub']
