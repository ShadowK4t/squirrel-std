'use client'

import { useState } from 'react'
import { signIn } from './actions'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset]       = useState(false)
  const [resetEmail, setResetEmail]     = useState('')
  const [resetSent, setResetSent]       = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = '/board'
    }
  }

  async function handleResetRequest(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setResetSent(true)
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">SquirrelStd</h1>
          <p className="text-sm text-muted-foreground">
            {showReset ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        {showReset ? (
          resetSent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If an account exists for <strong>{resetEmail}</strong>, a reset link has been sent. Check your email.
              </p>
              <Button variant="ghost" className="w-full" onClick={() => { setShowReset(false); setResetSent(false) }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? 'Sending...' : 'Send reset link'}
              </Button>
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <Input id="password" name="password" type="password" required />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
