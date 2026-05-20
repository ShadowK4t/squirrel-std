'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')
  return user
}

export async function inviteUser(formData: FormData) {
  try {
    await requireAdmin()

    const email = formData.get('email') as string
    const role = formData.get('role') as string
    const full_name = formData.get('full_name') as string
    const team_id = formData.get('team_id') as string

    const admin = adminClient()
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role, full_name }
    })

    if (error) return { error: error.message }

    const supabase = await createClient()
    await supabase.from('users').upsert({ id: data.user.id, email, full_name, role }, { onConflict: 'id' })
    if (team_id) {
      await supabase.from('user_teams').upsert({ user_id: data.user.id, team_id }, { onConflict: 'user_id,team_id' })
    }

    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function updateUserRole(userId: string, role: string) {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)

    if (error) return { error: error.message }
    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function getUsers() {
  try {
    await requireAdmin()

    const admin = adminClient()
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 200 })
    if (authError) return { error: authError.message }

    const supabase = await createClient()
    const { data: profiles } = await supabase
      .from('users')
      .select('id, full_name, email, role, user_teams(is_lead, team:teams(name, color))')

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const active: any[] = []
    const pending: any[] = []

    for (const authUser of authData.users) {
      const profile: any = profileMap.get(authUser.id)
      const user = {
        id: authUser.id,
        email: authUser.email ?? '',
        full_name: profile?.full_name ?? authUser.email ?? '',
        role: profile?.role ?? 'normal',
        teams: (profile?.user_teams ?? []).map((ut: any) => ({
          name: ut.team?.name ?? '',
          color: ut.team?.color ?? '#6272a4',
          is_lead: ut.is_lead,
        })),
        invited_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
      }
      if (authUser.email_confirmed_at) {
        active.push(user)
      } else {
        pending.push(user)
      }
    }

    return { active, pending }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function deleteUser(userId: string) {
  try {
    await requireAdmin()

    const admin = adminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)

    if (error) return { error: error.message }

    const supabase = await createClient()
    await supabase.from('user_teams').delete().eq('user_id', userId)
    await supabase.from('users').delete().eq('id', userId)

    return { success: true }
  } catch (e: any) {
    return { error: e.message }
  }
}