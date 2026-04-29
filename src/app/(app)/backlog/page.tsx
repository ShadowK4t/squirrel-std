'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  IconClipboard, IconSubtask, IconBooks, IconPlus,
  IconSearch, IconAdjustmentsHorizontal, IconX, IconEye, IconEyeOff,
} from '@tabler/icons-react'
import TaskDetailModal from '@/components/task-detail-modal'
import TaskModal from '@/components/task-modal'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}
const PRIORITY_COLORS: Record<number, string> = {
  0: '#6B6B6B', 1: '#50fa7b', 2: '#F3A63A', 3: '#ffb86c', 4: '#B84040',
}

const HIDDEN_TEAMS_KEY = 'backlog_hidden_teams'

type Status = { id: string; label: string; color: string }
type Task = {
  id: string
  title: string
  type: 'story' | 'task'
  parent_id: string | null
  status_id: string
  priority: number
  start_date: string | null
  assignee_user: { full_name: string } | null
  subtasks: { count: number }[]
  task_boards: { board_id: string }[]
}
type Board = { id: string; name: string; color: string; team_id: string }
type Team  = { id: string; name: string; color: string }

export default function BacklogPage() {
  const [teams, setTeams]       = useState<Team[]>([])
  const [boards, setBoards]     = useState<Board[]>([])
  const [tasks, setTasks]       = useState<Task[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading]   = useState(true)

  // Search & filter
  const [search, setSearch]                     = useState('')
  const [filterPriorities, setFilterPriorities] = useState<Set<number>>(new Set())
  const [filterStatuses, setFilterStatuses]     = useState<Set<string>>(new Set())
  const [showFilter, setShowFilter]             = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Hidden teams (persisted to localStorage)
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(HIDDEN_TEAMS_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const teamPickerRef = useRef<HTMLDivElement>(null)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [modalConfig, setModalConfig]   = useState<{ type: 'story' | 'task'; parentId?: string } | null>(null)

  async function fetchData() {
    const supabase = createClient()
    const [{ data: teamsData }, { data: boardsData }, { data: tasksData }, { data: statusesData }] = await Promise.all([
      supabase.from('teams').select('id, name, color').order('name'),
      supabase.from('boards').select('id, name, color, team_id').order('name'),
      supabase.from('tasks')
        .select('id, title, type, parent_id, status_id, priority, start_date, assignee_user:users!assignee(full_name), subtasks(count), task_boards(board_id)')
        .order('type', { ascending: false })
        .order('title'),
      supabase.from('statuses').select('id, label, color').order('position'),
    ])
    if (teamsData)    setTeams(teamsData)
    if (boardsData)   setBoards(boardsData)
    if (tasksData)    setTasks(tasksData as unknown as Task[])
    if (statusesData) setStatuses(statusesData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false)
      if (teamPickerRef.current && !teamPickerRef.current.contains(e.target as Node)) setShowTeamPicker(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggleHiddenTeam(id: string) {
    setHiddenTeams(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(HIDDEN_TEAMS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function togglePriority(p: number) {
    setFilterPriorities(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })
  }

  function toggleStatus(id: string) {
    setFilterStatuses(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function clearFilters() {
    setFilterPriorities(new Set())
    setFilterStatuses(new Set())
    setSearch('')
  }

  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]))
  const hasActiveFilters = filterPriorities.size > 0 || filterStatuses.size > 0

  function matchesFilters(t: Task) {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPriorities.size > 0 && !filterPriorities.has(t.priority)) return false
    if (filterStatuses.size > 0 && !filterStatuses.has(t.status_id)) return false
    return true
  }

  function tasksForBoard(boardId: string) {
    return tasks.filter(t => t.task_boards.some(tb => tb.board_id === boardId))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-sq-muted text-sm">Loading...</span>
    </div>
  )

  const visibleTeams = teams.filter(t => !hiddenTeams.has(t.id))
  const hiddenCount  = hiddenTeams.size

  return (
    <div className="flex flex-col gap-6">

      {/* Toolbar */}
      <div className="flex items-center gap-4">

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-sq-nav-inactive w-72">
          <IconSearch size={16} className="text-sq-nav-inactive shrink-0" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white placeholder:text-sq-nav-inactive text-sm outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-sq-muted hover:text-white transition-colors">
              <IconX size={13} />
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(p => !p)}
            className={`flex items-center gap-2 transition-colors ${hasActiveFilters ? 'text-sq-accent' : 'text-sq-nav-inactive hover:text-white'}`}
          >
            <IconAdjustmentsHorizontal size={18} />
            <span className="text-sm">Filter</span>
            {hasActiveFilters && (
              <span className="bg-sq-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {filterPriorities.size + filterStatuses.size}
              </span>
            )}
          </button>

          {showFilter && (
            <div className="absolute top-10 left-0 z-40 bg-sq-col border border-sq-muted rounded-xl p-4 w-56 flex flex-col gap-4 shadow-xl">
              <div className="flex flex-col gap-2">
                <span className="text-white text-sm font-semibold">Priority</span>
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => {
                  const p = Number(val)
                  const active = filterPriorities.has(p)
                  return (
                    <button key={val} onClick={() => togglePriority(p)}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-sm text-left transition-colors ${active ? 'bg-sq-accent text-white' : 'text-sq-nav-inactive hover:text-white'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-white text-sm font-semibold">Status</span>
                {statuses.filter(s => s.label !== 'Request').map(s => {
                  const active = filterStatuses.has(s.id)
                  return (
                    <button key={s.id} onClick={() => toggleStatus(s.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-sm text-left transition-colors ${active ? 'bg-sq-accent text-white' : 'text-sq-nav-inactive hover:text-white'}`}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </button>
                  )
                })}
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-sq-muted hover:text-white text-xs transition-colors text-left">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Teams visibility */}
        <div className="relative" ref={teamPickerRef}>
          <button
            onClick={() => setShowTeamPicker(p => !p)}
            className={`flex items-center gap-2 transition-colors ${hiddenCount > 0 ? 'text-sq-accent' : 'text-sq-nav-inactive hover:text-white'}`}
          >
            {hiddenCount > 0 ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            <span className="text-sm">Teams</span>
            {hiddenCount > 0 && (
              <span className="bg-sq-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {hiddenCount}
              </span>
            )}
          </button>

          {showTeamPicker && (
            <div className="absolute top-10 left-0 z-40 bg-sq-col border border-sq-muted rounded-xl p-4 w-52 flex flex-col gap-1 shadow-xl">
              <span className="text-white/40 text-xs font-medium mb-1">Click to hide / show</span>
              {teams.map(team => {
                const hidden = hiddenTeams.has(team.id)
                return (
                  <button key={team.id} onClick={() => toggleHiddenTeam(team.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${hidden ? 'text-sq-muted' : 'text-white hover:bg-sq-card'}`}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hidden ? '#6B6B6B' : team.color }} />
                    {team.name}
                    {hidden && <IconEyeOff size={12} className="ml-auto text-sq-muted" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => setModalConfig({ type: 'story' })}
          className="flex items-center gap-2 bg-sq-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity ml-auto"
        >
          <IconPlus size={16} />
          Create
        </button>
      </div>

      {/* Teams */}
      {visibleTeams.map(team => {
        const teamBoards = boards.filter(b => b.team_id === team.id)
        if (teamBoards.length === 0) return null

        return (
          <div key={team.id} className="flex flex-col gap-4">

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
              <span className="text-white font-bold text-lg">{team.name}</span>
            </div>

            {teamBoards.map(board => {
              const boardTasks = tasksForBoard(board.id)
              if (boardTasks.length === 0) return null

              const storyTitleMap = Object.fromEntries(
                boardTasks.filter(t => t.type === 'story').map(t => [t.id, t.title])
              )
              const allFiltered = boardTasks.filter(matchesFilters)

              if (allFiltered.length === 0) return null

              return (
                <div key={board.id} className="flex flex-col rounded-xl overflow-hidden border border-sq-col">

                  <div className="flex items-center gap-2 px-4 py-2 border-b border-sq-col" style={{ backgroundColor: board.color + '22' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: board.color }} />
                    <span className="text-white font-semibold text-sm">{board.name}</span>
                    <span className="text-white/40 text-xs ml-1">{allFiltered.length} items</span>
                  </div>

                  <div className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2 bg-sq-col border-b border-sq-col/60">
                    <span />
                    <span className="text-white/40 text-xs font-medium">Title</span>
                    <span className="text-white/40 text-xs font-medium">Status</span>
                    <span className="text-white/40 text-xs font-medium">Active for</span>
                    <span className="text-white/40 text-xs font-medium">Priority</span>
                    <span className="text-white/40 text-xs font-medium">Assignee</span>
                    <span className="text-white/40 text-xs font-medium text-center">Sub</span>
                  </div>

                  <div className="flex flex-col divide-y divide-sq-col/40 bg-sq-card">
                    {allFiltered.map(task => (
                      <div key={task.id} onClick={() => setSelectedTaskId(task.id)}
                        className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2.5 hover:bg-sq-col/40 transition-colors items-center cursor-pointer">
                        <div className="flex items-center justify-center">
                          {task.type === 'story'
                            ? <IconBooks size={14} className="text-sq-accent" />
                            : <IconClipboard size={13} className="text-sq-task-icon" />
                          }
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm truncate ${task.type === 'story' ? 'text-white font-semibold' : 'text-white'}`}>
                            {task.title}
                          </span>
                          {task.type === 'task' && task.parent_id && storyTitleMap[task.parent_id] && (
                            <span className="text-sq-muted text-xs truncate">↳ {storyTitleMap[task.parent_id]}</span>
                          )}
                        </div>
                        <StatusBadge status={statusMap[task.status_id]} />
                        <span className="text-white text-xs">{timeElapsed(task.start_date)}</span>
                        <PriorityBadge priority={task.priority} />
                        <span className="text-white text-xs truncate">{task.assignee_user?.full_name ?? '—'}</span>
                        <div className="flex items-center justify-center gap-1 text-white/40 text-xs">
                          <IconSubtask size={11} />
                          <span>{task.subtasks[0]?.count ?? 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {hiddenCount > 0 && (
        <p className="text-sq-muted text-xs text-center">
          {hiddenCount} team{hiddenCount > 1 ? 's' : ''} hidden — use the Teams button to show them
        </p>
      )}

      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onUpdated={fetchData} />
      )}
      {modalConfig && (
        <TaskModal
          defaultType={modalConfig.type}
          defaultParentId={modalConfig.parentId}
          onClose={() => setModalConfig(null)}
          onCreated={() => { setModalConfig(null); fetchData() }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status?: Status }) {
  if (!status) return <span className="text-white/40 text-xs">—</span>
  return (
    <div className="h-5 px-2 rounded-full flex items-center w-fit" style={{ backgroundColor: status.color }}>
      <span className="text-white text-xs font-medium">{status.label}</span>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className="text-xs font-medium" style={{ color: PRIORITY_COLORS[priority] }}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function timeElapsed(startDate: string | null): string {
  if (!startDate) return '—'
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)
  const weeks = Math.floor(days / 7)
  const rem = days % 7
  if (weeks === 0) return `${days}d`
  if (rem === 0) return `${weeks}w`
  return `${weeks}w ${rem}d`
}
