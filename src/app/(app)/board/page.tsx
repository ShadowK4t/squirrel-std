'use client'

import { IconSearch, IconAdjustmentsHorizontal, IconClock, IconPlus, IconX } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TaskModal from '@/components/task-modal'
import TaskDetailModal from '@/components/task-detail-modal'
import TaskCard from '@/components/task-card'

type Status = {
  id: string
  label: string
  color: string
  position: number
}

type User = {
  id: string
  full_name: string
}

type Task = {
  id: string
  type: 'story' | 'task'
  title: string
  description: string | null
  version: number
  priority: number
  status_id: string
  needs_acceptance: boolean
  start_date: string | null
  assignee: string | null
  parent_id: string | null
  assignee_user: { full_name: string } | null
  reviewer_user: { full_name: string } | null
  subtasks: { count: number }[]
  comments: { count: number }[]
  task_boards: { board: { name: string; color: string } }[]
  task_teams: { team: { name: string; color: string } }[]
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}

const PERSONAL_COLUMNS_KEY = 'board_personal_columns'
type PersonalColumn = { id: string; name: string; color: string; taskIds: string[] }


function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const TASK_SELECT = `
  id, type, title, description, version, priority, status_id, needs_acceptance, start_date, assignee, parent_id,
  assignee_user:users!assignee(full_name),
  reviewer_user:users!reviewer_id(full_name),
  subtasks(count),
  comments(count),
  task_boards(board:boards(name, color)),
  task_teams(team:teams(name, color))
`

