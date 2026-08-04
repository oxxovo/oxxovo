# (6) A~E -- what each one actually is today

Survey only. No code written. App at `16d27e6` (worktree `oxxovo-lane-c`); DB reads
are the live DB via service role, 2026-08-04; the route table is a local
`npm run build`. The 2026-07-30 brief's day estimates are **not** carried over --
three of its entries were already stale by 08-03 (caption track, actor consumption
points, i2v `active`), so every line below is re-measured from source.

Bottom line up front: **A and B are one edit in one file. C's hard part already
exists. D is copy, not construction. E is built on /watch and absent on the
landing -- and the landing one is visibly wrong from the day applications close.**
None of the five touch TK's four pending decisions.

| | Brief said | Measured | Blocked by TK's 4? |
|---|---|---|---|
| A | hardcoded `WATCH_NAV_ENABLED` -> config | true, still `false`, one consumer line | no |
| B | left menu, 2 items always | **two readings**; under one it is the same two lines as A, under the other it is already done | no |
| C | needs a data path that is not `genesis_applications` | **the path exists**: `promo_videos`, 93 ready rows. Missing = a public surface + a flag decision | no |
| D | member 3 + partner copy | /membership already ships a 4-tier comparison; partner has **one caption** and **no public entry** | no |
| E | banner stage mapping | /watch has a full 6-stage machine already. **The landing has none** and freezes at `00 00 00 00` | no |

---

## A -- the Watch nav flag

`app/_landing/LandingView.tsx:31`

```
const WATCH_NAV_ENABLED = false
```

Single consumer, line 125-127: the `/watch` link in the header nav. It is the
**only** `/watch` reference on the landing (grep: lines 29 and 126, one comment and
one link) -- there is no footer link, so the flag alone decides whether the landing
offers Watch at all.

Two things the brief did not say:

- The nav is `max-md:hidden` (line 120). **There is no mobile menu on the landing
  at all** -- no hamburger, no drawer. On a phone the header has the logo and the
  auth buttons and nothing else, flag or no flag. If "landing -> Watch
  unconditionally" is meant to hold on mobile, that is a second, larger piece of
  work than flipping a constant.
- The pattern to copy is in the same file: `studioFunnel` (line 40, 45) is resolved
  at runtime through a server action (`getStudioApplicationFlag(season.id)`).
  Config-based already has a shape here.

Where the config would live: `platform_config` (30 keys read live 2026-08-04) has
`session6_enabled`, `member_hosted_enabled`, `studio_purchase_enabled` -- and
**no watch/nav key**. So this needs one new row (a data INSERT, not a schema
change) or a `seasons` column (schema -- head office).

## B -- "left menu, 2 items, always"

The phrase matches two different places and the cost is different for each. Both
measured; **head office picks.**

**Reading 1 -- the landing header.** It contains exactly two conditionally
rendered entries and no others:

```
122  {studioFunnel && (   <a href="/studio">Studio</a>   )}
125  {WATCH_NAV_ENABLED && ( <a href="/watch">Watch</a>  )}
```

Under this reading B *is* A plus one more line, same file, same edit. That also
explains the 0.5 d next to A's 1 d.

**Reading 2 -- the Watch left sidebar.** `app/watch/WatchShell.tsx:96-97` already
renders exactly two permanent nav links, unconditionally, above every filter:

```
<NavLink href="/watch"    label="Home"       icon="🎬" />
<NavLink href="/welcome"  label="Tournament" icon="🏆" />
```

The shell `/watch` actually renders (`ArenaWatch` -> `ArenaShell`) has six, also
unconditional (`ArenaShell.tsx:15-22`). **Nothing in either sidebar is hidden by a
flag.** Under this reading B is already done and the work is zero.

## C -- promo showcase

The brief's blocker was "a data path that is not `genesis_applications` is needed."
**It is already there and it is full.**

`promo_videos` (migration `reports/promo_videos_migration_2026-06.sql`, live):

- **93 rows, all `status='ready'`, all 93 with a `video_url`, 0 `posted_at`**
  (service-role census, 2026-08-04)
- anon `SELECT` -> **refused, 42501**. RLS is admin-only.

