'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconLayoutKanban, IconTimeline, IconList, IconCalendar, IconBooks, IconBell, IconSettings } from '@tabler/icons-react'
import ProfileModal from '@/components/profile-modal'

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { label: 'Board',    href: '/board',    icon: IconLayoutKanban },
    { label: 'Timeline', href: '/timeline', icon: IconTimeline },
    { label: 'Backlog',  href: '/backlog',  icon: IconList },
    { label: 'Calendar', href: '/calendar', icon: IconCalendar },
    { label: 'Library',  href: '/library',  icon: IconBooks },
  ]

  const [username, setUsername]         = useState('')
  const [role, setRole]                 = useState('')
  const [showProfile, setShowProfile]   = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('full_name, role').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUsername(data.full_name)
            setRole(data.role)
          }
        })
    })
  }, [])

  return (
    <>
      <header className="w-full bg-sq-bg px-8 py-4 flex items-center justify-between">

        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Squirrel Space" className="w-10 h-10" />
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
                <Icon size={18} />
                {navItem.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <button className="text-sq-nav-inactive hover:text-white transition-colors">
            <IconBell size={20} />
          </button>
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
            <div className="w-7 h-7 rounded-full bg-sq-accent flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials(username)}</span>
            </div>
          </button>
        </div>

      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}