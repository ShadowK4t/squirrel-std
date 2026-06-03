import { createClient } from '@/lib/supabase/client'

type NotificationType =
  | 'task_assigned'
  | 'review_requested'
  | 'task_accepted'
  | 'task_rejected'
  | 'mentioned'
  | 'meeting_assignment'

export async function createNotification(params: {
  userId: string
  type: NotificationType
  taskId?: string
  message: string
}) {
  const supabase = createClient()
  await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    task_id: params.taskId ?? null,
    message: params.message,
  })
}
