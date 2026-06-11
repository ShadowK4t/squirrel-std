'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconClipboard, IconLink, IconX, IconPlus, IconTrash } from '@tabler/icons-react'
import RichTextEditor from '@/components/rich-text-editor'
import { createNotification } from '@/lib/notifications'

type Status = { id: string; label: string; color: string }
type User   = { id: string; full_name: string }
type Story  = { id: string; title: string; task_boards: { board_id: string }[] }
type Board  = { id: string; name: string; team_id: string }
type Team   = { id: string; name: string; color: string }

const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}

type Props = {
  onClose: () => void
  onCreated: () => void
  defaultType?: 'story' | 'task'
  defaultParentId?: string
  defaultStatusLabel?: string
}

export default function TaskModal({ onClose, onCreated, defaultType = 'task', defaultParentId = '', defaultStatusLabel = 'To Do' }: Props) {
  const [statuses, setStatuses]       = useState<Status[]>([])
  const [users, setUsers]             = useState<User[]>([])
  const [stories, setStories]         = useState<Story[]>([])
  const [boards, setBoards]           = useState<Board[]>([])
  const [teams, setTeams]             = useState<Team[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Form state
  const [type, setType]               = useState<'story' | 'task'>(defaultType)
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [statusId, setStatusId]       = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [reviewerId, setReviewerId]   = useState('')
  const [priority, setPriority]       = useState(2)
  const [startDate, setStartDate]     = useState('')
  const [parentId, setParentId]       = useState(defaultParentId)
  const [teamId, setTeamId]           = useState('')
  const [boardId, setBoardId]         = useState('')
  const [subtasks, setSubtasks]           = useState<string[]>([''])
  const [linkedTaskIds, setLinkedTaskIds]     = useState<string[]>([])
  const [newLinkedTaskId, setNewLinkedTaskId] = useState('')
  const [allTasks, setAllTasks]               = useState<{ id: string; title: string }[]>([])
  const [stagedFiles, setStagedFiles]         = useState<{ file: File; preview: string }[]>([])

  useEffect(() => {
    const supabase = createClient()

    supabase.from('statuses').select('id, label, color').order('position')
      .then(({ data }) => {
        if (data) {
          setStatuses(data)
          const match = data.find(s => s.label === defaultStatusLabel) ?? data.find(s => s.label === 'To Do')
          if (match) setStatusId(match.id)
        }
      })

    supabase.from('users').select('id, full_name')
      .then(({ data }) => { if (data) setUsers(data) })

    supabase.from('tasks').select('id, title, task_boards(board_id)').eq('type', 'story')
      .then(({ data }) => { if (data) setStories(data as unknown as Story[]) })

    supabase.from('tasks').select('id, title').order('title')
      .then(({ data }) => { if (data) setAllTasks(data) })

    supabase.from('boards').select('id, name, team_id').order('name')
      .then(({ data }) => { if (data) setBoards(data) })

    supabase.from('teams').select('id, name, color').order('name')
      .then(({ data }) => { if (data) setTeams(data) })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('id, full_name').eq('id', user.id).single()
          .then(({ data }) => { if (data) setCurrentUser(data) })
      }
    })
  }, [])

  // When a parent story is selected, inherit its board and team
  useEffect(() => {
    if (!parentId) return
    const parent = stories.find(s => s.id === parentId)
    const inheritedBoardId = parent?.task_boards[0]?.board_id
    if (!inheritedBoardId) return
    setBoardId(inheritedBoardId)
    const board = boards.find(b => b.id === inheritedBoardId)
    if (board) setTeamId(board.team_id)
  }, [parentId, stories, boards])

  const teamBoards = boards.filter(b => b.team_id === teamId)
  const activeStatus = statuses.find(s => s.id === statusId)

  const subtaskRefs = useRef<(HTMLInputElement | null)[]>([])
  const pendingFocusRef = useRef(false)

  function addSubtask() {
    setSubtasks(prev => [...prev, ''])
    pendingFocusRef.current = true
  }

  useEffect(() => {
    if (pendingFocusRef.current) {
      subtaskRefs.current[subtasks.length - 1]?.focus()
      pendingFocusRef.current = false
    }
  }, [subtasks.length])
  function updateSubtask(i: number, v: string) { setSubtasks(prev => prev.map((s, idx) => idx === i ? v : s)) }
  function removeSubtask(i: number) { setSubtasks(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit() {
    if (!title.trim()) return setError('Title is required')
    
    if (type === 'task' && !reviewerId) return setError('Reviewer is required')

    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        status_id: statusId,
        assignee: null,
        reviewer_id: reviewerId || null,
        priority,
        start_date: startDate || null,
        parent_id: type === 'task' ? (parentId || null) : null,
        created_by: currentUser?.id,
        type,
        related_task_ids: linkedTaskIds.length > 0 ? linkedTaskIds : [],
      })
      .select('id')
      .single()

    if (taskError || !task) {
      setError('Failed to create')
      setLoading(false)
      return
    }

    const validSubtasks = subtasks.filter(s => s.trim())
    if (validSubtasks.length > 0) {
      await supabase.from('subtasks').insert(
        validSubtasks.map((title, position) => ({
          task_id: task.id, title: title.trim(), is_done: false, position,
        }))
      )
    }

    if (teamId) {
      await supabase.from('task_teams').insert({ task_id: task.id, team_id: teamId, is_responsible: true })
    }

    if (boardId) {
      await supabase.from('task_boards').insert({ task_id: task.id, board_id: boardId })
    }

    if (stagedFiles.length > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        for (const { file } of stagedFiles) {
          const path = `${task.id}/${Date.now()}_${file.name}`
          const { error } = await supabase.storage.from('task-images').upload(path, file)
          if (error) continue
          const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(path)
          await supabase.from('task_attachments').insert({
            task_id: task.id, url: publicUrl, file_name: file.name, type: 'image', uploaded_by: user.id,
          })
        }
      }
    }

    if (assigneeIds.length > 0) {
      await supabase.from('task_assignees').insert(
        assigneeIds.map(userId => ({ task_id: task.id, user_id: userId }))
      )
      const isRequest = activeStatus?.label === 'Request'
      for (const userId of assigneeIds) {
        await createNotification({
          userId,
          type: 'task_assigned',
          taskId: task.id,
          message: isRequest
            ? `${currentUser?.full_name ?? 'Someone'} sent you a request: "${title.trim()}"`
            : `${currentUser?.full_name ?? 'Someone'} assigned you a task: "${title.trim()}"`,
        })
      }
    }

    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

      <div className="relative bg-sq-card rounded-xl w-200 max-h-[90vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex flex-col gap-2 flex-1 min-w-0">

            {/* Type toggle */}
            <div className="flex items-center gap-1 bg-sq-col rounded-lg p-1 w-fit">
              <button
                onClick={() => { setType('story'); setParentId('') }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  type === 'story' ? 'bg-sq-accent text-white' : 'text-sq-muted hover:text-white'
                }`}
              >
                <img src="/icons/story-red.svg" width={13} height={13} alt="" /> Story
              </button>
              <button
                onClick={() => setType('task')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  type === 'task' ? 'bg-sq-accent text-white' : 'text-sq-muted hover:text-white'
                }`}
              >
                <IconClipboard size={13} /> Task
              </button>
            </div>

            <div className="flex items-center gap-3">
              {type === 'story'
                ? <img src="/icons/story-red.svg" width={24} height={24} alt="" className="shrink-0" />
                : <IconClipboard size={24} className="text-sq-task-icon shrink-0" />
              }
              <input
                type="text"
                placeholder={type === 'story' ? 'Story title...' : 'Task title...'}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-transparent text-white font-bold text-2xl outline-none placeholder:text-sq-muted w-full"
              />
            </div>

            {type === 'task' && parentId && (
              <span className="text-sq-muted text-sm ml-9">
                ↳ {stories.find(s => s.id === parentId)?.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-4">
            <select
              value={statusId}
              onChange={e => setStatusId(e.target.value)}
              className="appearance-none px-3 py-1 rounded text-white text-sm font-medium cursor-pointer outline-none"
              style={{ backgroundColor: activeStatus?.color ?? '#6272a4' }}
            >
              {statuses.filter(s => s.label !== 'Request').map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <button onClick={onClose} className="text-sq-muted hover:text-white transition-colors">
              <IconX size={20} />
            </button>
          </div>
        </div>

        {/* Body — same layout for both story and task */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT */}
          <div className="flex-1 px-6 pb-6 flex flex-col gap-6 overflow-y-auto">

            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">Description</label>
              <RichTextEditor
                content={description}
                onChange={setDescription}
                placeholder={type === 'story' ? 'What is this story about?' : 'Describe the task...'}
                minHeight="72px"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-white font-semibold text-base">Attachments</label>
                <span className="text-sq-muted text-xs">{stagedFiles.length}/5</span>
              </div>
              {stagedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stagedFiles.map((f, i) => (
                    <div key={i} className="relative group w-20 h-20">
                      <img src={f.preview} alt={f.file.name} className="w-20 h-20 object-cover rounded-lg" />
                      <button
                        onClick={() => setStagedFiles(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, idx) => idx !== i) })}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <IconX size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {stagedFiles.length < 5
                ? <>
                    <input
                      id="create-file-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={e => {
                        const files = Array.from(e.target.files ?? []).slice(0, 5 - stagedFiles.length)
                        setStagedFiles(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
                        e.target.value = ''
                      }}
                      className="hidden"
                    />
                    <label htmlFor="create-file-upload" className="flex items-center gap-1.5 text-sq-muted hover:text-white text-xs cursor-pointer transition-colors w-fit">
                      <IconPlus size={14} /> Upload image ({5 - stagedFiles.length} remaining)
                    </label>
                  </>
                : <span className="text-sq-muted text-xs italic">Maximum 5 images reached</span>
              }
            </div>

            {type === 'task' && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-white font-semibold text-base">
                  <img src="/icons/story-red.svg" width={16} height={16} alt="" />
                  Story
                </label>
                <select
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  className="bg-sq-col border border-sq-muted rounded text-white text-sm px-3 py-2 outline-none"
                >
                  <option value="">Select a story...</option>
                  {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">Subtasks</label>
              <div className="flex flex-col gap-1">
                {subtasks.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      ref={el => { subtaskRefs.current[i] = el }}
                      type="text"
                      value={sub}
                      onChange={e => updateSubtask(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (i < subtasks.length - 1) subtaskRefs.current[i + 1]?.focus()
                          else addSubtask()
                        }
                      }}
                      placeholder={`Subtask ${i + 1}`}
                      className="flex-1 bg-sq-col border border-sq-muted rounded text-white text-sm px-3 py-2 outline-none placeholder:text-sq-muted"
                    />
                    {subtasks.length > 1 && (
                      <button onClick={() => removeSubtask(i)} className="text-sq-muted hover:text-sq-danger transition-colors">
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addSubtask}
                className="flex items-center gap-1 text-sq-muted hover:text-white text-xs transition-colors w-fit"
              >
                <IconPlus size={14} /> Add subtask
              </button>
            </div>

            {/* Linked Tasks */}
            <div className="flex flex-col gap-2">
              <label className="text-white font-semibold text-base">Linked Tasks</label>
              {linkedTaskIds.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {linkedTaskIds.map(id => {
                    const t = allTasks.find(t => t.id === id)
                    if (!t) return null
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 bg-sq-col rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <IconLink size={13} className="text-sq-muted shrink-0" />
                          <span className="text-white text-sm truncate">{t.title}</span>
                        </div>
                        <button
                          onClick={() => setLinkedTaskIds(prev => prev.filter(i => i !== id))}
                          className="text-sq-muted hover:text-sq-danger transition-colors shrink-0"
                        >
                          <IconX size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <select
                value={newLinkedTaskId}
                onChange={e => {
                  const val = e.target.value
                  if (!val) return
                  setLinkedTaskIds(prev => prev.includes(val) ? prev : [...prev, val])
                  setNewLinkedTaskId('')
                }}
                className="bg-sq-col border border-sq-muted rounded text-white text-sm px-3 py-2 outline-none"
              >
                <option value="">Add blocking task...</option>
                {allTasks
                  .filter(t => !linkedTaskIds.includes(t.id))
                  .map(t => <option key={t.id} value={t.id}>{t.title}</option>)
                }
              </select>
            </div>

            {error && <p className="text-sq-danger text-sm">{error}</p>}
          </div>

          {/* RIGHT sidebar */}
          <div className="w-56 bg-sq-col rounded-br-xl p-4 flex flex-col gap-4 shrink-0">

            <div className="flex flex-col gap-1.5">
              <label className="text-white text-sm font-medium">Assignees</label>
              {assigneeIds.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {assigneeIds.map(id => {
                    const u = users.find(u => u.id === id)
                    return u ? (
                      <div key={id} className="flex items-center justify-between">
                        <span className="text-white text-sm">{u.full_name}</span>
                        <button onClick={() => setAssigneeIds(prev => prev.filter(a => a !== id))} className="text-sq-muted hover:text-sq-danger transition-colors text-xs">×</button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
              {users.filter(u => !assigneeIds.includes(u.id)).length > 0 && (
                <select value="" onChange={e => e.target.value && setAssigneeIds(prev => [...prev, e.target.value])}
                  className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-1.5 outline-none">
                  <option value="">+ Add assignee</option>
                  {users.filter(u => !assigneeIds.includes(u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Priority</label>
              <select value={priority} onChange={e => setPriority(Number(e.target.value))}
                className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Reviewer <span className="text-red-500">*</span></label>
              <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}
                className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                <option value="">Select...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Team</label>
              <select value={teamId} onChange={e => { setTeamId(e.target.value); setBoardId('') }}
                className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                <option value="">Select...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Board</label>
              {!teamId && <span className="text-sq-muted text-xs">Select a team first</span>}
              <select value={boardId} onChange={e => setBoardId(e.target.value)}
                className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none"
                disabled={!teamId}>
                <option value="">Select...</option>
                {teamBoards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Creator</label>
              <span className="text-white text-xs">{currentUser?.full_name ?? '—'}</span>
            </div>

            <div className="mt-auto pt-4 flex flex-col gap-2">
              <button onClick={handleSubmit} disabled={loading}
                className="w-full bg-sq-accent text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? 'Creating...' : type === 'story' ? 'Create Story' : 'Create Task'}
              </button>
              <button onClick={onClose}
                className="w-full border border-sq-muted text-sq-muted text-sm py-2 rounded-lg hover:text-white hover:border-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
