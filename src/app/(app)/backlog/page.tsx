'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  IconChevronRight, IconClipboard, IconSubtask, IconPlus,
  IconSearch, IconX, IconEye, IconEyeOff,
} from '@tabler/icons-react'
import TaskDetailModal from '@/components/task-detail-modal'
import TaskModal from '@/components/task-modal'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}
const PRIORITY_COLORS: Record<number, string> = {
  0: '#6B6B6B', 1: '#50fa7b', 2: '#F3A63A', 3: '#ffb86c', 4: '#B84040',
}

const HIDDEN_TEAMS_KEY      = 'backlog_hidden_teams'
const FILTER_PRIORITIES_KEY = 'backlog_filter_priorities'
const FILTER_STATUSES_KEY   = 'backlog_filter_statuses'
const SHOW_DONE_KEY         = 'backlog_show_done'
const SHOW_FUTURE_KEY       = 'backlog_show_future'

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
  const [filterPriorities, setFilterPriorities] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(FILTER_PRIORITIES_KEY)
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set()
    } catch { return new Set() }
  })
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(FILTER_STATUSES_KEY)
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [showDone, setShowDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = localStorage.getItem(SHOW_DONE_KEY)
      return stored ? JSON.parse(stored) : false
    } catch { return false }
  })
  const [showFuture, setShowFuture] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const stored = localStorage.getItem(SHOW_FUTURE_KEY)
      return stored !== null ? JSON.parse(stored) : true
    } catch { return true }
  })
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
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const teamPickerRef = useRef<HTMLDivElement>(null)

  const [openStories, setOpenStories]       = useState<Set<string>>(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [modalConfig, setModalConfig]       = useState<{ type: 'story' | 'task'; parentId?: string } | null>(null)
  const [dragTaskId, setDragTaskId]               = useState<string | null>(null)
  const [dragOverStoryId, setDragOverStoryId]     = useState<string | null>(null)
  const [dragOverBoardId, setDragOverBoardId]     = useState<string | null>(null)
  const [showAddTable, setShowAddTable]           = useState(false)
  const [newTableName, setNewTableName]           = useState('')
  const [newTableColor, setNewTableColor]         = useState('#6272a4')
  const [newTableTeamId, setNewTableTeamId]       = useState('')

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

  function toggleStory(id: string) {
    setOpenStories(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function togglePriority(p: number) {
    setFilterPriorities(prev => {
      const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p)
      localStorage.setItem(FILTER_PRIORITIES_KEY, JSON.stringify([...n]))
      return n
    })
  }

  function toggleStatus(id: string) {
    setFilterStatuses(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id)
      localStorage.setItem(FILTER_STATUSES_KEY, JSON.stringify([...n]))
      return n
    })
  }

  function toggleShowDone() {
    setShowDone(prev => {
      const next = !prev
      localStorage.setItem(SHOW_DONE_KEY, JSON.stringify(next))
      return next
    })
  }

  function toggleShowFuture() {
    setShowFuture(prev => {
      const next = !prev
      localStorage.setItem(SHOW_FUTURE_KEY, JSON.stringify(next))
      return next
    })
  }

  async function createTable() {
    if (!newTableName.trim() || !newTableTeamId) return
    const supabase = createClient()
    await supabase.from('boards').insert({ name: newTableName.trim(), color: newTableColor, team_id: newTableTeamId })
    setShowAddTable(false)
    setNewTableName('')
    setNewTableColor('#6272a4')
    setNewTableTeamId('')
    fetchData()
  }

  async function handleDropOnStory(storyId: string) {
    if (!dragTaskId) return
    const supabase = createClient()
    await supabase.from('tasks').update({ parent_id: storyId }).eq('id', dragTaskId)
    setDragTaskId(null)
    setDragOverStoryId(null)
    setDragOverBoardId(null)
    fetchData()
  }

  async function handleDropOnBoard() {
    if (!dragTaskId) return
    const supabase = createClient()
    await supabase.from('tasks').update({ parent_id: null }).eq('id', dragTaskId)
    setDragTaskId(null)
    setDragOverStoryId(null)
    setDragOverBoardId(null)
    fetchData()
  }

  function clearFilters() {
    setFilterPriorities(new Set())
    setFilterStatuses(new Set())
    setSearch('')
    localStorage.removeItem(FILTER_PRIORITIES_KEY)
    localStorage.removeItem(FILTER_STATUSES_KEY)
  }

  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]))
  const hasActiveFilters = filterPriorities.size > 0 || filterStatuses.size > 0

  const today = new Date(); today.setHours(0, 0, 0, 0)

  function matchesFilters(t: Task) {
    if (statusMap[t.status_id]?.label === 'Done') return false
    if (!showFuture && t.start_date && new Date(t.start_date) > today) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPriorities.size > 0 && !filterPriorities.has(t.priority)) return false
    if (filterStatuses.size > 0 && !filterStatuses.has(t.status_id)) return false
    return true
  }

  function tasksForBoard(boardId: string) {
    return tasks.filter(t => t.task_boards.some(tb => tb.board_id === boardId))
  }

  const allUnassigned          = tasks.filter(t => t.task_boards.length === 0)
  const unassignedStories      = allUnassigned.filter(t => t.type === 'story')
  const unassignedChildMap     = allUnassigned.reduce<Record<string, Task[]>>((acc, t) => {
    if (t.type === 'task' && t.parent_id) { (acc[t.parent_id] ??= []).push(t) }
    return acc
  }, {})
  const unassignedOrphans      = allUnassigned.filter(t =>
    t.type === 'task' && (!t.parent_id || !unassignedStories.some(s => s.id === t.parent_id))
  )
  const filteredUnassignedStories = unassignedStories.filter(story =>
    matchesFilters(story) || (unassignedChildMap[story.id] ?? []).some(matchesFilters)
  )
  const filteredUnassignedOrphans = unassignedOrphans.filter(matchesFilters)

  const doneTasks = tasks.filter(t => {
    if (statusMap[t.status_id]?.label !== 'Done') return false
    if (!showFuture && t.start_date && new Date(t.start_date) > today) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPriorities.size > 0 && !filterPriorities.has(t.priority)) return false
    return true
  })

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
            <img src="/icons/filter.svg" width={18} height={18} alt="" />
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
                {statuses.filter(s => s.label !== 'Request' && s.label !== 'Done').map(s => {
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

        {/* Future toggle */}
        <button
          onClick={toggleShowFuture}
          className={`flex items-center gap-2 text-sm transition-colors ${showFuture ? 'text-sq-accent' : 'text-sq-nav-inactive hover:text-white'}`}
        >
          <img src="/icons/period.svg" width={18} height={18} alt="" />
          Future
        </button>

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

        <div
          className="relative ml-auto"
          onMouseEnter={() => setShowCreateMenu(true)}
          onMouseLeave={() => setShowCreateMenu(false)}
        >
          <button className="flex items-center gap-2 bg-sq-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            <IconPlus size={16} />
            Create
          </button>
          {showCreateMenu && (
            <div className="absolute right-0 top-full pt-1 z-40">
              <div className="bg-sq-col border border-sq-muted rounded-xl overflow-hidden shadow-xl w-44">
                <button onClick={() => {}} className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-sq-card transition-colors">
                  Add Request
                </button>
                <button onClick={() => { setModalConfig({ type: 'task' }); setShowCreateMenu(false) }} className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-sq-card transition-colors">
                  Add Task
                </button>
                <button onClick={() => { setShowAddTable(true); setShowCreateMenu(false) }} className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-sq-card transition-colors">
                  Add Table
                </button>

              </div>
            </div>
          )}
        </div>
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

              const stories  = boardTasks.filter(t => t.type === 'story')
              const orphans  = boardTasks.filter(t => t.type === 'task' && !t.parent_id)
              const childMap = boardTasks.reduce<Record<string, Task[]>>((acc, t) => {
                if (t.type === 'task' && t.parent_id) {
                  ;(acc[t.parent_id] ??= []).push(t)
                }
                return acc
              }, {})

              const filteredStories = stories.filter(story => {
                const children = childMap[story.id] ?? []
                return matchesFilters(story) || children.some(matchesFilters)
              })
              const filteredOrphans = orphans.filter(matchesFilters)

              if (filteredStories.length === 0 && filteredOrphans.length === 0) return null

              return (
                <div key={board.id} className="flex flex-col rounded-xl overflow-hidden border border-sq-col">

                  <div className="flex items-center gap-2 px-4 py-2 border-b border-sq-col" style={{ backgroundColor: board.color + '22' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: board.color }} />
                    <span className="text-white font-semibold text-sm">{board.name}</span>
                    <span className="text-white/40 text-xs ml-1">{filteredStories.length + filteredOrphans.length} items</span>
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

                  <div
                    className={`flex flex-col divide-y divide-sq-col/40 bg-sq-card transition-colors ${dragTaskId && dragOverBoardId === board.id && !dragOverStoryId ? 'ring-1 ring-inset ring-sq-accent/30' : ''}`}
                    onDragOver={e => { if (!dragTaskId) return; e.preventDefault(); setDragOverBoardId(board.id) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverBoardId(null) }}
                    onDrop={() => handleDropOnBoard()}
                  >

                    {filteredStories.map(story => {
                      const allChildren     = childMap[story.id] ?? []
                      const visibleChildren = allChildren.filter(matchesFilters)
                      const isOpen          = openStories.has(story.id)

                      return (
                        <div key={story.id}>
                          <div
                            className={`grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2.5 transition-colors items-center group ${dragTaskId && dragOverStoryId === story.id ? 'bg-sq-accent/10 ring-1 ring-inset ring-sq-accent/30' : 'hover:bg-sq-col/40'}`}
                            onDragOver={e => { if (!dragTaskId) return; e.preventDefault(); e.stopPropagation(); setDragOverStoryId(story.id) }}
                            onDragLeave={() => setDragOverStoryId(null)}
                            onDrop={e => { e.stopPropagation(); handleDropOnStory(story.id) }}
                          >
                            <div
                              className="flex items-center justify-center cursor-pointer"
                              onClick={() => allChildren.length > 0 ? toggleStory(story.id) : setSelectedTaskId(story.id)}
                            >
                              {allChildren.length > 0
                                ? <IconChevronRight size={14} className="text-white/40 transition-transform"
                                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                                : <img src="/icons/story.svg" width={14} height={14} alt="" />
                              }
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              {allChildren.length > 0 && <img src="/icons/story.svg" width={14} height={14} alt="" className="shrink-0" />}
                              <span
                                className="text-white text-sm font-semibold truncate hover:underline cursor-pointer"
                                onClick={() => setSelectedTaskId(story.id)}
                              >
                                {story.title}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); if (!isOpen) toggleStory(story.id); setModalConfig({ type: 'task', parentId: story.id }) }}
                                className="ml-1 flex items-center gap-0.5 text-sq-muted hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
                              >
                                <IconPlus size={12} /> Add task
                              </button>
                            </div>
                            <StatusBadge status={statusMap[story.status_id]} />
                            <span className="text-white text-xs">{timeElapsed(story.start_date)}</span>
                            <PriorityBadge priority={story.priority} />
                            <span className="text-white text-xs truncate">{story.assignee_user?.full_name ?? '—'}</span>
                            <span className="text-white/50 text-xs text-center">{story.subtasks[0]?.count ?? 0}</span>
                          </div>

                          {isOpen && visibleChildren.map(child => (
                            <div
                              key={child.id}
                              draggable
                              onDragStart={() => { setDragTaskId(child.id); setDragOverStoryId(null) }}
                              onDragEnd={() => { setDragTaskId(null); setDragOverStoryId(null) }}
                              className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2 hover:bg-sq-col/40 transition-colors items-center cursor-grab active:cursor-grabbing bg-sq-col/20"
                            >
                              <span />
                              <div className="flex items-center gap-2 min-w-0 pl-5">
                                <IconClipboard size={13} className="text-sq-task-icon shrink-0" />
                                <span
                                  className="text-white text-xs truncate hover:underline cursor-pointer"
                                  onClick={() => setSelectedTaskId(child.id)}
                                >
                                  {child.title}
                                </span>
                              </div>
                              <StatusBadge status={statusMap[child.status_id]} />
                              <span className="text-white text-xs">{timeElapsed(child.start_date)}</span>
                              <PriorityBadge priority={child.priority} />
                              <span className="text-white text-xs truncate">{child.assignee_user?.full_name ?? '—'}</span>
                              <div className="flex items-center justify-center gap-1 text-white/40 text-xs">
                                <IconSubtask size={11} />
                                <span>{child.subtasks[0]?.count ?? 0}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {filteredOrphans.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => { setDragTaskId(task.id); setDragOverStoryId(null) }}
                        onDragEnd={() => { setDragTaskId(null); setDragOverStoryId(null) }}
                        className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2.5 hover:bg-sq-col/40 transition-colors items-center cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center justify-center">
                          <IconClipboard size={14} className="text-sq-task-icon" />
                        </div>
                        <span
                          className="text-white text-sm truncate hover:underline cursor-pointer"
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          {task.title}
                        </span>
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

      {/* Unassigned — tasks with no board */}
      {(filteredUnassignedStories.length > 0 || filteredUnassignedOrphans.length > 0) && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0 bg-sq-muted" />
            <span className="text-white font-bold text-lg">Unassigned</span>
          </div>
          <div className="flex flex-col rounded-xl overflow-hidden border border-sq-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-sq-col bg-sq-col/50">
              <span className="text-white font-semibold text-sm">No team · No table</span>
              <span className="text-white/40 text-xs ml-1">{filteredUnassignedStories.length + filteredUnassignedOrphans.length} items</span>
            </div>
            <div className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2 bg-sq-col border-b border-sq-col/60">
              <span /><span className="text-white/40 text-xs font-medium">Title</span>
              <span className="text-white/40 text-xs font-medium">Status</span>
              <span className="text-white/40 text-xs font-medium">Active for</span>
              <span className="text-white/40 text-xs font-medium">Priority</span>
              <span className="text-white/40 text-xs font-medium">Assignee</span>
              <span className="text-white/40 text-xs font-medium text-center">Sub</span>
            </div>
            <div className="flex flex-col divide-y divide-sq-col/40 bg-sq-card">
              {filteredUnassignedStories.map(story => {
                const allChildren     = unassignedChildMap[story.id] ?? []
                const visibleChildren = allChildren.filter(matchesFilters)
                const isOpen          = openStories.has(story.id)
                return (
                  <div key={story.id}>
                    <div className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2.5 hover:bg-sq-col/40 transition-colors items-center group">
                      <div className="flex items-center justify-center cursor-pointer" onClick={() => allChildren.length > 0 ? toggleStory(story.id) : setSelectedTaskId(story.id)}>
                        {allChildren.length > 0
                          ? <IconChevronRight size={14} className="text-white/40 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                          : <img src="/icons/story.svg" width={14} height={14} alt="" />}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {allChildren.length > 0 && <img src="/icons/story.svg" width={14} height={14} alt="" className="shrink-0" />}
                        <span className="text-white text-sm font-semibold truncate hover:underline cursor-pointer" onClick={() => setSelectedTaskId(story.id)}>{story.title}</span>
                      </div>
                      <StatusBadge status={statusMap[story.status_id]} />
                      <span className="text-white text-xs">{timeElapsed(story.start_date)}</span>
                      <PriorityBadge priority={story.priority} />
                      <span className="text-white text-xs truncate">{story.assignee_user?.full_name ?? '—'}</span>
                      <span className="text-white/50 text-xs text-center">{story.subtasks[0]?.count ?? 0}</span>
                    </div>
                    {isOpen && visibleChildren.map(child => (
                      <div key={child.id} className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2 hover:bg-sq-col/40 transition-colors items-center bg-sq-col/20">
                        <span />
                        <div className="flex items-center gap-2 min-w-0 pl-5">
                          <IconClipboard size={13} className="text-sq-task-icon shrink-0" />
                          <span className="text-white text-xs truncate hover:underline cursor-pointer" onClick={() => setSelectedTaskId(child.id)}>{child.title}</span>
                        </div>
                        <StatusBadge status={statusMap[child.status_id]} />
                        <span className="text-white text-xs">{timeElapsed(child.start_date)}</span>
                        <PriorityBadge priority={child.priority} />
                        <span className="text-white text-xs truncate">{child.assignee_user?.full_name ?? '—'}</span>
                        <div className="flex items-center justify-center gap-1 text-white/40 text-xs">
                          <IconSubtask size={11} /><span>{child.subtasks[0]?.count ?? 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
              {filteredUnassignedOrphans.map(task => (
                <div key={task.id} className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2.5 hover:bg-sq-col/40 transition-colors items-center">
                  <div className="flex items-center justify-center"><IconClipboard size={14} className="text-sq-task-icon" /></div>
                  <span className="text-white text-sm truncate hover:underline cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>{task.title}</span>
                  <StatusBadge status={statusMap[task.status_id]} />
                  <span className="text-white text-xs">{timeElapsed(task.start_date)}</span>
                  <PriorityBadge priority={task.priority} />
                  <span className="text-white text-xs truncate">{task.assignee_user?.full_name ?? '—'}</span>
                  <div className="flex items-center justify-center gap-1 text-white/40 text-xs">
                    <IconSubtask size={11} /><span>{task.subtasks[0]?.count ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="text-sq-muted text-xs text-center">
          {hiddenCount} team{hiddenCount > 1 ? 's' : ''} hidden — use the Teams button to show them
        </p>
      )}

      {/* Done table */}
      {doneTasks.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={toggleShowDone}
            className="flex items-center gap-2 text-sq-muted hover:text-white transition-colors w-fit"
          >
            <IconChevronRight
              size={14}
              className="transition-transform"
              style={{ transform: showDone ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
            <span className="text-sm font-semibold">Done</span>
            <span className="text-white/30 text-xs">({doneTasks.length})</span>
          </button>

          {showDone && (
            <div className="flex flex-col rounded-xl overflow-hidden border border-sq-col">
              <div className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2 bg-sq-col border-b border-sq-col/60">
                <span /><span className="text-white/40 text-xs font-medium">Title</span>
                <span className="text-white/40 text-xs font-medium">Status</span>
                <span className="text-white/40 text-xs font-medium">Active for</span>
                <span className="text-white/40 text-xs font-medium">Priority</span>
                <span className="text-white/40 text-xs font-medium">Assignee</span>
                <span className="text-white/40 text-xs font-medium text-center">Sub</span>
              </div>
              <div className="flex flex-col divide-y divide-sq-col/40 bg-sq-card">
                {doneTasks.map(task => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[24px_1fr_130px_110px_90px_150px_50px] gap-2 px-4 py-2.5 hover:bg-sq-col/40 transition-colors items-center"
                  >
                    <div className="flex items-center justify-center">
                      {task.type === 'story'
                        ? <img src="/icons/story.svg" width={14} height={14} alt="" className="opacity-50" />
                        : <IconClipboard size={14} className="text-sq-task-icon opacity-50" />}
                    </div>
                    <span
                      className="text-white/50 text-sm truncate line-through hover:text-white/80 cursor-pointer transition-colors"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      {task.title}
                    </span>
                    <StatusBadge status={statusMap[task.status_id]} />
                    <span className="text-white/50 text-xs">{timeElapsed(task.start_date)}</span>
                    <PriorityBadge priority={task.priority} />
                    <span className="text-white/50 text-xs truncate">{task.assignee_user?.full_name ?? '—'}</span>
                    <div className="flex items-center justify-center gap-1 text-white/30 text-xs">
                      <IconSubtask size={11} /><span>{task.subtasks[0]?.count ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowAddTable(false)} />
          <div className="relative bg-sq-card rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
            <h2 className="text-white font-bold text-lg">New Table</h2>
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Name</label>
              <input
                autoFocus
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTable()}
                placeholder="Table name..."
                className="bg-sq-col border border-sq-muted rounded-lg text-white text-sm px-3 py-2 outline-none placeholder:text-sq-muted"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Team</label>
              <select
                value={newTableTeamId}
                onChange={e => setNewTableTeamId(e.target.value)}
                className="bg-sq-col border border-sq-muted rounded-lg text-white text-sm px-3 py-2 outline-none"
              >
                <option value="" disabled>Select team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white text-sm font-medium">Color</label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <div className="w-8 h-8 rounded-lg border border-sq-muted" style={{ backgroundColor: newTableColor }} />
                  <input type="color" value={newTableColor} onChange={e => setNewTableColor(e.target.value)} className="sr-only" />
                </label>
                <span className="text-sq-muted text-xs">{newTableColor}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={createTable}
                disabled={!newTableName.trim() || !newTableTeamId}
                className="flex-1 bg-sq-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => setShowAddTable(false)}
                className="px-4 py-2 rounded-lg text-sm text-sq-muted hover:text-white border border-sq-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
