export type Status     = { id: string; label: string; color: string }
export type User       = { id: string; full_name: string }
export type Team       = { id: string; name: string; color: string }
export type Subtask    = { id: string; title: string; is_done: boolean; position: number }
export type LinkedTask = { id: string; title: string; status: { label: string; color: string } }
export type Comment    = { id: string; user_id: string; parent_id: string | null; content: string; created_at: string; user: { full_name: string; avatar_url?: string | null } }
export type Attachment = { id: string; url: string; file_name: string; type: string }

export type TaskDetail = {
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
  task_boards: { board_id: string; board: { name: string; color: string } }[]
  task_teams: { is_responsible: boolean; team: { id: string; name: string; color: string } }[]
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'None', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}

export const PRIORITY_COLORS: Record<number, string> = {
  0: '#6B6B6B', 1: '#50fa7b', 2: '#F3A63A', 3: '#ffb86c', 4: '#B84040',
}
