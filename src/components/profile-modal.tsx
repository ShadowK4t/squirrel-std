'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconX } from '@tabler/icons-react'

type Profile  = { full_name: string; email: string; description: string | null; role: string }
type Team     = { name: string; color: string }
type JobTitle = { name: string }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  lead: 'Lead',
  normal: 'Member',
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type Props = { onClose: () => void }

export default function ProfileModal({ onClose }: Props) {
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [teams, setTeams]         = useState<Team[]>([])
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
  const [loading, setLoading]     = useState(true)
  const [visible, setVisible]     = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const [profileRes, teamsRes, jobsRes] = await Promise.all([
        supabase.from('users').select('full_name, email, description, role').eq('id', user.id).single(),
        supabase.from('user_teams').select('team:teams(name, color)').eq('user_id', user.id),
        supabase.from('user_job_titles').select('job_title:job_titles(name)').eq('user_id', user.id),
      ])
      if (profileRes.data) setProfile(profileRes.data)
      if (teamsRes.data)   setTeams(teamsRes.data.map((r: any) => r.team))
      if (jobsRes.data)    setJobTitles(jobsRes.data.map((r: any) => r.job_title))
      setLoading(false)
    })
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Side panel */}
      <div
        className="relative w-172.5 h-full bg-sq-col rounded-l-xl flex flex-col overflow-y-auto transition-transform duration-250"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-sq-muted hover:text-white transition-colors z-10"
        >
          <IconX size={22} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-sq-muted text-sm">Loading...</span>
          </div>
        ) : profile && (
          <div className="flex flex-col gap-6 p-7 pt-14">

            {/* Profile card */}
            <div className="bg-zinc-400 rounded-sm p-3 flex items-center gap-5">
              <div className="w-30 h-30 rounded-full bg-sq-bg flex items-center justify-center shrink-0">
                <span className="text-white text-3xl font-bold">{initials(profile.full_name)}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="text-white font-bold text-2xl leading-tight -mt-2">{profile.full_name}</h2>
                {teams.length > 0 && (
                  <div className="flex flex-wrap gap-x-4">
                    {teams.map((t, i) => (
                      <span key={i} className="text-zinc-800 text-[13.5px]">{t.name}</span>
                    ))}
                  </div>
                )}
                <h3 className='text-white font-bold text-[17px] mt-4'>Working on ...</h3>
                {profile.description && (
                  <span className="text-white text-sm mt-1 line-clamp-2">{profile.description}</span>
                )}
                
              </div>
            </div>

            {/* Personal Information */}
            <div className="flex flex-col gap-4">
              <h3 className="text-white font-bold text-lg">Personal Information</h3>

              <div className="flex flex-col gap-7">

                <div className="flex flex-col gap-1">
                  <span className="text-white text-sm font-semibold">Preferred Name</span>
                  <div className="flex items-center h-11 px-4 rounded-full border border-sq-muted">
                    <span className="text-sq-muted text-sm">{profile.full_name}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-white text-sm font-semibold">Email</span>
                  <div className="flex items-center h-11 px-4 rounded-full border border-sq-muted">
                    <span className="text-sq-muted text-sm">{profile.email}</span>
                  </div>
                </div>

                {jobTitles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Job Titles</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {jobTitles.map((j, i) => (
                        <span key={i} className="bg-sq-bg text-white text-xs px-3 py-1.5 rounded-full">{j.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className="text-white text-sm font-semibold">User Type</span>
                  <span className="text-white/70 text-sm">{ROLE_LABELS[profile.role] ?? profile.role}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-white text-sm font-semibold">Tier</span>
                  <span className="text-white/70 text-sm">{ROLE_LABELS[profile.role] ?? profile.role}</span>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
