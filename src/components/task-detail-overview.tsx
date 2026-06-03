'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react'
import type { TaskDetail, Attachment, Subtask } from './task-detail-types'

type Props = {
  taskId: string
  task: TaskDetail
  editing: boolean
  editDescription: string
  onDescriptionChange: (val: string) => void
  onRefresh: () => void
  stories: { id: string; title: string }[]
  onUpdateParent: (parentId: string | null) => void
}

export default function TaskDetailOverview({ taskId, task, editing, editDescription, onDescriptionChange, onRefresh, stories, onUpdateParent }: Props) {
  const [attachments, setAttachments]   = useState<Attachment[]>([])
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const [newSubtask, setNewSubtask]     = useState('')
  const [subtaskEdits, setSubtaskEdits] = useState<Record<string, string>>({})

  const supabase = createClient()

  useEffect(() => {
    const edits: Record<string, string> = {}
    task.subtasks.forEach(s => { edits[s.id] = s.title })
    setSubtaskEdits(edits)
  }, [task.subtasks])

  useEffect(() => {
    supabase
      .from('task_attachments')
      .select('id, url, file_name, type')
      .eq('task_id', taskId)
      .then(({ data }) => { if (data) setAttachments(data) })
  }, [taskId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const slots = 5 - attachments.length
    const toUpload = files.slice(0, slots)
    const added: Attachment[] = []
    for (const file of toUpload) {
      const path = `${taskId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('task-images').upload(path, file)
      if (error) continue
      const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(path)
      const { data: att } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        url: publicUrl,
        file_name: file.name,
        type: 'image',
        uploaded_by: user.id,
      }).select('id, url, file_name, type').single()
      if (att) added.push(att as Attachment)
    }
    if (added.length) setAttachments(prev => [...prev, ...added])
    e.target.value = ''
  }

  async function handleDeleteAttachment(id: string, url: string) {
    const path = url.split('/task-images/')[1]
    await supabase.storage.from('task-images').remove([path])
    await supabase.from('task_attachments').delete().eq('id', id)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  async function handleAddSubtask() {
    if (!newSubtask.trim()) return
    await supabase.from('subtasks').insert({
      task_id: taskId,
      title: newSubtask.trim(),
      is_done: false,
      position: task.subtasks.length,
    })
    setNewSubtask('')
    onRefresh()
  }

  async function toggleSubtask(subtask: Subtask) {
    await supabase.from('subtasks').update({ is_done: !subtask.is_done }).eq('id', subtask.id)
    onRefresh()
  }

  async function deleteSubtask(id: string) {
    await supabase.from('subtasks').delete().eq('id', id)
    onRefresh()
  }

  async function saveSubtask(sub: Subtask) {
    const newText = subtaskEdits[sub.id]?.trim()
    if (!newText || newText === sub.title) return
    await supabase.from('subtasks').update({ title: newText }).eq('id', sub.id)
    onRefresh()
  }

  return (
    <>
      {/* Description */}
      {(editing || task.description) && (
        <div className="flex flex-col gap-2">
          <label className="text-white font-semibold text-base">Description</label>
          {editing
            ? <textarea
                value={editDescription}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder="Describe the task..."
                rows={4}
                className="bg-sq-col border border-sq-muted rounded text-white text-sm p-3 outline-none resize-none placeholder:text-sq-muted"
              />
            : <p className="text-white/80 text-base leading-relaxed">{task.description}</p>
          }
        </div>
      )}

      {/* Attachments */}
      {(editing || attachments.length > 0) && (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-white font-semibold text-base">Attachments</label>
          <span className="text-sq-muted text-xs">{attachments.length}/5</span>
        </div>
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
        {editing && attachments.length < 5 && (
          <>
            <input id="file-upload" type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
            <label htmlFor="file-upload" className="flex items-center gap-1.5 text-sq-muted hover:text-white text-xs cursor-pointer transition-colors w-fit">
              <IconPlus size={14} /> Upload image ({5 - attachments.length} remaining)
            </label>
          </>
        )}
        {editing && attachments.length >= 5 && (
          <span className="text-sq-muted text-xs italic">Maximum 5 images reached</span>
        )}
      </div>
      )}

      {/* Story — tasks only */}
      {task.type === 'task' && (editing || !!task.parent?.title) && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-white font-semibold text-base">
            <img src="/icons/story-red.svg" width={16} height={16} alt="" />
            Story
          </label>
          {editing
            ? <select
                value={task.parent_id ?? ''}
                onChange={e => onUpdateParent(e.target.value || null)}
                className="bg-sq-col border border-sq-muted rounded text-white text-sm px-3 py-2 outline-none"
              >
                <option value="">None</option>
                {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            : <span className="text-white text-sm">{task.parent?.title}</span>
          }
        </div>
      )}

      {/* Subtasks — tasks only */}
      {task.type !== 'story' && (editing || task.subtasks.length > 0) && (
        <div className="flex flex-col gap-2">
          <label className="text-white font-semibold text-base">
            Subtasks ({task.subtasks.filter(s => s.is_done).length}/{task.subtasks.length})
          </label>
          {task.subtasks.length === 0 && !editing
            ? <span className="text-sq-muted text-xs italic">No subtasks</span>
            : (
              <div className="flex flex-col gap-1">
                {task.subtasks.sort((a, b) => a.position - b.position).map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 group">
                    <button
                      onClick={() => toggleSubtask(sub)}
                      className="shrink-0"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        sub.is_done ? 'bg-sq-accent border-sq-accent' : 'border-sq-muted group-hover:border-white'
                      }`}>
                        {sub.is_done && <IconCheck size={10} className="text-white" />}
                      </div>
                    </button>
                    {editing ? (
                      <input
                        value={subtaskEdits[sub.id] ?? sub.title}
                        onChange={e => setSubtaskEdits(prev => ({ ...prev, [sub.id]: e.target.value }))}
                        onBlur={() => saveSubtask(sub)}
                        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className={`flex-1 min-w-0 bg-transparent text-base outline-none border-b border-transparent focus:border-sq-muted transition-colors ${sub.is_done ? 'line-through text-sq-muted' : 'text-white'}`}
                      />
                    ) : (
                      <span className={`flex-1 min-w-0 text-base ${sub.is_done ? 'line-through text-sq-muted' : 'text-white'}`}>
                        {sub.title}
                      </span>
                    )}
                    <button
                      onClick={() => deleteSubtask(sub.id)}
                      className="text-sq-muted hover:text-sq-danger transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )
          }
          {editing && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                placeholder="New subtask..."
                className="flex-1 bg-sq-col border border-sq-muted rounded text-white text-sm px-3 py-1.5 outline-none placeholder:text-sq-muted"
              />
              <button onClick={handleAddSubtask} className="flex items-center gap-1 text-sq-muted hover:text-white text-xs transition-colors">
                <IconPlus size={14} /> Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image preview overlay */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewUrl(null)}
        >
          <img src={previewUrl} className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
        </div>
      )}
    </>
  )
}