export default function BoardPage() {
  const [statuses, setStatuses]             = useState<Status[]>([])
  const [tasks, setTasks]                   = useState<Task[]>([])
  const [users, setUsers]                   = useState<User[]>([])
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [showModal, setShowModal]           = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)

  const [search, setSearch]                       = useState('')
  const [showFilter, setShowFilter]               = useState(false)
  const [filterPriorities, setFilterPriorities]   = useState<Set<number>>(new Set())
  const [filterBoards, setFilterBoards]           = useState<Set<string>>(new Set())
  const [filterUsers, setFilterUsers]             = useState<Set<string>>(new Set())
  const [showFuture, setShowFuture]               = useState(false)
  const [showCreateMenu, setShowCreateMenu]       = useState(false)
  const [dragOverColumnId, setDragOverColumnId]   = useState<string | null>(null)
  const [personalColumns, setPersonalColumns]     = useState<PersonalColumn[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(PERSONAL_COLUMNS_KEY)
      const parsed: any[] = stored ? JSON.parse(stored) : []
      return parsed.map(c => ({ ...c, color: c.color ?? '#6272a4' }))
    } catch { return [] }
  })
  const filterRef = useRef<HTMLDivElement>(null)

  async function fetchTasks() {
    const supabase = createClient()
    const { data } = await supabase.from('tasks').select(TASK_SELECT)
    if (data) setTasks(data as unknown as Task[])
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('statuses').select('*').order('position')
      .then(({ data }) => { if (data) setStatuses(data) })
    supabase.from('users').select('id, full_name').order('full_name')
      .then(({ data }) => { if (data) setUsers(data) })
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id)
        setFilterUsers(new Set([user.id]))
      }
    })
    fetchTasks()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleDrop(e: React.DragEvent, statusId: string) {
    e.preventDefault()
    setDragOverStatus(null)
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return
    const supabase = createClient()
    await supabase.from('tasks').update({ status_id: statusId }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status_id: statusId } : t))
  }

  function saveColumns(cols: PersonalColumn[]) {
    localStorage.setItem(PERSONAL_COLUMNS_KEY, JSON.stringify(cols))
    setPersonalColumns(cols)
  }

  function addPersonalColumn() {
    saveColumns([...personalColumns, { id: crypto.randomUUID(), name: 'New Column', color: '#6272a4', taskIds: [] }])
  }

  function removePersonalColumn(colId: string) {
    saveColumns(personalColumns.filter(c => c.id !== colId))
  }

  function renameColumn(colId: string, name: string) {
    saveColumns(personalColumns.map(c => c.id === colId ? { ...c, name } : c))
  }

  function setColumnColor(colId: string, color: string) {
    saveColumns(personalColumns.map(c => c.id === colId ? { ...c, color } : c))
  }

  function handleDropOnColumn(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDragOverColumnId(null)
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return
    saveColumns(personalColumns.map(c => ({
      ...c,
      taskIds: c.id === colId
        ? c.taskIds.includes(taskId) ? c.taskIds : [...c.taskIds, taskId]
        : c.taskIds.filter(id => id !== taskId),
    })))
  }

  function togglePriority(p: number) {
    setFilterPriorities(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n })
  }

  function toggleBoard(name: string) {
    setFilterBoards(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  function toggleUserFilter(userId: string) {
    setFilterUsers(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  function clearFilters() {
    setFilterPriorities(new Set())
    setFilterBoards(new Set())
    setSearch('')
    if (currentUserId) setFilterUsers(new Set([currentUserId]))
  }

  const allBoards = Array.from(new Set(tasks.flatMap(t => t.task_boards.map(tb => tb.board.name))))

  const today = new Date(); today.setHours(0, 0, 0, 0)

  const filteredTasks = tasks.filter(task => {
    if (task.type === 'story') return false
    if (!showFuture && task.start_date && new Date(task.start_date) > today) return false
    if (filterUsers.size > 0 && (!task.assignee || !filterUsers.has(task.assignee))) return false
    if (search && !task.title.toLowerCase().includes(search.toLowerCase()) &&
        !task.description?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPriorities.size > 0 && !filterPriorities.has(task.priority)) return false
    if (filterBoards.size > 0 && !task.task_boards.some(tb => filterBoards.has(tb.board.name))) return false
    return true
  })

  const storyTitleMap = Object.fromEntries(tasks.filter(t => t.type === 'story').map(t => [t.id, t.title]))
  const hasActiveFilters = filterPriorities.size > 0 || filterBoards.size > 0
  const requestStatus    = statuses.find(s => s.label === 'Request')
  const visibleStatuses  = statuses.filter(s => s.label !== 'Request' && s.label !== 'Done')

  return (
    <div className="flex flex-col h-full">
      {/* TOOLBAR */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-sq-nav-inactive w-72">
          <IconSearch size={18} className="text-sq-nav-inactive" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white placeholder:text-sq-nav-inactive text-sm outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-sq-muted hover:text-white transition-colors">
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center">
          {users.map((u, i) => {
            const active = filterUsers.has(u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggleUserFilter(u.id)}
                title={u.full_name}
                className={`w-8 h-8 rounded-full border-2 border-sq-bg -ml-2 first:ml-0 flex items-center justify-center transition-all hover:scale-110 ${
                  active ? 'bg-sq-accent' : 'bg-sq-nav-inactive opacity-50 hover:opacity-100'
                }`}
                style={{ zIndex: users.length - i }}
              >
                <span className="text-white text-xs font-bold leading-none">{initials(u.full_name)}</span>
              </button>
            )
          })}
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(prev => !prev)}
            className={`flex items-center gap-2 transition-colors ${hasActiveFilters ? 'text-sq-accent' : 'text-sq-nav-inactive hover:text-white'}`}
          >
            <IconAdjustmentsHorizontal size={18} />
            <span className="text-sm">Filter</span>
            {hasActiveFilters && (
              <span className="bg-sq-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {filterPriorities.size + filterBoards.size}
              </span>
            )}
          </button>

          {showFilter && (
            <div className="absolute top-10 left-0 z-40 bg-sq-col border border-sq-muted rounded-xl p-4 w-64 flex flex-col gap-4 shadow-xl">
              <div className="flex flex-col gap-2">
                <span className="text-white text-sm font-semibold">Priority</span>
                <div className="flex flex-col gap-1">
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
              </div>
              {allBoards.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-white text-sm font-semibold">Board</span>
                  <div className="flex flex-col gap-1">
                    {allBoards.map(name => {
                      const active = filterBoards.has(name)
                      return (
                        <button key={name} onClick={() => toggleBoard(name)}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-sm text-left transition-colors ${active ? 'bg-sq-accent text-white' : 'text-sq-nav-inactive hover:text-white'}`}>
                          {name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-sq-muted hover:text-white text-xs transition-colors text-left">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowFuture(prev => !prev)}
          className={`flex items-center gap-2 text-sm transition-colors ${showFuture ? 'text-sq-accent' : 'text-sq-nav-inactive hover:text-white'}`}
        >
          <IconClock size={16} />
          Future
        </button>

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
                <button onClick={() => { setShowModal(true); setShowCreateMenu(false) }} className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-sq-card transition-colors">
                  Add Task
                </button>
                <button onClick={() => { addPersonalColumn(); setShowCreateMenu(false) }} className="w-full text-left px-4 py-2.5 text-white text-sm hover:bg-sq-card transition-colors">
                  Add Column
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KANBAN COLUMNS — fixed width */}
      <div className="flex gap-4 items-start flex-1 overflow-x-auto pb-4">
        {visibleStatuses.map(status => {
          const columnTasks = status.label === 'To Do'
            ? filteredTasks.filter(t => t.status_id === status.id || t.status_id === requestStatus?.id)
            : filteredTasks.filter(t => t.status_id === status.id)

          const isOver = dragOverStatus === status.id

          return (
            <div
              key={status.id}
              onDragOver={e => { if (!e.dataTransfer.types.includes('application/sq-task')) return; e.preventDefault(); setDragOverStatus(status.id) }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={e => handleDrop(e, status.id)}
              className={`w-87 shrink-0 bg-sq-col rounded-xl p-4 flex flex-col gap-3 transition-all ${isOver ? 'ring-2 ring-sq-accent' : ''}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-white font-semibold text-base">{status.label}</span>
                </div>
                <div className="flex items-center gap-1 bg-sq-card px-3 py-0.5 rounded-full">
                  <span className="text-sq-nav-inactive text-xs font-medium">Task {columnTasks.length}</span>
                </div>
              </div>

              {/* Task cards */}
              {columnTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  storyTitleMap={storyTitleMap}
                  requestStatusId={requestStatus?.id}
                  onOpen={() => setSelectedTaskId(task.id)}
                />
              ))}

            </div>
          )
        })}

        {/* Personal columns */}
        {personalColumns.map(col => {
          const colTasks = col.taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[]
          const isOver   = dragOverColumnId === col.id
          return (
            <div
              key={col.id}
              onDragOver={e => { if (!e.dataTransfer.types.includes('application/sq-task')) return; e.preventDefault(); setDragOverColumnId(col.id) }}
              onDragLeave={() => setDragOverColumnId(null)}
              onDrop={e => handleDropOnColumn(e, col.id)}
              className={`w-87 shrink-0 bg-sq-col rounded-xl p-4 flex flex-col gap-3 transition-all ${isOver ? 'ring-2 ring-sq-accent' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <label className="shrink-0 cursor-pointer" title="Pick column color">
                    <div className="w-4 h-4 rounded-full transition-opacity hover:opacity-70" style={{ backgroundColor: col.color }} />
                    <input
                      type="color"
                      value={col.color}
                      onChange={e => setColumnColor(col.id, e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  <input
                    value={col.name}
                    onChange={e => renameColumn(col.id, e.target.value)}
                    className="bg-transparent text-white font-semibold text-base outline-none flex-1 min-w-0"
                  />
                </div>
                <button onClick={() => removePersonalColumn(col.id)} className="text-sq-muted hover:text-sq-danger transition-colors ml-2">
                  <IconX size={14} />
                </button>
              </div>

              {colTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  storyTitleMap={storyTitleMap}
                  requestStatusId={requestStatus?.id}
                  onOpen={() => setSelectedTaskId(task.id)}
                  onRemove={() => saveColumns(personalColumns.map(c => c.id === col.id ? { ...c, taskIds: c.taskIds.filter(id => id !== task.id) } : c))}
                />
              ))}

              {colTasks.length === 0 && (
                <span className="text-sq-muted text-xs italic text-center mt-2">Drop tasks here</span>
              )}
            </div>
          )
        })}
      </div>

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={fetchTasks}
        />
      )}

      {showModal && (
        <TaskModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchTasks() }}
        />
      )}
    </div>
  )
}