'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconPencil, IconTrash } from '@tabler/icons-react'
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

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('id, role').eq('id', user.id).single()
          .then(({ data }) => { if (data) setCurrentUser(data) })
      }
    })
  }, [])

  async function submitComment() {
    if (!comment.trim()) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: newComment } = await supabase
      .from('comments')
      .insert({ task_id: taskId, user_id: user.id, content: comment.trim() })
      .select('id')
      .single()
    if (mentionedIds.length > 0 && newComment) {
      await supabase.from('comments_mentions').insert(
        mentionedIds.map(uid => ({ comment_id: newComment.id, user_id: uid }))
      )
      setMentionedIds([])
    }
    setComment('')
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

  return (
    <div className="flex flex-col gap-3">
      <label className="text-white font-semibold text-base">
        Comments ({task.comments.length})
      </label>

      {task.comments.length > 0 && (
        <div className="flex flex-col gap-3">
          {task.comments.map(c => {
            const isAuthor = currentUser?.id === c.user_id
            const isAdmin  = currentUser?.role === 'admin'
            return (
              <div key={c.id} className="bg-sq-col rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sq-accent text-xs font-semibold">{c.user?.full_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sq-muted text-xs">{new Date(c.created_at).toLocaleDateString()}</span>
                    {isAuthor && (
                      <button
                        onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content) }}
                        className="text-sq-muted hover:text-white transition-colors"
                      >
                        <IconPencil size={12} />
                      </button>
                    )}
                    {(isAuthor || isAdmin) && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-sq-muted hover:text-sq-danger transition-colors"
                      >
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
                          className="text-xs bg-sq-accent text-white px-2 py-1 rounded font-semibold hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCommentId(null)}
                          className="text-xs text-sq-muted hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  : <p className="text-white text-sm">{renderWithMentions(c.content)}</p>
                }
              </div>
            )
          })}
        </div>
      )}

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
            <div className="absolute bottom-full mb-1 left-0 bg-sq-card border border-sq-muted rounded-lg overflow-hidden z-10 w-48">
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
          onClick={submitComment}
          disabled={submitting || !comment.trim()}
          className="bg-sq-accent h-10 mt-2 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
