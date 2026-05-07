'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconLink, IconPlus, IconX } from '@tabler/icons-react'
import type { TaskDetail, LinkedTask } from './task-detail-types'

type Props = {
  taskId: string
  task: TaskDetail
  editing: boolean
  onRefresh: () => void
}

export default function TaskDetailRelations({ taskId, task, editing, onRefresh }: Props) {
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([])
  const [allTasks, setAllTasks]       = useState<{ id: string; title: string }[]>([])

  const supabase = createClient()

  useEffect(() => {
    supabase.from('tasks').select('id, title').neq('id', taskId).order('title')
      .then(({ data }) => { if (data) setAllTasks(data) })
  }, [taskId])

  useEffect(() => {
    if (task.related_task_ids?.length > 0) {
      supabase
        .from('tasks')
        .select('id, title, status:statuses!status_id(label, color)')
        .in('id', task.related_task_ids)
        .then(({ data }) => { if (data) setLinkedTasks(data as unknown as LinkedTask[]) })
    } else {
      setLinkedTasks([])
    }
  }, [task.related_task_ids])

  async function addLinkedTask(linkedId: string) {
    if (!linkedId || task.related_task_ids.includes(linkedId)) return
    const updated = [...task.related_task_ids, linkedId]
    await supabase.from('tasks').update({ related_task_ids: updated }).eq('id', taskId)
    onRefresh()
  }

  async function removeLinkedTask(linkedId: string) {
    const updated = task.related_task_ids.filter(id => id !== linkedId)
    await supabase.from('tasks').update({ related_task_ids: updated }).eq('id', taskId)
    onRefresh()
  }

  return (
    <>
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
                .filter(t => !task.related_task_ids.includes(t.id))
                .map(t => <option key={t.id} value={t.id}>{t.title}</option>)
              }
            </select>
            <IconPlus size={16} className="text-sq-muted shrink-0" />
          </div>
        )}
      </div>

      {/* Boards */}
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
    </>
  )
}