Consequences for the estimate:

1. No fake application is needed and no new table is needed. The thing the brief
   priced at 2-4 d is done.
2. The RLS is not a blocker either: every public Watch read already goes through
   `createSupabaseAdmin()` server-side (`lib/watch.ts:270`), so a showcase can read
   it the same way. **No policy change, no head-office DB step.**
3. **Public consumption points = 0.** Outside `/admin/promo/*` and
   `/api/admin/promo/publish`, nothing reads the table. Same shape as the actor
   finding on 08-03: this is new construction, not a finishing touch.
4. The one real gap is the flag itself. `promo_videos` has no `showcase`,
   `published`, `title`, or `lang` column -- 93 ready rows with no way to say which
   of them the public should see. Choosing an existing column instead
   (`posted_at IS NOT NULL`?) selects **zero rows today**. So C reduces to: **decide
   what marks a row as showcased**, and if the answer is a new column, that is a
   schema change and therefore head office.

## D -- member tiers and the partner note

`/membership` is not empty. `app/membership/page.tsx` ships a **four-column
comparison -- Visitor / Member / Creator / Partner** (line 43-56), bilingual, with
every number pulled from `platform_config` (`membership_creator_price_usd`,
`membership_founding_free_count`, `membership_founding_free_months`, ... all
present live), plus a Founding-perk section that hides itself when unconfigured
(line 202).

What is actually thin is the partner side:

- The entire partner explanation is **one caption**:
  `'Separate track -- hosting right'` / `'별도 트랙 — 개설 권한'`
  (`lib/admin-i18n.ts:1247` / `:1853`).
- **No public entry point.** The only link to `/host/new` anywhere in `app/` is
  `app/partner/activate/ActivateView.tsx:64`, which is reachable only *after* a
  partner has been activated. Neither the landing nor `/membership` links to it.

So D is a copy + entry-point task on an existing page, not a build.

## E -- banner stage mapping

Two surfaces, opposite states.

**`/watch` -- built.** `lib/watch.ts:467-...` defines a six-stage machine:
`accepting -> judging -> finalists_pending -> main_live -> voting -> results`,
entirely date-driven, wired at `ArenaWatch.tsx:135` and rendered at `:166`. It also
already carries two honesty gates that were clearly learned the hard way: `results`
requires `winnerCount > 0` (the awards date can pass with no ranks written, because
`approveTop3Awards` is manual) and `main_live` changes its wording on
`finalistFilmCount`. There is nothing to map here.

What is left on /watch is **not mine**: `ArenaWatch.tsx:152-160` and
`LiveStatusBar.tsx:110` both label the card/banner reconciliation an "A안 stopgap"
pending a canonical `getSeasonPhase()` -- head office / 지수 본체.

**The landing -- absent, and wrong on a date we know.** `LandingView.tsx` has no
stage machine, no banner, and one time-aware element:

```
55  const targetDate = season?.application_close_at ? new Date(...) : null
60  const SHOW_COUNTDOWN = !!targetDate
```

`targetDate` stays non-null after the deadline, so `SHOW_COUNTDOWN` stays **true**
and the hero keeps rendering the header **"Application Closes In"** over
**`00 00 00 00`** (the timer clamps to `ZERO_TIME` at line 73-75) for the entire
main round, voting and results window. The CTA underneath does move on --
`resolveSeasonCta` returns "Join the waitlist" after close -- so the page
contradicts itself.

With the live season_0 schedule that state begins **2026-09-30** and runs to awards
**10-12 20:00 PT**; after the +35 d shift SQL it begins 11-04 and runs to 11-16.
Either way it is inside season 0, not after it.

E's real content is therefore the landing, and the /watch machine is the model to
follow rather than something to rebuild.

---

## Independence from the four pending decisions

TK's open items are music pricing, one-track-per-entry, the 300-song vocabulary,
and the i2v call budget. A/B/C/D/E touch none of them: no music table, no EDL, no
model catalog, no external API call. Every one of the five can start cold.

Cheapest first, if that is the axis: **A+B reading 1** (one file), **E landing**
(pure UI on data already loaded), **D** (copy + one link), **C** (needs the flag
decision above).
