'use client'

import {
  IconBooks, IconClipboard, IconClock, IconFlame,
  IconMessage, IconRecycle, IconSubtask, IconX,
} from '@tabler/icons-react'

export type TaskCardTask = {
  id: string
  type: 'story' | 'task'
  title: string
  version: number
  priority: number
  status_id: string
  start_date: string | null
  parent_id: string | null
  assignee_user: { full_name: string } | null
  reviewer_user: { full_name: string } | null
  subtasks: { count: number }[]
  comments: { count: number }[]
  task_boards: { board: { name: string; color: string } }[]
  task_teams: { team: { name: string; color: string } }[]
}

type Props = {
  task: TaskCardTask
  storyTitleMap: Record<string, string>
  requestStatusId?: string
  onOpen: () => void
  onRemove?: () => void
}

function timeElapsed(startDate: string | null): string {
  if (!startDate) return ''
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
  const weeks = Math.floor(days / 7)
  const rem = days % 7
  if (weeks === 0) return `${days} day${days !== 1 ? 's' : ''}`
  if (rem === 0) return `${weeks} week${weeks !== 1 ? 's' : ''}`
  return `${weeks} week${weeks !== 1 ? 's' : ''}, ${rem} day${rem !== 1 ? 's' : ''}`
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function TaskCard({ task, storyTitleMap, requestStatusId, onOpen, onRemove }: Props) {
  const subtaskCount = task.subtasks[0]?.count ?? 0
  const commentCount = task.comments[0]?.count ?? 0
  const people = [task.assignee_user, task.reviewer_user].filter(Boolean) as { full_name: string }[]

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.setData('application/sq-task', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      className="bg-sq-card rounded-xl p-3 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing hover:brightness-110 transition-all group"
    >
      {/* Row 1: Icon + Title + Version / Remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {task.type === 'story'
            ? <IconBooks size={20} className="text-sq-accent shrink-0 mt-0.5" />
            : <IconClipboard size={20} className="text-sq-accent shrink-0 mt-0.5" />
          }
          <span className="text-white font-semibold text-sm leading-tight">{task.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="text-sq-muted hover:text-sq-danger transition-colors opacity-0 group-hover:opacity-100"
            >
              <IconX size={12} />
            </button>
          )}
          <IconRecycle size={14} className="text-sq-muted" />
          <span className="text-sq-muted text-xs font-semibold">Ver {task.version}</span>
        </div>
      </div>

      {/* Row 2: Period */}
      {task.start_date && (
        <div className="flex items-center gap-2 pl-1">
          <IconClock size={15} className="text-sq-muted shrink-0" />
          <span className="text-white text-xs">{timeElapsed(task.start_date)}</span>
        </div>
      )}

      {/* Row 3: Story */}
      {task.type === 'task' && task.parent_id && storyTitleMap[task.parent_id] && (
        <div className="flex items-center gap-2 pl-1">
          <IconBooks size={15} className="text-sq-muted shrink-0" />
          <span className="text-white text-xs">{storyTitleMap[task.parent_id]}</span>
        </div>
      )}

      {/* Row 4: Pills */}
      {(task.task_teams.length > 0 || task.task_boards.length > 0) && (
        <div className="flex gap-1.5 flex-wrap">
          {task.task_teams.map((tt, i) => (
            <div key={i} className="h-6 px-3 rounded-full flex items-center bg-sq-col">
              <span className="text-white text-xs font-medium">{tt.team.name}</span>
            </div>
          ))}
          {task.task_boards.map((tb, i) => (
            <div key={i} className="h-6 px-3 rounded-full flex items-center" style={{ backgroundColor: tb.board.color }}>
              <span className="text-white text-xs font-medium">{tb.board.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Request accept/reject */}
      {requestStatusId && task.status_id === requestStatusId && (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button className="flex-1 text-xs py-1 rounded-lg bg-sq-accent text-white font-semibold">Accept</button>
          <button className="flex-1 text-xs py-1 rounded-lg border border-sq-muted text-sq-muted font-semibold">Reject</button>
        </div>
      )}

      {/* Row 5: People + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {people.length > 0
            ? people.map((u, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-sq-accent border-2 border-sq-card -ml-1.5 first:ml-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold leading-none">{initials(u.full_name)}</span>
                </div>
              ))
            : <div className="w-6 h-6 rounded-full bg-sq-nav-inactive border-2 border-sq-card" />
          }
        </div>
        <div className="flex items-center gap-3 text-sq-muted text-xs">
          <button
            onClick={e => { e.stopPropagation(); onOpen() }}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <IconMessage size={14} />
            <span>{commentCount}</span>
          </button>
          {subtaskCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onOpen() }}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <IconSubtask size={14} />
              <span>{subtaskCount}</span>
            </button>
          )}
          {task.priority >= 3 && <IconFlame size={14} className="text-sq-danger" />}
        </div>
      </div>
    </div>
  )
}
