'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconPencil, IconTrash, IconCornerDownRight } from '@tabler/icons-react'
import type { TaskDetail, User } from './task-detail-types'
import ProfileModal from '@/components/profile-modal'
import { createNotification } from '@/lib/notifications'
import RichTextEditor, { type RichTextEditorHandle } from '@/components/rich-text-editor'
import RichTextDisplay from '@/components/rich-text-display'

type Props = {
  taskId: string
  task: TaskDetail
  users: User[]
  onRefresh: () => void
}

export default function TaskDetailActivity({ taskId, task, users, onRefresh }: Props) {
  const [commentHtml, setCommentHtml]   = useState('')
  const [commentText, setCommentText]   = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionedIds, setMentionedIds] = useState<string[]>([])
  const commentEditorRef = useRef<RichTextEditorHandle>(null)
  const [currentUser, setCurrentUser]   = useState<{ id: string; role: string } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText]   = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [replyingToId, setReplyingToId]   = useState<string | null>(null)
  const [replyText, setReplyText]         = useState('')
  const [replyTextPlain, setReplyTextPlain] = useState('')
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

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
    const text = parentId ? replyTextPlain : commentText
    if (!text.trim()) return
    const content = parentId ? replyText : (commentHtml || commentText)
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: newComment } = await supabase
      .from('comments')
      .insert({ task_id: taskId, user_id: user.id, content, parent_id: parentId ?? null })
      .select('id')
      .single()
    if (mentionedIds.length > 0 && newComment) {
      await supabase.from('comments_mentions').insert(
        mentionedIds.map(uid => ({ comment_id: newComment.id, user_id: uid }))
      )
      const commenterName = users.find(u => u.id === user.id)?.full_name ?? 'Someone'
      await Promise.all(
        mentionedIds.map(uid =>
          createNotification({
            userId: uid,
            type: 'mentioned',
            taskId,
            message: `${commenterName} mentioned you: "${task.title}"`,
          })
        )
      )
      setMentionedIds([])
    }
    if (parentId) {
      setReplyText('')
      setReplyTextPlain('')
      setReplyingToId(null)
    } else {
      setCommentHtml('')
      setCommentText('')
      commentEditorRef.current?.clearContent()
    }
    setSubmitting(false)
    onRefresh()
  }

  async function handleEditComment(id: string) {
    if (!editCommentText || editCommentText === '<p></p>') return
    await supabase.from('comments').update({ content: editCommentText }).eq('id', id)
    setEditingCommentId(null)
    onRefresh()
  }

  async function handleDeleteComment(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    onRefresh()
  }

  function handleCommentTextChange(text: string) {
    setCommentText(text)
    const match = text.match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  function handleSelectMention(user: User) {
    const editor = commentEditorRef.current?.getEditor()
    if (editor) {
      editor.chain().focus().command(({ tr, state }) => {
        const { from } = state.selection
        let atPos = -1
        for (let i = from - 1; i >= 0; i--) {
          const char = state.doc.textBetween(i, i + 1, '')
          if (char === '@') { atPos = i; break }
          if (char === ' ' || char === '\n') break
        }
        if (atPos === -1) return false
        tr.replaceWith(atPos, from, state.schema.text(`@${user.full_name} `))
        return true
      }).run()
    }
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
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-sq-accent flex items-center justify-center overflow-hidden shrink-0">
                {c.user?.avatar_url
                  ? <img src={c.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white text-xs font-bold leading-none">{c.user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                }
              </div>
              <button
                onClick={() => setViewingUserId(c.user_id)}
                className="text-sq-accent text-xs font-semibold hover:underline text-left"
              >
                {c.user?.full_name}
              </button>
            </div>
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
                <RichTextEditor
                  key={c.id}
                  content={editCommentText}
                  onChange={setEditCommentText}
                  minHeight="48px"
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
            : <RichTextDisplay html={c.content} />
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
          <div className={`flex flex-col gap-1 mt-1 ${depth === 0 ? 'ml-6' : 'ml-4'}`}>
            <RichTextEditor
              key={`reply-${c.id}`}
              content={replyText}
              onChange={setReplyText}
              onTextChange={setReplyTextPlain}
              placeholder={`Reply to ${c.user?.full_name}...`}
              minHeight="48px"
            />
            <div className="flex gap-2 self-end">
              <button
                onClick={() => { setReplyingToId(null); setReplyText(''); setReplyTextPlain('') }}
                className="text-sq-muted hover:text-white text-xs transition-colors">
                Cancel
              </button>
              <button
                onClick={() => submitComment(c.id)}
                disabled={submitting || !replyTextPlain.trim()}
                className="bg-sq-accent text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                Reply
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
      <div className="flex flex-col gap-2">
        <div className="relative">
          <RichTextEditor
            ref={commentEditorRef}
            content={commentHtml}
            onChange={setCommentHtml}
            onTextChange={handleCommentTextChange}
            placeholder="Add a comment..."
            minHeight="40px"
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
          disabled={submitting || !commentText.trim()}
          className="self-end bg-sq-accent text-white text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </div>

      {viewingUserId && (
        <ProfileModal userId={viewingUserId} onClose={() => setViewingUserId(null)} />
      )}
    </div>
  )
}
