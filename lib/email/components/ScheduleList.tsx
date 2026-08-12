// The "what happens next" bullets on a submission receipt.
//
// ★Renders NOTHING for an empty list, and that is the point. Every line comes
// from a season column (lib/email/schedule-lines.ts); a season whose dates are
// not set yet produces no lines, and the receipt is simply shorter. The
// alternative -- a heading over an empty list, or a bullet with a blank date --
// tells the participant the platform has lost track of its own schedule.

import { Text } from '@react-email/components'
import type { ScheduleLine } from '../schedule-lines'

export function ScheduleList({ lines }: { lines: ScheduleLine[] }) {
  if (lines.length === 0) return null
  return (
    <>
      {lines.map((l) => (
        <Text key={l.label} style={row}>
          <span style={dot}>·</span>
          <span style={label}>{l.label}</span>
          <span style={value}>{l.value}</span>
        </Text>
      ))}
    </>
  )
}

const row: React.CSSProperties = {
  color: '#333333',
  fontSize: 14,
  lineHeight: 1.7,
  margin: '0 0 4px',
}

const dot: React.CSSProperties = { color: '#8b22ff', marginRight: 8, fontWeight: 700 }
const label: React.CSSProperties = { color: '#666666', marginRight: 8 }
const value: React.CSSProperties = { color: '#111111', fontWeight: 600 }
