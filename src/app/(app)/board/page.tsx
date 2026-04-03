'use client'

import { createClient } from '@/lib/supabase/client'

export default function BoardPage() {
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div>
      <p>Board</p>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  )
}
