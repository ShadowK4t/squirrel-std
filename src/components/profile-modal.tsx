'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconX, IconEdit, IconBrandDiscord, IconCamera } from '@tabler/icons-react'

type Profile = {
  full_name: string
  email: string
  description: string | null
  role: string
  discord: string | null
  avatar_url: string | null
  banner_color: string | null
}
type Team     = { name: string; color: string }
type JobTitle = { name: string }
type Task     = { id: string; title: string; status: { label: string; color: string } | null; priority: number }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  lead: 'Lead',
  normal: 'Member',
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

type Props = { onClose: () => void; userId?: string }

export default function ProfileModal({ onClose, userId }: Props) {
  const [profile, setProfile]                   = useState<Profile | null>(null)
  const [teams, setTeams]                       = useState<Team[]>([])
  const [jobTitles, setJobTitles]               = useState<JobTitle[]>([])
  const [tasks, setTasks]                       = useState<Task[]>([])
  const [loading, setLoading]                   = useState(true)
  const [visible, setVisible]                   = useState(false)
  const [editMode, setEditMode]                 = useState(false)
  const [editName, setEditName]                 = useState('')
  const [editEmail, setEditEmail]               = useState('')
  const [editAvailability, setEditAvailability] = useState('')
  const [editDiscord, setEditDiscord]           = useState('')
  const [editBannerColor, setEditBannerColor]   = useState('#6272a4')
  const [uploadingAvatar, setUploadingAvatar]   = useState(false)

  const isOwnProfile = !userId

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const supabase = createClient()

    async function load(targetId: string) {
      const [profileRes, teamsRes, jobsRes] = await Promise.all([
        supabase.from('users').select('full_name, email, description, role, discord, avatar_url, banner_color').eq('id', targetId).single(),
        supabase.from('user_teams').select('team:teams(name, color)').eq('user_id', targetId),
        supabase.from('user_job_titles').select('job_title:job_titles(name)').eq('user_id', targetId),
      ])
      if (profileRes.data) {
        setProfile(profileRes.data)
        setEditName(profileRes.data.full_name)
        setEditEmail(profileRes.data.email)
        setEditAvailability(profileRes.data.description ?? '')
        setEditDiscord(profileRes.data.discord ?? '')
        setEditBannerColor(profileRes.data.banner_color ?? '#6272a4')
      }
      if (teamsRes.data) setTeams(teamsRes.data.map((r: any) => r.team))
      if (jobsRes.data) setJobTitles(jobsRes.data.map((r: any) => r.job_title))
      if (!isOwnProfile) {
        const { data: taskData } = await supabase.from('tasks')
          .select('id, title, status:statuses(label, color), priority')
          .eq('assignee', targetId).eq('type', 'task').eq('is_future', false)
          .order('created_at', { ascending: false }).limit(20)
        if (taskData) setTasks(taskData.map((r: any) => ({ ...r, status: r.status })))
      }
      setLoading(false)
    }

    if (userId) {
      load(userId)
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) load(user.id)
      })
    }
  }, [userId])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  function handleCancel() {
    if (profile) {
      setEditName(profile.full_name)
      setEditEmail(profile.email)
      setEditAvailability(profile.description ?? '')
      setEditDiscord(profile.discord ?? '')
      setEditBannerColor(profile.banner_color ?? '#6272a4')
    }
    setEditMode(false)
  }

  async function handleSave() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('users').update({
      full_name: editName,
      email: editEmail,
      description: editAvailability || null,
      discord: editDiscord || null,
      banner_color: editBannerColor,
    }).eq('id', user.id)
    setProfile(p => p ? {
      ...p,
      full_name: editName,
      email: editEmail,
      description: editAvailability || null,
      discord: editDiscord || null,
      banner_color: editBannerColor,
    } : p)
    setEditMode(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingAvatar(false); return }
    const path = `${user.id}/avatar`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`
    await supabase.from('users').update({ avatar_url: urlWithBust }).eq('id', user.id)
    setProfile(p => p ? { ...p, avatar_url: urlWithBust } : p)
    setUploadingAvatar(false)
  }

  const bannerColor = editMode ? editBannerColor : (profile?.banner_color ?? '#6272a4')

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      <div
        className="relative w-172.5 h-full bg-sq-col rounded-l-xl flex flex-col overflow-y-auto transition-transform duration-250"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <button onClick={handleClose} className="absolute top-4 right-4 text-sq-muted hover:text-white transition-colors z-10">
          <IconX size={22} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="text-sq-muted text-sm">Loading...</span>
          </div>
        ) : profile && (
          <div className="flex flex-col gap-6 p-7 pt-14">

            {/* Profile card — same layout as before, banner color replaces bg-zinc-400 */}
            <div className="rounded-sm p-3 flex items-center gap-5" style={{ backgroundColor: bannerColor }}>

              {/* Avatar — shows photo if available, else initials; upload in edit mode */}
              <div className="relative w-30 h-30 rounded-full bg-sq-bg flex items-center justify-center shrink-0 overflow-hidden">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white text-3xl font-bold">{initials(profile.full_name)}</span>
                }
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">Uploading…</span>
                  </div>
                )}
                {isOwnProfile && editMode && !uploadingAvatar && (
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity rounded-full">
                    <IconCamera size={22} className="text-white" />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="sr-only" />
                  </label>
                )}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <h2 className="text-white font-bold text-2xl leading-tight -mt-2">{profile.full_name}</h2>
                {teams.length > 0 && (
                  <div className="flex flex-wrap gap-x-4">
                    {teams.map((t, i) => (
                      <span key={i} className="text-zinc-800 text-[13.5px]">{t.name}</span>
                    ))}
                  </div>
                )}
                {profile.description && (
                  <p className="text-white/80 text-sm mt-2">{profile.description}</p>
                )}
              </div>

              {/* Banner color picker — edit mode only */}
              {isOwnProfile && editMode && (
                <label className="shrink-0 cursor-pointer self-start mt-1" title="Change banner color">
                  <div className="w-6 h-6 rounded border-2 border-white/40 hover:border-white transition-colors" style={{ backgroundColor: editBannerColor }} />
                  <input type="color" value={editBannerColor} onChange={e => setEditBannerColor(e.target.value)} className="sr-only" />
                </label>
              )}
            </div>

            {/* Edit toggle — own profile only */}
            {isOwnProfile && !editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="self-end flex items-center gap-1.5 text-sq-muted hover:text-white text-sm transition-colors"
              >
                <IconEdit size={15} />
                Edit profile
              </button>
            )}

            {/* Personal information */}
            <div className="flex flex-col gap-5">
              <h3 className="text-white font-bold text-lg">Personal Information</h3>

              {editMode ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Preferred Name <span className="text-red-500">*</span></span>
                    <div className="flex items-center h-11 px-4 rounded-full border border-sq-muted">
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="bg-transparent outline-none text-white text-sm w-full" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Email <span className="text-red-500">*</span></span>
                    <div className="flex items-center h-11 px-4 rounded-full border border-sq-muted">
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                        className="bg-transparent outline-none text-white text-sm w-full" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Availability</span>
                    <textarea
                      value={editAvailability}
                      onChange={e => setEditAvailability(e.target.value)}
                      placeholder="e.g. Available Mon–Wed, busy Thu–Fri"
                      rows={3}
                      className="bg-transparent outline-none text-white text-sm w-full px-4 py-3 rounded-2xl border border-sq-muted resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Discord</span>
                    <div className="flex items-center h-11 px-4 rounded-full border border-sq-muted">
                      <input value={editDiscord} onChange={e => setEditDiscord(e.target.value)}
                        placeholder="Username or discord.gg link"
                        className="bg-transparent outline-none text-white text-sm w-full" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end mt-1">
                    <button onClick={handleCancel} className="px-4 py-1.5 text-sq-muted hover:text-white text-sm transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-1.5 bg-sq-accent text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Name</span>
                    <span className="text-white/70 text-sm">{profile.full_name}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Email</span>
                    <span className="text-white/70 text-sm">{profile.email}</span>
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

                  <div className="flex flex-col gap-1">
                    <span className="text-white text-sm font-semibold">Role</span>
                    <span className="text-white/70 text-sm">{ROLE_LABELS[profile.role] ?? profile.role}</span>
                  </div>

                  {profile.discord && (
                    <div className="flex flex-col gap-2">
                      <span className="text-white text-sm font-semibold">Discord</span>
                      {profile.discord.startsWith('http') ? (
                        <a
                          href={profile.discord}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 w-fit px-4 py-2 bg-[#5865F2] text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
                        >
                          <IconBrandDiscord size={16} />
                          Message on Discord
                        </a>
                      ) : (
                        <div className="flex items-center gap-2">
                          <IconBrandDiscord size={16} className="text-[#5865F2]" />
                          <span className="text-white/70 text-sm">{profile.discord}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assigned tasks — other user only */}
            {!isOwnProfile && (
              <div className="flex flex-col gap-4">
                <h3 className="text-white font-bold text-lg">Assigned tasks ({tasks.length})</h3>
                {tasks.length === 0 ? (
                  <span className="text-sq-muted text-sm">No active tasks.</span>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 bg-sq-bg rounded-lg px-3 py-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.status?.color ?? '#6272a4' }} />
                        <span className="text-white text-sm truncate flex-1">{task.title}</span>
                        <span className="text-sq-muted text-xs shrink-0">{task.status?.label ?? ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
