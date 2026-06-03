'use client'

import {
  IconClipboard,
  IconLock, IconMessage, IconRecycle, IconSubtask, IconX,
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
  assignee_user: { id: string; full_name: string; avatar_url?: string | null } | null
  reviewer_user: { id: string; full_name: string; avatar_url?: string | null } | null
  subtasks: { count: number }[]
  comments: { count: number }[]
  task_boards: { board: { name: string; color: string } }[]
  task_teams: { team: { name: string; color: string } }[]
}

type Props = {
  task: TaskCardTask
  storyTitleMap: Record<string, string>
  requestStatusId?: string
  isBlocked?: boolean
  onOpen: () => void
  onRemove?: () => void
  onAccept?: () => void
  onReject?: () => void
  onApprove?: () => void
  onUserClick?: (userId: string) => void
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

export default function TaskCard({ task, storyTitleMap, requestStatusId, isBlocked, onOpen, onRemove, onAccept, onReject, onApprove, onUserClick }: Props) {
  const subtaskCount = task.subtasks[0]?.count ?? 0
  const commentCount = task.comments[0]?.count ?? 0
  const people = [task.assignee_user, task.reviewer_user].filter(Boolean) as { id: string; full_name: string; avatar_url?: string | null }[]

  return (
    <div
      draggable
      onDragStart={e => {
        e.stopPropagation()
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.setData('application/sq-task', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      className={`bg-sq-card rounded-xl p-3 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing hover:brightness-110 transition-all group ${isBlocked ? 'ring-1 ring-red-500/50' : ''}`}
    >
      {/* Row 1: Icon + Title + Version / Remove */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {task.type === 'story'
            ? <img src="/icons/story.svg" width={20} height={20} alt="" className="shrink-0 mt-0.5" />
            : <IconClipboard size={20} className="text-sq-accent shrink-0 mt-0.5" />
          }
          <span className="text-white font-semibold text-sm leading-tight">{task.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isBlocked && <IconLock size={12} className="text-red-400 shrink-0" />}
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
          <img src="/icons/period.svg" width={15} height={15} alt="" className="shrink-0 opacity-60" />
          <span className="text-white text-xs">{timeElapsed(task.start_date)}</span>
        </div>
      )}

      {/* Row 3: Story */}
      {task.type === 'task' && task.parent_id && storyTitleMap[task.parent_id] && (
        <div className="flex items-center gap-2 pl-1">
          <img src="/icons/story.svg" width={15} height={15} alt="" className="shrink-0 opacity-60" />
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

      {/* Approve — reviewer only, lead/admin */}
      {onApprove && (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onApprove} className="flex-1 text-xs py-1 rounded-lg bg-green-700 text-white font-semibold hover:opacity-90 transition-opacity">
            Approve
          </button>
        </div>
      )}

      {/* Request accept/reject */}
      {requestStatusId && task.status_id === requestStatusId && (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={onAccept} className="flex-1 text-xs py-1 rounded-lg bg-sq-accent text-white font-semibold hover:opacity-90 transition-opacity">Accept</button>
          <button onClick={onReject} className="flex-1 text-xs py-1 rounded-lg border border-sq-muted text-sq-muted font-semibold hover:border-red-400 hover:text-red-400 transition-colors">Reject</button>
        </div>
      )}

      {/* Row 5: People + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {people.length > 0
            ? people.map((u, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); onUserClick?.(u.id) }}
                  className="w-6 h-6 rounded-full bg-sq-accent border-2 border-sq-card -ml-1.5 first:ml-0 flex items-center justify-center hover:ring-2 hover:ring-white/40 transition-all overflow-hidden"
                  title={u.full_name}
                >
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-bold leading-none">{initials(u.full_name)}</span>
                  }
                </button>
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
          {task.priority >= 3 && <img src="/icons/priority-red.svg" width={14} height={14} alt="" />}
        </div>
      </div>
    </div>
  )
}
