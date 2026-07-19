'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase' // using the @ alias is safer!
import CurrentShiftAction from '../components/CurrentShiftAction';
import SwapRequests from '../components/SwapRequests'; // Add this import
import TeamCalendar from '../components/TeamCalendar';

export default function StaffDashboard() {
  const supabase = createClient() // <-- Add this line right here
  const router = useRouter()
  const [profile, setProfile] = useState<any | null>(null)
  const [shifts, setShifts] = useState<Record<string, any>>({})
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserDataAndShifts()
  }, [currentMonth])

  const fetchUserDataAndShifts = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      router.push('/')
      return
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (userProfile) {
      setProfile(userProfile)
      // Redirect staff if they haven't set their phone number yet
      if (userProfile.role === 'staff' && !userProfile.phone) {
        router.push('/dashboard/profile-setup')
        return
      }
    }

    // Fetch shifts for the currently viewed month
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`
    const endStr = `${year}-${String(month).padStart(2, '0')}-31` 

    const { data: shiftData } = await supabase
      .from('daily_shifts')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('date', startStr)
      .lte('date', endStr)

    if (shiftData) {
      const shiftMap: any = {}
      shiftData.forEach(shift => { shiftMap[shift.date] = shift })
      setShifts(shiftMap)
    }

    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getStatusColor = (shift: any) => {
    if (!shift) return 'bg-white border-slate-200 text-slate-400'
    if (!shift.is_paid) return 'bg-gray-100 border-gray-300 text-gray-600'

    switch (shift.status) {
      case 'Working': return shift.rate_multiplier > 1 ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-blue-50 border-blue-200 text-blue-800'
      case 'Sick': return 'bg-red-50 border-red-200 text-red-800'
      case 'Holiday': return 'bg-emerald-50 border-emerald-200 text-emerald-800'
      case 'Bank Holiday': return 'bg-teal-50 border-teal-200 text-teal-800'
      case 'Training': return 'bg-purple-50 border-purple-200 text-purple-800'
      default: return 'bg-orange-50 border-orange-200 text-orange-800'
    }
  }

  let totalWorkingHours = 0
  let totalSickHours = 0
  let totalHolidayHours = 0

  Object.values(shifts).forEach((shift: any) => {
    const hours = Number(shift.hours)
    if (shift.status === 'Working') totalWorkingHours += hours
    if (shift.status === 'Sick') totalSickHours += hours
    if (shift.status === 'Holiday') totalHolidayHours += hours
  })

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() 
  const blanks = Array.from({ length: firstDay }, (_, i) => i)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">Loading your roster...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
       <CurrentShiftAction 
          userId={profile?.id} 
          userRole={profile?.role} 
        />
    <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Personalized Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile?.full_name?.split(' ')[0] || 'Team Member'}!</h1>
            <p className="text-slate-500 text-sm">{profile?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(profile?.role === 'manager' || profile?.role === 'master') && (
              <button onClick={() => router.push('/dashboard/admin')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">⚙️ Admin Builder</button>
            )}
            <button onClick={() => router.push('/dashboard/payslip')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">📄 View Payslip</button>
            <button onClick={handleSignOut} className="text-slate-500 hover:text-red-600 font-medium px-2 py-2 transition-colors">Sign Out</button>
          </div>
        </div>

        {/* Summary Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Scheduled Work</div>
              <div className="text-2xl font-black text-blue-900">{totalWorkingHours}h</div>
            </div>
            <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-xl">💼</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Approved Holiday</div>
              <div className="text-2xl font-black text-emerald-900">{totalHolidayHours}h</div>
            </div>
            <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-xl">🌴</div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Reported Sick</div>
              <div className="text-2xl font-black text-red-900">{totalSickHours}h</div>
            </div>
            <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center text-xl">🤒</div>
          </div>
        </div>

        <SwapRequests userRole={profile?.role ?? 'staff'} />

        {/* Roster Calendar */}
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
  <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Your Roster</h2>
  <TeamCalendar userRole={profile?.role} userId={profile?.id} />
</div>
      </div>
    </div>
  )
}