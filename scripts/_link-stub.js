// next/link stand-in for scripts/site-fixture-shot.mjs (review renders only).
import React from 'react'
export default function Link({ href, children, ...rest }) {
  return React.createElement('a', { href, ...rest }, children)
}
