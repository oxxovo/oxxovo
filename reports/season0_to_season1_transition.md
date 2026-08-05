# season_0 -> season_1 transition -- the three things a redeploy is required for

Written 2026-08-04 (lane C). **This is NOT part of the go-live checklist.** Nothing
here is done at season_0 launch; doing it then is wasted work. It is done the day
season_1's application window is opened, and if it is skipped the platform stays
pinned to season_0 in three places while the DB says otherwise.

Why it is a separate document: the three items look like unrelated files, but they
share one property -- **a DB edit does not reach them.** They are baked into the
build. TK opens a season with SQL; SQL cannot move any of these. So they have to be
found together, at a moment nobody is thinking about the build.

Measured on the app at `16d27e6` (worktree `oxxovo-lane-c`), against the live DB,
2026-08-04. Method for item 2 is the local `npm run build` route table; items 1 and 3
are code reads.

---

## The three

### T1. `NEXT_PUBLIC_OXXOVO_CURRENT_SEASON` -- a second season pointer that is not the DB

`lib/seasons.ts:246`

```
const CURRENT_SEASON_ID =
  process.env.NEXT_PUBLIC_OXXOVO_CURRENT_SEASON || 'season_0'
```

`getCurrentSeasonId()` returns this. It is **not** `getCurrentSeason()` -- that one
resolves from the DB and moves on its own. This one is a build-time constant.
`NEXT_PUBLIC_*` is inlined by the bundler, so even setting the variable later does
nothing until the next build.

TK confirmed 2026-08-04: **the variable is not set**, so the value is the literal
fallback `'season_0'`.

Who reads it:

| Site | What it does with it |
|---|---|
| `app/api/pre-register/route.ts:44` | **writes** it -- the season a pre-registration is filed against |
| `app/host/new/page.tsx:90` | `.eq('id', getCurrentSeasonId())` -- the season a partner tournament is cloned from (see T3) |
| `app/host/new/actions.ts:117` | same, on submit |
| `app/api/watch/stats/route.ts:28` | fallback only, after `getCurrentSeason()` |
| `app/watch/ArenaWatch.tsx:67` | fallback only, after `getCurrentSeason()` |

The first three are real: a pre-registration filed after season_1 opens is written
against **season_0** unless this changes.

**Do at transition:** decide whether the constant should exist at all. The
season-pointer question was already answered once for `getCurrentSeason()` (moved
env -> DB in the weekly-rotation work); this is the leftover half. Either set the
env var and redeploy, or delete the constant and resolve these five sites from the
DB like everything else. The second is the one that never needs doing again.

### T2. `/about` is prerendered with the season baked into the HTML

`app/about/page.tsx:16` calls `getCurrentSeason()` in a server component, and the
local build emits `○ /about` -- static. So the season name (`season.name`), the panel
label and the provider list are frozen into the build output.

`app/admin/seasons/actions.ts:65` does call `revalidatePath('/about')`, but only on
the admin season save/delete actions. A season opened by SQL in the Supabase editor
runs no server action, so nothing revalidates. And the app has no auto-deploy
(`vercel.json` `git.deploymentEnabled.main=false`) -- production is a CLI deploy.

**Do at transition:** redeploy, or make `/about` dynamic. Note this cuts both ways
today: `/about` is already not following the live DB, it is following whatever the
last build saw.

### T3. The partner tournament template clones "the current season"

`app/host/new/page.tsx:90` and `app/host/new/actions.ts:117` both load the season
named by `getCurrentSeasonId()` (T1) and use it as the template a partner's
tournament is built from -- schedule shape, model panel, weights.

This is T1's consequence rather than a separate bug, but it is listed separately
because it is the one with a **money-shaped** outcome: a partner who opens a
tournament after season_1 starts would inherit season_0's parameters, and nothing
in the flow says which season it copied.

**Do at transition:** whatever T1 resolves to, verify here specifically -- open
`/host/new` after the switch and confirm the template season is the new one.

---

## The opposite case -- one thing a DB edit reaches with no deploy at all

Added 2026-08-05 (lane C), measured at `1ef4512`.

T1-T3 share the property that **a DB edit does not reach them**. P1 is here because
it is the mirror of that, and the mirror is the more dangerous direction: a DB edit
reaches it **instantly, in production, with no build, no deploy and no review**.
That is why it needs writing down. Nothing will remind anyone.

