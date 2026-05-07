'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconClipboard, IconBooks, IconX, IconCheck, IconPencil, IconDeviceFloppy, IconLink, IconPlus, IconTrash } from '@tabler/icons-react'

type Status   = { id: string; label: string; color: string }
type User     = { id: string; full_name: string }
type Team     = { id: string; name: string; color: string }
type Subtask      = { id: string; title: string; is_done: boolean; position: number }
type LinkedTask   = { id: string; title: string; status: { label: string; color: string } }
type Comment  = { id: string; user_id: string; content: string; created_at: string; user: { full_name: string } }
type Attachment = { id: string; url: string; file_name: string; type: string }

type TaskDetail = {
  id: string
  type: 'story' | 'task'
  title: string
  description: string | null
  version: number
  priority: number
  status_id: string
  start_date: string | null
  end_date: string | null
  needs_acceptance: boolean
  assignee: string | null
  reviewer_id: string | null
  created_by: string | null
  parent_id: string | null
  parent: { title: string } | null
  assignee_user: { full_name: string } | null
  reviewer_user: { full_name: string } | null
  creator_user: { full_name: string } | null
  subtasks: Subtask[]
  comments: Comment[]
  related_task_ids: string[]
  task_boards: { board: { name: string; color: string } }[]
  task_teams: { is_responsible: boolean; team: { id: string; name: string; color: string } }[]
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}

const PRIORITY_COLORS: Record<number, string> = {
  0: '#6B6B6B', 1: '#50fa7b', 2: '#F3A63A', 3: '#ffb86c', 4: '#B84040',
}

function renderWithMentions(content: string) {
  return content.split(/(@\S+)/).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-sq-accent font-semibold">{part}</span>
      : part
  )
}

