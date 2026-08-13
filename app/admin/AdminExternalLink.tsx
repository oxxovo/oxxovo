// Every link that leaves /admin -- the public site, a participant's channel
// URL, a video, an R2 asset -- goes through this, on purpose (HQ 2026-08-12):
// admin is a working screen (open list, active filter, scroll position), and
// a same-tab navigation away from it loses all of that. Navigation WITHIN
// /admin (dashboard <-> seasons <-> actors, ...) stays plain next/link Link,
// same tab -- that is movement inside one tool, not leaving it.
//
// target="_blank" without rel="noopener noreferrer" is a real hole, not a
// style choice: the opened page can reach back into window.opener and
// redirect the admin tab underneath the operator.
export function AdminExternalLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}
