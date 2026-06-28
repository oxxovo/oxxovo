'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  addWatchComment,
  editWatchComment,
  deleteWatchComment,
  reportWatchComment,
  COMMENT_MAX,
} from './actions'
import type { WatchComment } from '@/lib/watch'

// Comments: members write; author edits/deletes own; others report; admin hides
// via the admin queue. Replies/pins/mentions intentionally deferred.
export function CommentSection({
  applicationId,
  round,
  comments,
  currentUserId,
}: {
  applicationId: string
  round: string
  comments: WatchComment[]
  currentUserId: string | null
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const isLoggedIn = !!currentUserId

  function goLogin() {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }

  function submit() {
    if (!isLoggedIn) return goLogin()
    const body = text.trim()
    if (!body) return
    start(async () => {
      const res = await addWatchComment(applicationId, round, body)
      if (res.ok) {
        setText('')
        router.refresh()
      } else if (res.error === 'auth') {
        goLogin()
      }
    })
  }

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-black">{comments.length} comments</h2>
        {/* Policy link placeholder -- copy supplied by HQ / 제니3. */}
        <Link href="/guidelines" className="text-xs text-white/40 hover:text-white/70 transition">
          Community Guidelines
        </Link>
      </div>

      {/* Composer */}
      <div className="mt-4">
        {isLoggedIn ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={COMMENT_MAX}
              rows={3}
              placeholder="Add a comment…"
              className="w-full rounded-lg border border-white/15 bg-white/[.03] px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#8b22ff]/60 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="text-[11px] text-white/30">
                {text.length}/{COMMENT_MAX}
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !text.trim()}
                className="rounded-full bg-[#8b22ff] px-4 py-1.5 text-sm font-bold text-white transition hover:bg-[#7a1de0] disabled:opacity-40"
              >
                Comment
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={goLogin}
            className="w-full rounded-lg border border-white/15 bg-white/[.03] px-3 py-3 text-left text-sm text-white/40 hover:border-white/30 transition"
          >
            Sign in to comment…
          </button>
        )}
      </div>

      {/* List */}
      <div className="mt-6 space-y-5">
        {comments.length === 0 ? (
          <p className="text-sm text-white/35">No comments yet. Be the first.</p>
        ) : (
          comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              isOwner={c.authorId === currentUserId}
              isLoggedIn={isLoggedIn}
              onChanged={() => router.refresh()}
              onNeedLogin={goLogin}
            />
          ))
        )}
      </div>
    </section>
  )
}

function CommentRow({
  comment,
  isOwner,
  isLoggedIn,
  onChanged,
  onNeedLogin,
}: {
  comment: WatchComment
  isOwner: boolean
  isLoggedIn: boolean
  onChanged: () => void
  onNeedLogin: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [reported, setReported] = useState(false)
  const [pending, start] = useTransition()

  function saveEdit() {
    const body = draft.trim()
    if (!body) return
    start(async () => {
      const res = await editWatchComment(comment.id, body)
      if (res.ok) {
        setEditing(false)
        onChanged()
      }
    })
  }

  function remove() {
    if (!confirm('Delete this comment?')) return
    start(async () => {
      const res = await deleteWatchComment(comment.id)
      if (res.ok) onChanged()
    })
  }

  function report() {
    if (!isLoggedIn) return onNeedLogin()
    start(async () => {
      const res = await reportWatchComment(comment.id)
      if (res.ok) setReported(true)
    })
  }

  return (
    <div className="border-b border-white/5 pb-4 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">{comment.authorName}</span>
        {comment.editedAt && <span className="text-[10px] text-white/30">(edited)</span>}
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={COMMENT_MAX}
            rows={3}
            className="w-full rounded-lg border border-white/15 bg-white/[.03] px-3 py-2 text-sm text-white focus:border-[#8b22ff]/60 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending}
              className="rounded-full bg-[#8b22ff] px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(comment.body)
              }}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{comment.body}</p>
      )}

      {!editing && (
        <div className="mt-2 flex items-center gap-4 text-[11px] text-white/40">
          {isOwner ? (
            <>
              <button type="button" onClick={() => setEditing(true)} className="hover:text-white transition">
                Edit
              </button>
              <button type="button" onClick={remove} disabled={pending} className="hover:text-[#ff7d97] transition">
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={report}
              disabled={pending || reported}
              className="hover:text-[#ff7d97] transition disabled:opacity-50"
            >
              {reported ? 'Reported' : 'Report'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