function getElapsed(startDate: string | null): string {
  if (!startDate) return '—'
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''}`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''}`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''}`
}

type Props = {
  taskId: string
  onClose: () => void
  onUpdated: () => void
}

export default function TaskDetailModal({ taskId, onClose, onUpdated }: Props) {
  const [task, setTask]             = useState<TaskDetail | null>(null)
  const [statuses, setStatuses]     = useState<Status[]>([])

  const [users, setUsers]           = useState<User[]>([])
  const [teams, setTeams]           = useState<Team[]>([])
  const [stories, setStories]       = useState<{ id: string; title: string }[]>([])
  const [linkedTasks, setLinkedTasks]   = useState<LinkedTask[]>([])
  const [allTasks, setAllTasks]         = useState<{ id: string; title: string }[]>([])

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [comment, setComment]           = useState('')
  const [mentionQuery, setMentionQuery]   = useState<string | null>(null)
  const [mentionedIds, setMentionedIds]   = useState<string[]>([])


  const [currentUser, setCurrentUser]       = useState<{ id: string; role: string } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText]   = useState('')

  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)
  const [editing, setEditing]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Edit mode state
  const [editTitle, setEditTitle]             = useState('')
  const [editDescription, setEditDescription] = useState('')

  const supabase = createClient()

  async function fetchTask() {
    const { data } = await supabase
      .from('tasks')
      .select(`
        id, type, title, description, version, priority, status_id,
        start_date, end_date, needs_acceptance, assignee, reviewer_id, created_by, parent_id, related_task_ids,
        parent:tasks!parent_id(title),
        assignee_user:users!assignee(full_name),
        reviewer_user:users!reviewer_id(full_name),
        creator_user:users!created_by(full_name),
        subtasks(id, title, is_done, position),
        comments(id, user_id, content, created_at, user:users!user_id(full_name)),
        task_boards(board:boards(name, color)),
        task_teams(is_responsible, team:teams(id, name, color)),
        task_attachments(id, url, file_name, type)
      `)
      .eq('id', taskId)
      .single()

    if (data) {
      const t = data as unknown as TaskDetail
      setTask(t)
      setAttachments((data as any).task_attachments ?? [])
      if (t.related_task_ids?.length > 0) {
        supabase
          .from('tasks')
          .select('id, title, status:statuses!status_id(label, color)')
          .in('id', t.related_task_ids)
          .then(({ data: linked }) => { if (linked) setLinkedTasks(linked as unknown as LinkedTask[]) })
      } else {
        setLinkedTasks([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTask()
    supabase.from('statuses').select('id, label, color').order('position')
      .then(({ data }) => { if (data) setStatuses(data) })
    supabase.from('users').select('id, full_name')
      .then(({ data }) => { if (data) setUsers(data) })
    supabase.from('teams').select('id, name, color').order('name')
      .then(({ data }) => { if (data) setTeams(data) })
    supabase.from('tasks').select('id, title').neq('id', taskId).order('title')
      .then(({ data }) => { if (data) setAllTasks(data) })
    supabase.from('tasks').select('id, title').eq('type', 'story').neq('id', taskId).order('title')
      .then(({ data }) => { if (data) setStories(data) })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('id, role').eq('id', user.id).single()
          .then(({ data }) => { if (data) setCurrentUser(data) })
      }
    })
  }, [taskId])

  function startEditing() {
    if (!task) return
    setEditTitle(task.title)
    setEditDescription(task.description ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!task || !editTitle.trim()) return
    await supabase.from('tasks').update({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
    }).eq('id', taskId)
    setTask(prev => prev ? { ...prev, title: editTitle.trim(), description: editDescription.trim() || null } : prev)
    setEditing(false)
    onUpdated()
  }

  async function updateField(field: string, value: string | number | null) {
    await supabase.from('tasks').update({ [field]: value || null }).eq('id', taskId)
    setTask(prev => prev ? { ...prev, [field]: value || null } : prev)
    onUpdated()
  }

  async function addLinkedTask(linkedId: string) {
    if (!task || !linkedId || task.related_task_ids.includes(linkedId)) return
    const updated = [...task.related_task_ids, linkedId]
    await supabase.from('tasks').update({ related_task_ids: updated }).eq('id', taskId)
    setTask(prev => prev ? { ...prev, related_task_ids: updated } : prev)
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status:statuses!status_id(label, color)')
      .eq('id', linkedId)
      .single()
    if (data) setLinkedTasks(prev => [...prev, data as unknown as LinkedTask])
    onUpdated()
  }

  async function removeLinkedTask(linkedId: string) {
    if (!task) return
    const updated = task.related_task_ids.filter(id => id !== linkedId)
    await supabase.from('tasks').update({ related_task_ids: updated }).eq('id', taskId)
    setTask(prev => prev ? { ...prev, related_task_ids: updated } : prev)
    setLinkedTasks(prev => prev.filter(t => t.id !== linkedId))
    onUpdated()
  }

  async function updateTeam(teamId: string) {
    await supabase.from('task_teams').delete().eq('task_id', taskId).eq('is_responsible', true)
    if (teamId) {
      await supabase.from('task_teams').insert({ task_id: taskId, team_id: teamId, is_responsible: true })
    }
    fetchTask()
    onUpdated()
  }

  async function toggleSubtask(subtask: Subtask) {
    await supabase.from('subtasks').update({ is_done: !subtask.is_done }).eq('id', subtask.id)
    setTask(prev => prev ? {
      ...prev,
      subtasks: prev.subtasks.map(s => s.id === subtask.id ? { ...s, is_done: !s.is_done } : s)
    } : prev)
  }

  async function handleDelete() {
    await supabase.from('tasks').delete().eq('id', taskId)
    onUpdated()
    onClose()
  }

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
    fetchTask()
  }

  async function handleEditComment(id: string) {
    if (!editCommentText.trim()) return
    await supabase.from('comments').update({ content: editCommentText.trim() }).eq('id', id)
    setEditingCommentId(null)
    fetchTask()
  }

  async function handleDeleteComment(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    fetchTask()
  }

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setComment(val)
    const match = val.slice(0, e.target.selectionStart).match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
  }


  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const path = `${taskId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('task-images').upload(path, file)
    if (error) return

    const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(path)
    const { data: att } = await supabase.from('task_attachments').insert({
      task_id: taskId,
      url: publicUrl,
      file_name: file.name,
      type: 'image',
      uploaded_by: user.id,
    }).select('id, url, file_name, type').single()
    if (att) setAttachments(prev => [...prev, att as Attachment])
  }

  async function handleDeleteAttachment(id: string, url: string) {
    const path = url.split('/task-images/')[1]
    await supabase.storage.from('task-images').remove([path])
    await supabase.from('task_attachments').delete().eq('id', id)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const activeStatus       = statuses.find(s => s.id === task?.status_id)
  const responsibleTeamId  = task?.task_teams.find(t => t.is_responsible)?.team.id ?? ''
  const responsibleTeam    = task?.task_teams.find(t => t.is_responsible)?.team
  const relatedTeams       = task?.task_teams.filter(t => !t.is_responsible) ?? []

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />
      <div className="relative bg-sq-card rounded-xl w-200 h-96 flex items-center justify-center">
        <span className="text-sq-muted text-sm">Loading...</span>
      </div>
    </div>
  )

  if (!task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

      <div className="relative bg-sq-card rounded-xl w-200 max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {task.type === 'story'
                ? <IconBooks size={24} className="text-sq-accent shrink-0" />
                : <IconClipboard size={24} className="text-sq-task-icon shrink-0" />
              }
              {editing
                ? <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="bg-transparent text-white font-bold text-2xl outline-none border-b border-sq-accent w-full"
                  />
                : <h2 className="text-white font-bold text-2xl">{task.title}</h2>
              }
            </div>
            {(task.parent || task.parent_id) && (
              <span className="text-sq-muted text-sm ml-9">
                ↳ {task.parent?.title ?? stories.find(s => s.id === task.parent_id)?.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <select
              value={task.status_id}
              onChange={e => updateField('status_id', e.target.value)}
              className="appearance-none px-3 py-1 rounded text-white text-sm font-medium cursor-pointer outline-none"
              style={{ backgroundColor: activeStatus?.color ?? '#6272a4' }}
            >
              {statuses.filter(s => s.label !== 'Request').map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {editing
              ? <button onClick={saveEdit} className="text-sq-accent hover:text-white transition-colors">
                  <IconDeviceFloppy size={20} />
                </button>
              : <button onClick={startEditing} className="text-sq-muted hover:text-white transition-colors">
                  <IconPencil size={18} />
                </button>
            }
            {confirmDelete
              ? <div className="flex items-center gap-2">
                  <button onClick={handleDelete} className="text-xs text-white bg-sq-danger px-2 py-1 rounded font-semibold hover:opacity-80 transition-opacity">
                    Delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-sq-muted hover:text-white transition-colors">
                    <IconX size={14} />
                  </button>
                </div>
              : <button onClick={() => setConfirmDelete(true)} className="text-sq-muted hover:text-sq-danger transition-colors">
                  <IconTrash size={18} />
                </button>
            }
            <button onClick={onClose} className="text-sq-muted hover:text-white transition-colors">
              <IconX size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT */}
          <div className="flex-1 px-6 pb-6 flex flex-col gap-6 overflow-y-auto">

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">Description</label>
              {editing
                ? <textarea
                    value={editDescription}
                    onChange={handleCommentChange}
                    placeholder="Describe the task..."
                    rows={4}
                    className="bg-sq-col border border-sq-muted rounded text-white text-sm p-3 outline-none resize-none placeholder:text-sq-muted"
                  />
                : <p className="text-white/80 text-base leading-relaxed">
                    {task.description || <span className="italic text-sq-muted">No description</span>}
                  </p>
              }
            </div>

            {/* Attachments */}
            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">Attachments</label>

              {/* Thumbnails */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map(a => (
                    <div key={a.id} className="relative group w-20 h-20">
                      <img
                        src={a.url}
                        alt={a.file_name}
                        onClick={() => setPreviewUrl(a.url)}
                        className="w-20 h-20 object-cover rounded-lg cursor-pointer"
                      />
                      {editing && (
                        <button
                          onClick={() => handleDeleteAttachment(a.id, a.url)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <IconX size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload - edit mode*/}
              {editing && (
                <>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="flex items-center gap-1.5 text-sq-muted hover:text-white text-xs cursor-pointer transition-colors w-fit">
                    <IconPlus size={14} /> Upload image
                  </label>
                </>
              )}
            </div>

            {/* Subtasks */}
            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">
                Subtasks ({task.subtasks.filter(s => s.is_done).length}/{task.subtasks.length})
              </label>
              {task.subtasks.length === 0
                ? <span className="text-sq-muted text-xs italic">No subtasks</span>
                : (
                  <div className="flex flex-col gap-1">
                    {task.subtasks.sort((a, b) => a.position - b.position).map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => toggleSubtask(sub)}
                        className="flex items-center gap-3 text-left group"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          sub.is_done ? 'bg-sq-accent border-sq-accent' : 'border-sq-muted group-hover:border-white'
                        }`}>
                          {sub.is_done && <IconCheck size={10} className="text-white" />}
                        </div>
                        <span className={`text-base ${sub.is_done ? 'line-through text-sq-muted' : 'text-white'}`}>
                          {sub.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Linked Tasks */}
            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">
                Linked Tasks {linkedTasks.length > 0 && <span className="text-sq-muted font-normal text-sm">({linkedTasks.length})</span>}
              </label>

              {linkedTasks.length === 0 && !editing && (
                <span className="text-sq-muted text-xs italic">No blocking tasks</span>
              )}

              {linkedTasks.length > 0 && (
                <div className="flex flex-col gap-2">
                  {linkedTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2 bg-sq-col rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <IconLink size={13} className="text-sq-muted shrink-0" />
                        <span className="text-white text-sm truncate">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: t.status.color + '33', color: t.status.color }}
                        >
                          {t.status.label}
                        </span>
                        {editing && (
                          <button onClick={() => removeLinkedTask(t.id)} className="text-sq-muted hover:text-sq-danger transition-colors">
                            <IconX size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editing && (
                <div className="flex items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={e => { addLinkedTask(e.target.value); e.target.value = '' }}
                    className="flex-1 bg-sq-col border border-sq-muted rounded text-white text-sm px-2 py-1.5 outline-none"
                  >
                    <option value="" disabled>Add blocking task...</option>
                    {allTasks
                      .filter(t => !task?.related_task_ids.includes(t.id))
                      .map(t => <option key={t.id} value={t.id}>{t.title}</option>)
                    }
                  </select>
                  <IconPlus size={16} className="text-sq-muted shrink-0" />
                </div>
              )}
            </div>

            {/* Board tags */}
            {task.task_boards.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-white font-semibold text-base">Boards</label>
                <div className="flex gap-2 flex-wrap">
                  {task.task_boards.map((tb, i) => (
                    <div key={i} className="h-6 px-3 rounded-full flex items-center" style={{ backgroundColor: tb.board.color }}>
                      <span className="text-white text-xs font-medium">{tb.board.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
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
                              <button onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.content) }}
                                className="text-sq-muted hover:text-white transition-colors">
                                <IconPencil size={12} />
                              </button>
                            )}
                            {(isAuthor || isAdmin) && (
                              <button onClick={() => handleDeleteComment(c.id)}
                                className="text-sq-muted hover:text-sq-danger transition-colors">
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
                                <button onClick={() => handleEditComment(c.id)}
                                  className="text-xs bg-sq-accent text-white px-2 py-1 rounded font-semibold hover:opacity-90">
                                  Save
                                </button>
                                <button onClick={() => setEditingCommentId(null)}
                                  className="text-xs text-sq-muted hover:text-white transition-colors">
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
                            onMouseDown={e => {
                              e.preventDefault()
                              setComment(prev => prev.replace(/@\w*$/, `@${u.full_name} `))
                              setMentionedIds(prev => [...prev, u.id])
                              setMentionQuery(null)
                            }}
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
          </div>

          {/* RIGHT — sidebar */}
          <div className="w-56 bg-sq-col p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">

            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Assignee</label>
              {editing
                ? <select
                    value={task.assignee ?? ''}
                    onChange={e => updateField('assignee', e.target.value)}
                    className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none"
                  >
                    <option value="">None</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                : <span className="text-white text-sm">{task.assignee_user?.full_name ?? '—'}</span>
              }
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Priority</label>
              {editing
                ? <select
                    value={task.priority}
                    onChange={e => updateField('priority', Number(e.target.value))}
                    className="bg-sq-card border border-sq-muted rounded text-xs px-2 py-1.5 outline-none font-medium"
                    style={{ color: PRIORITY_COLORS[task.priority] }}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                : <span className="text-sm font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
              }
            </div>

            {/* Reviewer */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Reviewer</label>
              {editing
                ? <select
                    value={task.reviewer_id ?? ''}
                    onChange={e => updateField('reviewer_id', e.target.value)}
                    className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none"
                  >
                    <option value="">None</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                : <span className="text-white text-sm">{task.reviewer_user?.full_name ?? '—'}</span>
              }
            </div>

            {/* Period */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Period</label>
              {editing
                ? <input
                    type="date"
                    value={task.start_date ?? ''}
                    onChange={e => updateField('start_date', e.target.value)}
                    className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none"
                  />
                : <span className="text-white text-sm">{getElapsed(task.start_date)}</span>
              }
            </div>

            {/* Story — only for tasks */}
            {task.type === 'task' && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Story</label>
                {editing
                  ? <select
                      value={task.parent_id ?? ''}
                      onChange={e => updateField('parent_id', e.target.value)}
                      className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none"
                    >
                      <option value="">None</option>
                      {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  : <span className="text-white text-sm">{task.parent?.title ?? '—'}</span>
                }
              </div>
            )}

            {/* Team */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Team</label>
              {editing
                ? <select
                    value={responsibleTeamId}
                    onChange={e => updateTeam(e.target.value)}
                    className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none"
                  >
                    <option value="">None</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                : <span className="text-white text-sm">{responsibleTeam?.name ?? '—'}</span>
              }
            </div>

            {/* Team Related — read-only always */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Team Related</label>
              {relatedTeams.length > 0
                ? <div className="flex flex-col gap-1">
                    {relatedTeams.map(t => (
                      <span key={t.team.id} className="text-white text-sm">{t.team.name}</span>
                    ))}
                  </div>
                : <span className="text-sq-muted text-xs italic">None</span>
              }
            </div>

            {/* Version */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Version</label>
              <span className="text-white text-xs">v{task.version}</span>
            </div>

            {/* Creator */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Creator</label>
              <span className="text-white text-sm">{task.creator_user?.full_name ?? '—'}</span>
            </div>

          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}