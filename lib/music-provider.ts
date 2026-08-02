// AI music provider boundary -- ★CONTRACT ONLY. No implementation, no adapter,
// no HTTP, no DB. Every function below is exported as a TYPE, not a body, so
// this file cannot quietly acquire behaviour: adding an adapter means adding a
// new file that satisfies these types, and the diff shows it.
//
// WHY IT IS ITS OWN FILE (and not more of lib/music-gen.ts)
//   music-gen.ts is `server-only` and imports the Supabase admin client, so the
//   worker cannot mirror it. The provider call happens in the WORKER
//   (processOneMusicJob, not written yet), while the four provenance columns are
//   written by the app (finalizeMusicGeneration). Both sides need the same
//   contract, so the contract has to live somewhere neither side's dependencies
//   can reach. Same discipline as lib/music-limits.ts and lib/text-metrics.ts:
//   pure, shared, mirrored byte-for-byte into oxxovo-studio/src/.
//
// WHY IT IS WRITTEN BEFORE THE ADAPTER
//   The vendor is not chosen (③b is blocked on the ElevenLabs Music API Terms
//   3.A written reply). Anything built against an unchosen vendor is built
//   against a guess. What is NOT a guess is what we require of any vendor, and
//   that is exactly what this file is.
//
// ★DOES NOT TOUCH THE SIGNED CANONICAL. The v1m canonical is
//   `v1m|assetId|source|contentHash` (lib/cryptobind.ts:507). Provider, model,
//   licence and the provider timestamp are NOT in it. Recording them cannot move
//   a KAT golden. If a golden moves while this file is in the diff, that is an
//   accident, not a consequence.

// ===========================================================================
// 1. LICENCE -- our enumeration, and the facts a vendor must declare to earn a
//    member of it.
// ===========================================================================

// ★OUR enumeration, not the vendor's. A vendor's own licence page is prose that
// changes without notice and uses words ("royalty-free", "commercial use") that
// different vendors define differently. This list is what OXXOVO can actually
// operate a competition on, and a track is stored under one of these labels or
// it is not generated at all.
//
// Currently ONE member, and that is the honest state -- we have never accepted a
// second class of terms. Adding a member is a 대표님/제니2 decision, not an
// engineering one, because each member is a promise made to every participant
// whose entry carries that track: the entry is broadcast, archived, used in
// promotion, and must stay usable after the season closes.
export const MUSIC_LICENSE_TYPES = ['commercial_redistributable'] as const
export type MusicLicenseType = (typeof MUSIC_LICENSE_TYPES)[number]

// The facts a provider declares AT REGISTRATION, per provider+model. Booleans,
// not prose, so the decision is mechanical and reviewable in a diff.
//
// ★The provider declares FACTS. It does not declare its own MusicLicenseType --
// self-certification is how a vendor's marketing copy becomes our legal
// position. We classify (see MusicLicenseClassifier).
export interface MusicLicenseTerms {
  /** Output may be used commercially by the participant and by OXXOVO. */
  commercialUse: boolean
  /** Output may be redistributed/broadcast inside a competition entry. */
  redistribution: boolean
  /** Rights survive the end of the subscription/season. A licence that lapses
   *  when we stop paying the vendor makes every past entry a liability. */
  perpetual: boolean
  /** A visible credit line is required somewhere. TRUE is not automatically a
   *  rejection -- it is a product decision (where would the credit go?) that has
   *  not been made, so today no classifier member accepts it. */
  attributionRequired: boolean
  /** No per-play / per-view royalty and no PRO registration on the output. */
  royaltyFree: boolean
  /** The model was trained on licensed material the vendor indemnifies. Not the
   *  same question as the output licence, and the one that decides whether a
   *  third-party claim lands on the participant or on the vendor. */
  trainingDataLicensed: boolean
  /** ★Vendor may resell/repackage API access to third parties -- i.e. the
   *  ElevenLabs 3.A question. Our participants generate through our key, which
   *  is the shape a "no reseller" clause forbids. FALSE must refuse
   *  registration however good the output licence is. */
  resaleToEndUsersPermitted: boolean
  /** Human-readable pointer to the document these booleans were read out of
   *  (URL + retrieval date, or "written reply 2026-08-xx"). Not machine-checked;
   *  it exists so a future reader can re-derive the booleans instead of
   *  trusting them. */
  readonly source: string
}

// ★THE ④ GATE. Ours, not the adapter's. Returns the label a set of declared
// terms earns, or null when it earns none -- and null means the provider is
// REFUSED REGISTRATION, at process start, not at generation time. A vendor whose
// terms we cannot classify never becomes reachable; there is no runtime path
// where a job discovers it and falls back.
//
// Contract for the implementation (step ③a-3, after approval):
//   - PURE. No env, no DB, no network.
//   - TOTAL. Every field of MusicLicenseTerms is read; a new field added here
//     without a rule is a compile error, not a silently-ignored fact.
//   - CONSERVATIVE. Unknown combination -> null. There is no "probably fine".
export type MusicLicenseClassifier = (terms: MusicLicenseTerms) => MusicLicenseType | null

