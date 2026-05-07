'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconPencil, IconTrash, IconCornerDownRight } from '@tabler/icons-react'
import type { TaskDetail, User } from './task-detail-types'

function renderWithMentions(content: string) {
  return content.split(/(@\S+)/).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-sq-accent font-semibold">{part}</span>
      : part
  )
}

type Props = {
  taskId: string
  task: TaskDetail
  users: User[]
  onRefresh: () => void
}

export default function TaskDetailActivity({ taskId, task, users, onRefresh }: Props) {
  const [comment, setComment]           = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const [currentUser, setCurrentUser]   = useState<{ id: string; role: string } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText]   = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText]       = useState('')

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('id, role').eq('id', user.id).single()
          .then(({ data }) => { if (data) setCurrentUser(data) })
      }
    })
  }, [])

  async function submitComment(parentId?: string) {
    const text = parentId ? replyText : comment
    if (!text.trim()) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: newComment } = await supabase
      .from('comments')
      .insert({ task_id: taskId, user_id: user.id, content: text.trim(), parent_id: parentId ?? null })
      .select('id')
      .single()
    if (mentionedIds.length > 0 && newComment) {
      await supabase.from('comments_mentions').insert(
        mentionedIds.map(uid => ({ comment_id: newComment.id, user_id: uid }))
      )
      setMentionedIds([])
    }
    if (parentId) {
      setReplyText('')
      setReplyingToId(null)
    } else {
      setComment('')
    }
    setSubmitting(false)
    onRefresh()
  }

  async function handleEditComment(id: string) {
    if (!editCommentText.trim()) return
    await supabase.from('comments').update({ content: editCommentText.trim() }).eq('id', id)
    setEditingCommentId(null)
    onRefresh()
  }

  async function handleDeleteComment(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    onRefresh()
  }

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setComment(val)
    const match = val.slice(0, e.target.selectionStart).match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  function handleSelectMention(user: User) {
    setComment(prev => prev.replace(/@\w*$/, `@${user.full_name} `))
    setMentionedIds(prev => [...prev, user.id])
    setMentionQuery(null)
  }

  const topLevel = task.comments.filter(c => !c.parent_id)
  const repliesFor = (parentId: string) => task.comments.filter(c => c.parent_id === parentId)

  function renderComment(c: typeof task.comments[0], depth = 0) {
    const isAuthor = currentUser?.id === c.user_id
    const isAdmin  = currentUser?.role === 'admin'
    const canReply = depth < 2
    const indentClass = depth === 1
      ? 'ml-6 border-l-2 border-sq-muted pl-3'
      : depth === 2
      ? 'ml-10 border-l-2 border-sq-muted/40 pl-3'
      : ''

    return (
      <div key={c.id} className={`flex flex-col gap-1 ${indentClass}`}>
        <div className="bg-sq-col rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sq-accent text-xs font-semibold">{c.user?.full_name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sq-muted text-xs">{new Date(c.created_at).toLocaleDateString()}</span>
              {isAuthor && (
                <button
                  onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content) }}
                  className="text-sq-accent hover:opacity-70 transition-opacity">
                  <IconPencil size={12} />
                </button>
              )}
              {(isAuthor || isAdmin) && (
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="text-sq-accent hover:opacity-70 transition-opacity">
                  <IconTrash size={12} />
                </button>
              )}
            </div>
          </div>
          {editingCommentId === c.id
            ? <div className="flex flex-col gap-1">
                <textarea
                  value={editCommentText}
                  onChange={e => setEditCommentText(e.target.value)}
                  rows={2}
                  className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-1.5 outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditComment(c.id)}
                    className="text-xs bg-sq-accent text-white px-2 py-1 rounded font-semibold hover:opacity-90">
                    Save
                  </button>
                  <button
                    onClick={() => setEditingCommentId(null)}
                    className="text-xs text-sq-muted hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            : <p className="text-white text-sm">{renderWithMentions(c.content)}</p>
          }
          {canReply && (
            <button
              onClick={() => { setReplyingToId(replyingToId === c.id ? null : c.id); setReplyText('') }}
              className="text-sq-accent hover:opacity-70 text-xs font-medium transition-opacity flex items-center gap-1 w-fit">
              <IconCornerDownRight size={11} /> Reply
            </button>
          )}
        </div>

        {/* Nested replies */}
        {depth < 2 && repliesFor(c.id).length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {repliesFor(c.id).map(r => renderComment(r, depth + 1))}
          </div>
        )}

        {/* Reply input */}
        {canReply && replyingToId === c.id && (
          <div className={`flex gap-2 mt-1 ${depth === 0 ? 'ml-6' : 'ml-4'}`}>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={`Reply to ${c.user?.full_name}...`}
              rows={2}
              autoFocus
              className="flex-1 bg-sq-col border border-sq-muted rounded-lg text-white text-sm px-3 py-2 outline-none placeholder:text-sq-muted resize-none"
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => submitComment(c.id)}
                disabled={submitting || !replyText.trim()}
                className="bg-sq-accent text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                Reply
              </button>
              <button
                onClick={() => { setReplyingToId(null); setReplyText('') }}
                className="text-sq-muted hover:text-white text-xs transition-colors text-center">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-white font-semibold text-base">
        Comments ({topLevel.length})
      </label>

      {topLevel.length > 0 && (
        <div className="flex flex-col gap-3">
          {topLevel.map(c => renderComment(c, 0))}
        </div>
      )}

      {/* New comment */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <textarea
            value={comment}
            onChange={handleCommentChange}
            placeholder="Add a comment..."
            rows={2}
            className="w-full h-10 mt-2 bg-sq-col border border-sq-muted rounded-lg text-white text-sm px-3 py-2 outline-none placeholder:text-sq-muted resize-none"
          />
          {mentionQuery !== null && (
            <div className="absolute top-full mt-1 left-0 bg-sq-card border border-sq-muted rounded-lg overflow-hidden z-10 w-48">
              {users
                .filter(u => u.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
                .map(u => (
                  <button
                    key={u.id}
                    onMouseDown={e => { e.preventDefault(); handleSelectMention(u) }}
                    className="w-full text-left px-3 py-2 text-white text-sm hover:bg-sq-col transition-colors"
                  >
                    {u.full_name}
                  </button>
                ))
              }
            </div>
          )}
        </div>
        <button
          onClick={() => submitComment()}
          disabled={submitting || !comment.trim()}
          className="bg-sq-accent h-10 mt-2 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
