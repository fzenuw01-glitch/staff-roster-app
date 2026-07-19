'use client'
import { useState, useEffect } from 'react'
import { updateStaffProfile } from '@/app/actions/user'
import { createClient } from '@/lib/supabase'

export default function ProfileSetup() {
  // Add this line right here at the top of the component
  const supabase = createClient() 

  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUser() {
      // supabase is now safely defined and uses cookies!
      const { data: { user } } = await supabase.auth.getUser() 
      if (user) setUserEmail(user.email ?? null)
    }
    fetchUser()
  }, [supabase]) // Add supabase to the dependency array to be safe

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = await updateStaffProfile(formData)
    
    if (result.error) {
      alert(`Error: ${result.error}`)
    } else {
      alert('Profile updated successfully!')
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold mb-1">Complete Your Profile</h1>
        
        {/* User identification display */}
        {userEmail && (
          <p className="text-slate-500 mb-6 text-sm">
            Updating details for: <span className="font-semibold text-indigo-600">{userEmail}</span>
          </p>
        )}
        
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Create Password</label>
            <input 
              required 
              name="password"
              type="password" 
              placeholder="Min 6 characters" 
              className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600">Phone Number (Optional)</label>
            <input name="phone" type="text" className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600">Address (Optional)</label>
            <textarea name="address" className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600">Bank Account (Optional)</label>
            <input name="bank_account" type="text" className="w-full p-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600">Sort Code (Optional)</label>
            <input name="sort_code" type="text" className="w-full p-2 border rounded" />
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded-lg font-bold mt-4" disabled={loading}>
            {loading ? 'Saving...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}