// ===========================================================================
// 2. GENERATION -- in and out.
// ===========================================================================

export interface MusicGenParams {
  /** The ASSEMBLED prompt the server stored. Never client-trusted, never
   *  re-edited by the adapter: what was moderated is what is sent. */
  prompt: string
  durationSeconds: number
  /** studio_music_assets.id. Passed so the vendor's own logs and any
   *  idempotency key line up with our row. */
  assetId: string
}

// ★The four provenance columns, as one type. studio_music_assets gained them on
// 2026-07-30 (migration Run confirmed; probed live 2026-08-01: all four present,
// all nullable, `provider`/`provider_model`/`license_type` text,
// `provider_generated_at` timestamptz, no DB-level enum). Because the DB will
// accept any string in license_type, THIS is where the enumeration is enforced.
export interface MusicProvenance {
  /** Registered slot id -- OUR name for the vendor (e.g. 'fal-sonilo'), stable
   *  across vendor model renames. -> studio_music_assets.provider */
  provider: string
  /** The exact model + version actually invoked (e.g.
   *  'sonilo/v1.1/text-to-music'). Not the family. If the vendor silently
   *  upgrades under one id, this column is the only place that shows it.
   *  -> studio_music_assets.provider_model */
  providerModel: string
  /** When the VENDOR produced the audio.
   *  ★NOT the cryptobind timestamp. buildMusicAssetBind stamps
   *  cryptobind_generated_at at finalize time, in our process. These two differ
   *  by the download+upload gap and they answer different questions ("when was
   *  this made" vs "when did we sign it"). Do not collapse them.
   *  -> studio_music_assets.provider_generated_at */
  generatedAt: Date
  /** The classified label. MUST equal what MusicLicenseClassifier returned for
   *  this provider at registration.
   *  ★Yes, this is redundant with the registration-time classification, and
   *  deliberately: requirement ① is that an adapter which does not report
   *  provenance fails to COMPILE, and a field the lane fills in afterwards
   *  cannot do that. The lane re-checks the two agree and treats a mismatch as
   *  a permanent failure (refund), because a disagreement means the adapter is
   *  not the code we classified.
   *  -> studio_music_assets.license_type */
  licenseType: MusicLicenseType
}

// ★Container format of the returned bytes.
// Measured, 2026-08-01: only 'm4a' is real today -- fal Sonilo v1.1 returns
// content_type 'audio/mp4' (oxxovo-studio/src/fal.ts:216-221) and the worker's
// R2 helper hardcodes the 'm4a' extension for kind:'music'
// (oxxovo-studio/src/r2.ts:48). 'mp3'/'wav' are carried because the pre-existing
// MusicGenOutput declared them, and Stable Audio 2.5's output container has NOT
// been measured by me.
// ★Step ③a-3 must resolve the conflict this exposes: the R2 key's extension is
// a constant while the format is a variable. Today a wav from a second provider
// would be stored as .m4a. Not fixed here -- this file states contracts, it does
// not change the worker.
export type MusicAudioFormat = 'm4a' | 'mp3' | 'wav'

// What an adapter must return. Provenance is spread in flat rather than nested
// so that omitting ANY of the four is a compile error at the adapter, which is
// requirement ①. A nested optional object would not do that.
export interface MusicGenOutput extends MusicProvenance {
  /** Raw track bytes. These exact bytes are what gets hashed for v1m and
   *  uploaded to R2 -- never a re-encode, never the vendor's ephemeral URL. */
  audio: Buffer
  /** ACTUAL rendered length, measured from the returned audio -- not echoed
   *  back from the request. Vendors round, clamp, and pad. The bed window in
   *  the editor is computed from this number, so an echoed value silently
   *  desyncs the mix. */
  durationSeconds: number
  format: MusicAudioFormat
}

// ===========================================================================
// 3. FAILURE -- exactly two classes, because exactly two things can happen next.
// ===========================================================================

// ★Requirement ②. The boundary classifies ONE error, and it classifies it
// because the two cases have different consequences for the participant's money:
//
//   throw an Error with .code === MUSIC_RATE_LIMITED
//       -> the request was never served. RETRYABLE. The lane leaves the row
//          claimed/queued and DOES NOT REFUND, because nothing was consumed.
//
//   throw anything else
//       -> the request was served and refused, or is unserveable. PERMANENT.
//          The lane marks the asset failed and REFUNDS
//          (refundMusicGeneration, lib/music-gen.ts).
//
// So "only RateLimited" does not mean an adapter may throw nothing else -- it
// means this is the only *classified* throw. Everything unclassified is
// permanent-and-refund, which is the safe default for the participant.
//
// ★AND NOTHING ELSE RIDES ON IT. No retryAfter, no remaining-quota, no
// reset-at. Those come from per-vendor headers, vendors disagree about them,
// and one vendor we have looked at sends none at all. An adapter that parsed
// them would make the lane's backoff depend on which vendor answered. Queue
// depth, backoff schedule, daily-usage accounting and the spend guards are
// owned by the WORKER LANE, on the same axis the clip lane already uses
// (studio_daily_generation_cap / studio_daily_budget_usd, oxxovo-studio/src/
// config.ts). The adapter's whole vocabulary here is one bit: "not served".
export const MUSIC_RATE_LIMITED = 'music_rate_limited' as const

