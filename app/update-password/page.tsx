'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    // Supabase will automatically use the session established by the email link's code
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      alert('Password updated successfully!')
      router.push('/dashboard') // Send them to the dashboard once done
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Set New Password</h1>
        
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}