'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { IconTimeline, IconList, IconCalendar, IconBooks, IconSettings } from '@tabler/icons-react'
import ProfileModal from '@/components/profile-modal'
import NotificationDropdown from '@/components/notification-dropdown'

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Navbar() {
  const pathname = usePathname()

  const navItems: { label: string; href: string; icon?: React.ElementType; imgSrc?: string }[] = [
    { label: 'Board',    href: '/board',    imgSrc: '/icons/board.svg' },
    { label: 'Timeline', href: '/timeline', icon: IconTimeline },
    { label: 'Backlog',  href: '/backlog',  icon: IconList },
    { label: 'Calendar', href: '/calendar', icon: IconCalendar },
    { label: 'Library',  href: '/library',  icon: IconBooks },
  ]

  const [username, setUsername]         = useState('')
  const [role, setRole]                 = useState('')
  const [userId, setUserId]             = useState('')
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [showProfile, setShowProfile]   = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase.from('users').select('full_name, role, avatar_url').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUsername(data.full_name)
            setRole(data.role)
            setAvatarUrl(data.avatar_url ?? null)
          }
        })
    })
  }, [])

  return (
    <>
      <header className="w-full bg-sq-bg px-8 py-4 flex items-center justify-between">

        <div className="flex items-center gap-1.5">
          <img src="/icons/squirrel.svg" alt="Squirrel Space" className="w-16 h-16" />
          <span className="font-sans font-black text-white text-2xl">Squirrel Space</span>
        </div>

        <div className="flex items-center gap-3">
          {navItems.map(navItem => {
            const Icon = navItem.icon
            const isActive = pathname === navItem.href
            return (
              <Link
                key={navItem.href}
                href={navItem.href}
                className={`flex items-center gap-2 px-4 py-1 rounded text-sm font-bold ${
                  isActive ? 'bg-sq-accent text-white' : 'text-sq-nav-inactive'
                }`}
              >
                {navItem.imgSrc
                  ? <img src={navItem.imgSrc} width={18} height={18} alt="" className={isActive ? '' : 'opacity-50'} />
                  : Icon && <Icon size={18} />
                }
                {navItem.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          {userId && (
            <NotificationDropdown
              userId={userId}
              onTaskClick={(taskId) => {
                if (window.location.pathname === '/board') {
                  window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId } }))
                } else {
                  router.push(`/board?task=${taskId}`)
                }
              }}
            />
          )}
          {role === 'admin' && (
            <Link
              href="/settings/users"
              className={`text-sq-nav-inactive hover:text-white transition-colors ${pathname === '/settings/users' ? 'text-white' : ''}`}
              title="Admin"
            >
              <IconSettings size={20} />
            </Link>
          )}
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-white font-sans text-sm font-normal">{username}</span>
            <div className="w-7 h-7 rounded-full bg-sq-accent flex items-center justify-center overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <span className="text-white text-xs font-bold">{initials(username)}</span>
              }
            </div>
          </button>
        </div>

      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}