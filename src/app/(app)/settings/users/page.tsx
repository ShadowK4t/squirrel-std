'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUsers, inviteUser, updateUserRole, deleteUser, addUserTeam, removeUserTeam } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconTrash, IconMail } from '@tabler/icons-react'
import ProfileModal from '@/components/profile-modal'

type UserEntry = {
  id: string
  email: string
  full_name: string
  role: string
  teams: { id: string; name: string; color: string; is_lead: boolean }[]
  invited_at: string
  last_sign_in_at: string | null
}

const ROLE_COLORS: Record<string, 'destructive' | 'default' | 'secondary'> = {
  admin: 'destructive',
  lead: 'default',
  normal: 'secondary',
}

export default function UsersSettingsPage() {
  const [active, setActive] = useState<UserEntry[]>([])
  const [pending, setPending] = useState<UserEntry[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string; color: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  async function loadUsers() {
    const result = await getUsers()
    if (result && !('error' in result)) {
      setActive(result.active)
      setPending(result.pending)
    }
    setLoading(false)
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('users').select('role').eq('id', user.id).single()
          .then(({ data }) => { if (data) setCurrentUserRole(data.role) })
      }
    })
    supabase.from('teams').select('id, name, color').then(({ data }) => {
      if (data) setTeams(data)
    })
    loadUsers()
  }, [])

  async function handleInvite(formData: FormData) {
    setInviteLoading(true)
    setInviteError(null)
    setInviteSuccess(false)
    const result = await inviteUser(formData)
    if (result?.error) {
      setInviteError(result.error)
    } else {
      setInviteSuccess(true)
      await loadUsers()
    }
    setInviteLoading(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    const result = await updateUserRole(userId, role)
    if (!result?.error) {
      setActive(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    }
  }

  async function handleDelete(userId: string) {
    const result = await deleteUser(userId)
    if (!result?.error) {
      setActive(prev => prev.filter(u => u.id !== userId))
      setPending(prev => prev.filter(u => u.id !== userId))
      setDeleteConfirm(null)
    }
  }

  async function handleAddTeam(userId: string, teamId: string, teamData: { id: string; name: string; color: string }) {
    const result = await addUserTeam(userId, teamId)
    if (!result?.error) {
      setActive(prev => prev.map(u => u.id === userId
        ? { ...u, teams: [...u.teams, { ...teamData, is_lead: false }] }
        : u
      ))
    }
  }

  async function handleRemoveTeam(userId: string, teamId: string) {
    const result = await removeUserTeam(userId, teamId)
    if (!result?.error) {
      setActive(prev => prev.map(u => u.id === userId
        ? { ...u, teams: u.teams.filter(t => t.id !== teamId) }
        : u
      ))
    }
  }

  async function handleResend(email: string, role: string) {
    const fd = new FormData()
    fd.append('email', email)
    fd.append('role', role)
    fd.append('full_name', '')
    await inviteUser(fd)
  }

  if (currentUserRole === null) return null
  if (currentUserRole !== 'admin') return (
    <div className="p-8">
      <p className="text-sm text-white/70">You don't have permission to view this page.</p>
    </div>
  )

  return (
    <>
      <div className="max-w-4xl mx-auto p-8 space-y-10">

        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="text-sm text-white/70">Invite team members and manage roles</p>
        </div>

        {/* Invite form */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-white">Invite user</h2>
          <form action={handleInvite} className="flex gap-3 items-end flex-wrap">
            <div className="space-y-2 flex-1 min-w-36">
              <Label htmlFor="full_name" className="text-white">Full name <span className="text-red-500">*</span></Label>
              <Input id="full_name" name="full_name" type="text" required />
            </div>
            <div className="space-y-2 flex-1 min-w-44">
              <Label htmlFor="email" className="text-white">Email <span className="text-red-500">*</span></Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2 w-32">
              <Label className="text-white">Role</Label>
              <select name="role" defaultValue="normal" className="w-full h-9 rounded-md border border-input bg-zinc-800 px-3 text-sm text-white">
                <option value="normal">Normal</option>
                <option value="lead">Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2 w-36">
              <Label className="text-white">Team (optional)</Label>
              <select name="team_id" className="w-full h-9 rounded-md border border-input bg-zinc-800 px-3 text-sm text-white">
                <option value="">None</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={inviteLoading}>
              {inviteLoading ? 'Sending...' : 'Send invite'}
            </Button>
          </form>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          {inviteSuccess && <p className="text-sm text-green-600">Invite sent!</p>}
        </div>

        {/* Active users */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white">Team members ({active.length})</h2>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white">Name</TableHead>
                  <TableHead className="text-white">Email</TableHead>
                  <TableHead className="text-white">Teams</TableHead>
                  <TableHead className="text-white">Role</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-white/70 py-6">Loading...</TableCell>
                  </TableRow>
                ) : active.map(user => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => setSelectedUserId(user.id)}>
                    <TableCell className="font-medium text-white">{user.full_name}</TableCell>
                    <TableCell className="text-white/70">{user.email}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1 items-center">
                        {user.teams.map((t) => (
                          <span key={t.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: t.color + '33', color: t.color }}>
                            {t.name}{t.is_lead ? ' ·lead' : ''}
                            <button
                              onClick={() => handleRemoveTeam(user.id, t.id)}
                              className="hover:opacity-60 transition-opacity leading-none"
                            >×</button>
                          </span>
                        ))}
                        {teams.filter(t => !user.teams.some(ut => ut.id === t.id)).length > 0 && (
                          <select
                            value=""
                            onChange={e => {
                              const t = teams.find(t => t.id === e.target.value)
                              if (t) handleAddTeam(user.id, t.id, { id: t.id, name: t.name, color: t.color })
                            }}
                            className="h-5 rounded text-xs bg-transparent border border-dashed border-white/30 text-white px-1 cursor-pointer"
                          >
                            <option value="">+ team</option>
                            {teams
                              .filter(t => !user.teams.some(ut => ut.id === t.id))
                              .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                            }
                          </select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        className="h-8 rounded-md border border-input bg-zinc-800 px-2 text-xs text-white"
                      >
                        <option value="normal">Normal</option>
                        <option value="lead">Lead</option>
                        <option value="admin">Admin</option>
                      </select>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {deleteConfirm === user.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/70">Sure?</span>
                          <button onClick={() => handleDelete(user.id)} className="text-xs text-destructive hover:underline">Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-white/70 hover:underline">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(user.id)} className="text-white/50 hover:text-destructive transition-colors">
                          <IconTrash size={15} />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pending invitations */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-white">Pending invitations ({pending.length})</h2>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-white">Email</TableHead>
                    <TableHead className="text-white">Role</TableHead>
                    <TableHead className="text-white">Invited</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="text-white/70">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={ROLE_COLORS[user.role]}>{user.role}</Badge>
                      </TableCell>
                      <TableCell className="text-white/70 text-xs">
                        {new Date(user.invited_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleResend(user.email, user.role)}
                            className="text-white/50 hover:text-white transition-colors" title="Resend invite">
                            <IconMail size={15} />
                          </button>
                          {deleteConfirm === user.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/70">Sure?</span>
                              <button onClick={() => handleDelete(user.id)} className="text-xs text-destructive hover:underline">Yes</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs text-white/70 hover:underline">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(user.id)} className="text-white/50 hover:text-destructive transition-colors">
                              <IconTrash size={15} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

      </div>

      {selectedUserId && (
        <ProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </>
  )
}