'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { inviteUser, updateUserRole } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type User = {
  id: string
  full_name: string
  email: string
  role: string
}

export default function UsersSettingsPage() {
    const [users, setUsers] = useState<User[]>([])
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('users').select('id, full_name, email, role').then(({ data }) => {
      if (data) setUsers(data)
    })
  }, [])

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

   useEffect(() => {
   const supabase = createClient()
   supabase.auth.getUser().then(({ data: { user } }) => {
       if (user) {
       supabase.from('users').select('role').eq('id', user.id).single().then(({ data }) => {
           if (data) setCurrentUserRole(data.role)
       })
       }
   })
   }, [])


  async function handleInvite(formData: FormData) {
    setLoading(true)
    setInviteError(null)
    setInviteSuccess(false)
    const result = await inviteUser(formData)
    if (result?.error) {
      setInviteError(result.error)
    } else {
      setInviteSuccess(true)
    }
    setLoading(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    const result = await updateUserRole(userId, role)
    if (!result?.error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    }
  }

  const roleColors: Record<string, string> = {
    admin: 'destructive',
    lead: 'default',
    normal: 'secondary',
  }

    if (currentUserRole === null) return null
    if (currentUserRole !== 'admin') return (
    <div className="p-8">
        <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
    </div>
    )


  return (
    <div className="max-w-3xl mx-auto p-8 space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Invite team members and manage roles</p>
      </div>

      {/* Invite form */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium">Invite user</h2>
        <form action={handleInvite} className="flex gap-3 items-end">
          <div className="space-y-2 flex-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2 w-36">
            <Label htmlFor="role">Role</Label>
            <select name="role" defaultValue="normal" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="normal">Normal</option>
              <option value="lead">Lead</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send invite'}
          </Button>
        </form>
        {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
        {inviteSuccess && <p className="text-sm text-green-600">Invite sent!</p>}
      </div>

      {/* Users list */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Team members</h2>
        <div className="border rounded-md divide-y">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{user.full_name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={roleColors[user.role] as any}>{user.role}</Badge>
                <select
                  value={user.role}
                  onChange={e => handleRoleChange(user.id, e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="normal">Normal</option>
                  <option value="lead">Lead</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}