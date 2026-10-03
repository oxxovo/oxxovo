# eslint baseline -- app/ and lib/

- Date: 2026-10-03
- Commit: cacaca2 (origin/main)
- Command: `npx eslint app lib`
- Total: 71 problems (50 errors, 21 warnings)
- Files touched by the 2026-10-03 admin fixes (cc3816d..6e26125, 13 files): 0 problems. Re-running at the pre-fix commit gave the same total, so none of these were introduced that day.
- Purpose: so "since when does this exist" has an answer. Nothing here was fixed on purpose (HQ 2026-10-03). Regenerate and diff against this file; do not edit it by hand.

## By rule

| rule | count |
|---|---|
| error react/no-unescaped-entities | 11 |
| warning @typescript-eslint/no-unused-vars | 11 |
| error react-hooks/refs | 11 |
| error @typescript-eslint/no-explicit-any | 10 |
| error @next/next/no-html-link-for-pages | 7 |
| warning @next/next/no-img-element | 5 |
| error react-hooks/set-state-in-effect | 5 |
| error react-hooks/purity | 4 |
| warning (no ruleId; message-only warning) | 3 |
| warning react-hooks/exhaustive-deps | 2 |
| error prefer-const | 2 |

## By file (rule, severity, count, lines)

| severity | rule | file | n | lines |
|---|---|---|---|---|
| error | @next/next/no-html-link-for-pages | app/_landing/LandingView.tsx | 5 | 176,181,300,354,550 |
| error | @next/next/no-html-link-for-pages | app/apply/page.tsx | 1 | 839 |
| error | @next/next/no-html-link-for-pages | app/rules/page.tsx | 1 | 77 |
| error | @typescript-eslint/no-explicit-any | lib/ai/providers.ts | 1 | 164 |
| error | @typescript-eslint/no-explicit-any | lib/studio-verify.stage3.test.ts | 5 | 97,108,117,127,138 |
| error | @typescript-eslint/no-explicit-any | lib/studio-verify.ts | 2 | 15,17 |
| error | @typescript-eslint/no-explicit-any | lib/studio.ts | 2 | 800,834 |
| error | prefer-const | app/studio/compose/preview-gl.ts | 2 | 368,368 |
| error | react-hooks/purity | app/watch/ArenaWatch.tsx | 1 | 84 |
| error | react-hooks/purity | app/watch/LiveStatusBar.tsx | 3 | 104,107,110 |
| error | react-hooks/refs | app/studio/compose/ProComposeEditor.tsx | 10 | 1904,1904,1905,1905,1931,1942,1990,2001,2001,2055 |
| error | react-hooks/refs | app/studio/compose/TextOverlay.tsx | 1 | 30 |
| error | react-hooks/set-state-in-effect | app/studio/ActorMode.tsx | 3 | 234,651,654 |
| error | react-hooks/set-state-in-effect | app/studio/compose/page.tsx | 1 | 75 |
| error | react-hooks/set-state-in-effect | app/studio/compose/ProComposeEditor.tsx | 1 | 740 |
| error | react/no-unescaped-entities | app/privacy/page.tsx | 7 | 14,14,14,14,14,14,48 |
| error | react/no-unescaped-entities | app/terms/page.tsx | 4 | 14,14,72,72 |
| warning | (no ruleId; message-only warning) | app/profile/MainRoundCard.tsx | 2 | 104,474 |
| warning | (no ruleId; message-only warning) | app/watch/WatchTopBar.tsx | 1 | 43 |
| warning | @next/next/no-img-element | app/_landing/LandingView.tsx | 3 | 169,257,545 |
| warning | @next/next/no-img-element | app/rules/page.tsx | 1 | 78 |
| warning | @next/next/no-img-element | app/watch/WatchTopBar.tsx | 1 | 46 |
| warning | @typescript-eslint/no-unused-vars | app/profile/MainRoundCard.tsx | 1 | 171 |
| warning | @typescript-eslint/no-unused-vars | app/studio/compose/page.tsx | 1 | 26 |
| warning | @typescript-eslint/no-unused-vars | app/studio/compose/ProComposeEditor.tsx | 1 | 26 |
| warning | @typescript-eslint/no-unused-vars | app/watch/Arena.tsx | 2 | 23,452 |
| warning | @typescript-eslint/no-unused-vars | lib/email/templates/Waitlisted.tsx | 1 | 84 |
| warning | @typescript-eslint/no-unused-vars | lib/studio.ts | 2 | 24,61 |
| warning | @typescript-eslint/no-unused-vars | lib/watch-visibility.test.ts | 2 | 69,78 |
| warning | @typescript-eslint/no-unused-vars | lib/watch.ts | 1 | 702 |
| warning | react-hooks/exhaustive-deps | app/apply/page.tsx | 2 | 156,171 |
