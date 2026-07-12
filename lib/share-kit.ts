// Share Kit: shared helpers for the growth-engine share flow, used by both the
// "video is live" emails (static X/Facebook intent links) and the Watch page
// ShareButton (native share sheet -> Instagram/TikTok/KakaoTalk/Copy on mobile).
//
// Tone (advisor): never "ask friends to vote". The creator shares their OFFICIAL
// film; the audience is invited to watch + cast an official vote. No vote-begging.

export function shareCopy(seasonName: string): string {
  return `🎬 My film is now competing in OXXOVO ${seasonName}. Watch it and cast your official vote.`
}

export type ShareSource = 'email_share' | 'watch_share'

// Append the growth-loop attribution params to a share target. `ref` is the
// sharing creator's user id -- it credits both signups (profiles.referred_by)
// and votes (watch_votes.referred_by) back to them; utm_source marks the
// channel. Preserves any query already on the base URL. Pass an ABSOLUTE url.
export function buildShareUrl(baseUrl: string, referrerId: string, source: ShareSource): string {
  const u = new URL(baseUrl)
  u.searchParams.set('ref', referrerId)
  u.searchParams.set('utm_source', source)
  return u.toString()
}

// X (Twitter) web intent -- works from a static email button.
export function xIntentUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

// Facebook sharer -- works from a static email button. (FB ignores custom text,
// pulls OG tags from the URL, so we pass only the url.)
export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}
