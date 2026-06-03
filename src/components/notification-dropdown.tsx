'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  IconBell, IconClipboard, IconEye, IconCheck, IconX, IconAt,
} from '@tabler/icons-react'

type Notification = {
  id: string
  type: string
  task_id: string | null
  message: string
  is_read: boolean
  created_at: string
}

const TYPE_CONFIG: Record<string, { color: string; Icon: React.ElementType }> = {
  task_assigned:    { color: '#6272a4', Icon: IconClipboard },
  review_requested: { color: '#F3A63A', Icon: IconEye },
  task_accepted:    { color: '#50fa7b', Icon: IconCheck },
  task_rejected:    { color: '#B84040', Icon: IconX },
  mentioned:        { color: '#bd93f9', Icon: IconAt },
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

type Props = {
  userId: string
  onTaskClick: (taskId: string) => void
}

export default function NotificationDropdown({ userId, onTaskClick }: Props) {
  const [open, setOpen]                   = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const ref    = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, task_id, message, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifications(data)
  }

  useEffect(() => {
    if (!userId) return
    fetchNotifications()

    const channel = supabase
      .channel('notifications-' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markRead(n.id)
    if (n.task_id) {
      setOpen(false)
      onTaskClick(n.task_id)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (!open) fetchNotifications(); setOpen(prev => !prev) }}
        className="relative text-sq-nav-inactive hover:text-white transition-colors"
      >
        <IconBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-sq-accent rounded-full flex items-center justify-center text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-sq-col border border-sq-muted rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-sq-muted">
            <span className="text-white font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-sq-accent hover:opacity-70 text-xs font-medium transition-opacity"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sq-muted text-sm">No notifications</div>
            ) : (
              notifications.map(n => {
                const cfg  = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.task_assigned
                const Icon = cfg.Icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-sq-card transition-colors border-b border-sq-muted/40 last:border-0 ${!n.is_read ? 'bg-sq-card/40' : ''}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: cfg.color + '25' }}
                    >
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm leading-snug">{n.message}</p>
                      <p className="text-sq-muted text-xs mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-sq-accent shrink-0 mt-2.5" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
