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

## Order

T1 first (it is the input to T3), then a single production deploy covers T2 and T3.
One deploy, not three.

## Verification after the switch

1. `/api/pre-register` -> file one, read back `season_id`. Must be season_1.
2. `/about` -> the season name in the copy. Must be season_1's.
3. `/host/new` -> the template season. Must be season_1.
4. `npm run test:current-season` (`e2e/current-season-time-travel.mjs`) -> 4/4.
   Read-only; it proves no later-opening season is scheduled to take over
   season_1 the way season_2 was scheduled to take over season_0.

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