### P1. Turning `member_hosted_enabled` on republishes the Partner tier to the public

`platform_config.member_hosted_enabled` is `"false"` live (service-role read,
2026-08-05). It gates `/host`, `/partner`, the partner cron, the auto-promotion
email -- and, since `1ef4512`, the Partner column and the "Host tournaments" row on
`/membership`.

Until that commit `/membership` was the one public member-hosted surface with **no**
gate on it: a four-column comparison advertising a tier whose own pages return 404,
in both languages, while the standard rules say season 0 has no partners. Head
office ruled gate rather than delete, because the copy is needed verbatim when the
program does open.

So the flag now has a second consequence nobody flipping it will be thinking about.
The moment it goes true:

- `/membership` gains a fourth column (Partner / 파트너) and a fifth row
  (Host tournaments / 시합 개설), on desktop **and** on the mobile stacked cards
- `/profile` starts offering active partners a link back to `/host/new`
  (`lib/partner-host-link.ts`, added `073dd96`) -- which is only visible to a
  partner whose `partner_status` is `active`, and there are **0 of those** today
- `/host` and `/partner` stop 404ing

**Do at transition:** this is the one item on this page that is *not* a redeploy.
It is a decision plus a look. Before flipping it, confirm the partner program is
actually meant to be public -- the flag is the whole announcement. After flipping
it, open `/membership` in a browser, in **both** languages, on **both** viewports.

★**Why the browser check is listed rather than automated.** The gate's rule is unit
tested in both directions and in both languages (`lib/membership-tiers.test.ts`,
14/14) -- an off-only test would have been passed by code that shows nothing to
anybody. What the tests cannot do is render the switched-on page: turning the flag
on is a DB write, so the only real ON render is the day this happens. The OFF half
**was** verified end to end at `1ef4512` (production build served locally;
`Partner`, `파트너`, `hosting right`, `개설 권한`, `Host tournaments`, `시합 개설`
all 0 occurrences; `colgroup` = 34% + 3x22%). The ON half is this line.

What to look for, since a table that gains a column is where layout breaks: four
columns still fit without horizontal scrolling at the `min-w-[600px]` table width,
the Creator column keeps its tint (it is read off the column now, not `ci === 2`),
and every checkmark is under the right tier -- the matrix used to be two parallel
arrays and a shifted column would look plausible.

**Not blocked by, and does not block, T1-T3.** No deploy, no order dependency.
Grouped here only because this is the document someone reads at the transition.

---

## Order

T1 first (it is the input to T3), then a single production deploy covers T2 and T3.
One deploy, not three. P1 is independent of all of it -- a config row, whenever the
partner program is actually meant to open.

## Verification after the switch

1. `/api/pre-register` -> file one, read back `season_id`. Must be season_1.
2. `/about` -> the season name in the copy. Must be season_1's.
3. `/host/new` -> the template season. Must be season_1.
4. `npm run test:current-season` (`e2e/current-season-time-travel.mjs`) -> 4/4.
   Read-only; it proves no later-opening season is scheduled to take over
   season_1 the way season_2 was scheduled to take over season_0.
5. **Only if `member_hosted_enabled` was turned on (P1):** `/membership` in a
   browser, KO and EN, desktop and mobile. Four columns, Partner present, no
   horizontal scroll, tint still on Creator, checkmarks under the right tiers.
   If the flag stays off, there is nothing to check -- the OFF state is already
   verified and unit tested.

---

## Two side effects of the season_2/3/4 fix -- NOT defects

Recorded here because they surface at the same moment and will look like faults.

**S1. create-ahead stops.** `app/api/cron/season-tick/route.ts:141` picks
`latest = max(season_number)` and skips creation when that row has no
`application_open_at` (the teaser branch, line 145-150). With season_2/3/4 cleared,
season_4 is the latest and has no open date, so the tick reports
`skippedCreation` every hour and never creates season_5. That is the designed
teaser behaviour, not a failure -- but it means **the season pipeline is now
manual** until someone gives the newest season an open date.

**S2. The "next season" line in email goes out without a date.**
`lib/email/finalist-report.ts:55 loadNextSeason` selects `status='upcoming'` ordered
by `application_open_at` ascending. With every upcoming season's open date NULL it
returns one of them with `openAt: null`. The copy falls back gracefully (the
function is written for it), so the CTA simply has no date. Worth a read of the
rendered mail before the first finalist report goes out.