export type MusicRateLimitedError = Error & { readonly code: typeof MUSIC_RATE_LIMITED }

/** Narrowing helper the lane uses to pick refund-or-requeue. Implemented in
 *  step ③a-3; declared here so both repos narrow the same way. */
export type IsMusicRateLimited = (err: unknown) => err is MusicRateLimitedError

// ===========================================================================
// 4. THE ADAPTER
// ===========================================================================

export interface MusicProvider {
  /** OUR slot id, written to MusicProvenance.provider. Stable across vendor
   *  renames; changing it rewrites history, so it does not change. */
  readonly id: string
  /** Model + version this instance invokes. One MusicProvider = one model. Two
   *  models from the same vendor are two registrations, because they are two
   *  different sets of licence terms until someone proves otherwise. */
  readonly model: string
  /** Declared terms, checked by MusicLicenseClassifier at registration. */
  readonly license: MusicLicenseTerms

  /** Generate one track. May poll internally -- the caller only awaits finished
   *  audio.
   *  MUST: return the vendor's own bytes and the measured duration.
   *  MUST: throw. Never resolve with empty audio, never resolve a partial.
   *  MUST NOT: retry internally on rate limit (that is the lane's schedule),
   *            touch the DB, touch R2, or read platform_config. */
  generate(params: MusicGenParams): Promise<MusicGenOutput>
}

// ===========================================================================
// 5. SLOTS -- requirement ③.
// ===========================================================================

// ★TWO NAMED SLOTS, NOT A LIST. A list invites iteration, and iteration over
// providers is round-robin however it is spelled. These are named because they
// are not interchangeable: `primary` is the vendor whose price and licence we
// actually chose, and `fallback` exists so a vendor outage is not an outage for
// the participant -- it is not a second supplier to spread load across.
//
// Spreading load would mean two participants in the same round get audio from
// two different models at two different prices under two different licences,
// decided by nothing they can see. In a competition that is not a nuance.
export interface MusicProviderSlots {
  primary: MusicProvider
  /** null = no fallback configured, which is a valid and expected state. */
  fallback: MusicProvider | null
}

// ★SELECTION CONTRACT (binding on step ③a-3):
//
//  1. Every job starts at `primary`. There is no counter, no hash of the asset
//     id, no "least recently used", no alternation. Two consecutive jobs both
//     go to primary.
//  2. `fallback` is reached ONLY when primary is UNAVAILABLE:
//        - primary threw MUSIC_RATE_LIMITED, or
//        - primary is not configured / failed to construct.
//  3. A PERMANENT failure from primary does NOT reach fallback. The request
//     itself was refused (moderation, malformed prompt, unsupported duration);
//     re-sending it to another vendor buys a second refusal and, if the second
//     vendor happens to accept it, routes around a refusal we wanted.
//  4. At most ONE fallback attempt per job. If fallback is also rate-limited,
//     the job is requeued -- it does not walk back to primary.
//  5. The slot actually used is what lands in MusicProvenance.provider. A track
//     made by the fallback says so in its own row; we never report the slot we
//     wished had served it.
//  6. No automatic promotion. Fallback does not become primary because primary
//     was slow. Swapping them is a config change a human makes.
export type SelectMusicProvider = (slots: MusicProviderSlots, attempt: 'primary' | 'fallback') => MusicProvider | null

// ===========================================================================
// 6. REGISTRATION -- where a bad vendor is stopped.
// ===========================================================================

// ★Registration is FAIL-FAST AT PROCESS START, not lazy at first job. A licence
// problem discovered when a participant presses Generate is discovered by the
// participant. Contract for the implementation:
//   - Run MusicLicenseClassifier on `provider.license`. null -> THROW. The
//     worker does not boot with an unclassifiable vendor wired in.
//   - Reject a duplicate `id`, and reject an `id` that is not already the value
//     stored in existing rows' `provider` column for the same vendor.
//   - Return the label, so the caller can assert the adapter's per-track
//     licenseType against it.
export type RegisterMusicProvider = (provider: MusicProvider) => MusicLicenseType

// Build the two slots from config (which vendor is primary/fallback is a
// platform_config value, not a constant -- 하드코딩 금지). Contract:
//   - Both slots go through RegisterMusicProvider. An unclassifiable fallback
//     fails the boot exactly as an unclassifiable primary does; a fallback is
//     not a place to put a vendor we are less sure about.
//   - primary unset -> THROW. There is no implicit primary.
//   - fallback unset -> null, quietly. That is a configuration, not a fault.
//   - primary === fallback -> THROW. It reads as redundancy and provides none.
export type BuildMusicProviderSlots = () => Promise<MusicProviderSlots>
