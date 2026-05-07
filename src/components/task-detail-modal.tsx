'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconClipboard, IconBooks, IconX, IconPencil, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import type { Status, User, Team, TaskDetail } from './task-detail-types'
import { PRIORITY_LABELS, PRIORITY_COLORS } from './task-detail-types'
import TaskDetailOverview from './task-detail-overview'
import TaskDetailRelations from './task-detail-relations'
import TaskDetailActivity from './task-detail-activity'

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
  const [task, setTask]           = useState<TaskDetail | null>(null)
  const [statuses, setStatuses]   = useState<Status[]>([])
  const [users, setUsers]         = useState<User[]>([])
  const [teams, setTeams]         = useState<Team[]>([])
  const [stories, setStories]     = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
        task_teams(is_responsible, team:teams(id, name, color))
      `)
      .eq('id', taskId)
      .single()

    if (data) setTask(data as unknown as TaskDetail)
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
    supabase.from('tasks').select('id, title').eq('type', 'story').neq('id', taskId).order('title')
      .then(({ data }) => { if (data) setStories(data) })
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
    const normalized = value === '' ? null : value
    await supabase.from('tasks').update({ [field]: normalized }).eq('id', taskId)
    setTask(prev => prev ? { ...prev, [field]: normalized } : prev)
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

  async function handleDelete() {
    await supabase.from('tasks').delete().eq('id', taskId)
    onUpdated()
    onClose()
  }

  const activeStatus      = statuses.find(s => s.id === task?.status_id)
  const responsibleTeamId = task?.task_teams.find(t => t.is_responsible)?.team.id ?? ''
  const responsibleTeam   = task?.task_teams.find(t => t.is_responsible)?.team
  const relatedTeams      = task?.task_teams.filter(t => !t.is_responsible) ?? []

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
              ? <button onClick={saveEdit} className="bg-sq-accent text-sq-col px-1.5 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 text-xs font-semibold">
                  <IconDeviceFloppy size={13} />
                </button>
              : <button onClick={startEditing} className="bg-sq-accent text-sq-col px-1.5 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 text-xs font-semibold">
                  <IconPencil size={13} />
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

          {/* Left — scrollable content */}
          <div className="flex-1 px-6 py-6 flex flex-col gap-6 overflow-y-auto">
            <TaskDetailOverview
              taskId={taskId}
              task={task}
              editing={editing}
              editDescription={editDescription}
              onDescriptionChange={setEditDescription}
              onRefresh={fetchTask}
            />
            <TaskDetailRelations
              taskId={taskId}
              task={task}
              editing={editing}
              onRefresh={fetchTask}
            />
            <TaskDetailActivity
              taskId={taskId}
              task={task}
              users={users}
              onRefresh={fetchTask}
            />
          </div>

          {/* Right — always-visible sidebar */}
          <div className="w-56 bg-sq-col p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">

            {/* Assignee */}
            {(editing || task.assignee_user) && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Assignee</label>
                {editing
                  ? <select value={task.assignee ?? ''} onChange={e => updateField('assignee', e.target.value)}
                      className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                      <option value="">None</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  : <span className="text-white text-sm">{task.assignee_user?.full_name}</span>
                }
              </div>
            )}

            {/* Priority */}
            {(editing || task.priority !== 0) && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Priority</label>
                {editing
                  ? <select value={task.priority ?? 0} onChange={e => updateField('priority', Number(e.target.value))}
                      className="bg-sq-card border border-sq-muted rounded text-xs px-2 py-1.5 outline-none font-medium"
                      style={{ color: PRIORITY_COLORS[task.priority] }}>
                      {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  : <span className="text-sm font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                }
              </div>
            )}

            {/* Reviewer — tasks only */}
            {task.type !== 'story' && (editing || task.reviewer_user) && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Reviewer</label>
                {editing
                  ? <select value={task.reviewer_id ?? ''} onChange={e => updateField('reviewer_id', e.target.value)}
                      className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                      <option value="">None</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  : <span className="text-white text-sm">{task.reviewer_user?.full_name}</span>
                }
              </div>
            )}

            {/* Period */}
            {(editing || task.start_date) && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Period</label>
                {editing
                  ? <input type="date" value={task.start_date ?? ''} onChange={e => updateField('start_date', e.target.value)}
                      className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none" />
                  : <span className="text-white text-sm">{getElapsed(task.start_date)}</span>
                }
              </div>
            )}

            {/* Story — tasks only */}
            {task.type === 'task' && (editing || task.parent_id) && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Story</label>
                {editing
                  ? <select value={task.parent_id ?? ''} onChange={e => updateField('parent_id', e.target.value)}
                      className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                      <option value="">None</option>
                      {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  : <span className="text-white text-sm">{task.parent?.title}</span>
                }
              </div>
            )}

            {/* Team */}
            {(editing || responsibleTeam) && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Team</label>
                {editing
                  ? <select value={responsibleTeamId} onChange={e => updateTeam(e.target.value)}
                      className="bg-sq-card border border-sq-muted rounded text-white text-sm px-2 py-2 outline-none">
                      <option value="">None</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  : <span className="text-white text-sm">{responsibleTeam?.name}</span>
                }
              </div>
            )}

            {/* Team Related */}
            {relatedTeams.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Team Related</label>
                <div className="flex flex-col gap-1">
                  {relatedTeams.map(t => (
                    <span key={t.team.id} className="text-white text-sm">{t.team.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Version */}
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Version</label>
              <span className="text-white text-xs">v{task.version}</span>
            </div>

            {/* Creator */}
            {task.creator_user && (
              <div className="flex flex-col gap-1">
                <label className="text-white text-sm font-medium">Creator</label>
                <span className="text-white text-sm">{task.creator_user.full_name}</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
