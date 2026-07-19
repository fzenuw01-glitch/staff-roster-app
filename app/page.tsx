'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function Login() {
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const router = useRouter()

  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      }
    }
    checkSession()
  }, [router, supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      let error;
      if (loginMethod === 'email') {
        const { error: emailError } = await supabase.auth.signInWithPassword({ email, password })
        error = emailError
      } else {
        const formattedPhone = phone.startsWith('+') ? phone : `+44${phone.replace(/^0/, '')}`
        const { error: phoneError } = await supabase.auth.signInWithPassword({ phone: formattedPhone, password })
        error = phoneError
      }

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setMessage(`An unexpected error occurred: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setMessage('Please enter your email address first.')
      return
    }
    
    setLoading(true)
    setMessage('')
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // This URL tells Supabase where to send the user after they click the email link
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Password reset email sent! Please check your inbox.')
    }
    
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Roster & Wages Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Staff & Roster Portal</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
          <button type="button" className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`} onClick={() => { setLoginMethod('email'); setMessage(''); }}>Email</button>
          <button type="button" className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`} onClick={() => { setLoginMethod('phone'); setMessage(''); }}>Phone</button>
        </div>
        {/* ADD THIS BLOCK HERE */}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {loginMethod === 'email' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
              <input type="email" required className="w-full px-3 py-2 border border-slate-200 rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Phone Number</label>
              <input type="tel" required className="w-full px-3 py-2 border border-slate-200 rounded-lg" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          )}

           <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
              
              {/* ADDED: Forgot Password Button */}
              {loginMethod === 'email' && (
                <button 
                  type="button" 
                  onClick={handleResetPassword} 
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            
            <input 
              type="password" 
              required={loginMethod === 'email'} 
              className="w-full px-3 py-2 border border-slate-200 rounded-lg" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}