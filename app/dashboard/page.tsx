'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import CurrentShiftAction from '../components/CurrentShiftAction'
import SwapRequests from '../components/SwapRequests'
import TeamCalendar from '../components/TeamCalendar'
import { calculateDashboardStats } from '@/lib/stats'

export default function StaffDashboard() {
  const supabase = createClient()
  const router = useRouter()

  // Unified State Declarations
  const [profile, setProfile] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([]) 
  const [leaves, setLeaves] = useState<any[]>([])
  const [stats, setStats] = useState({ scheduled: 0, holiday: 0, sick: 0, overtime: 0 })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [allStaff, setAllStaff] = useState<any[]>([])
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all')

  // 1. Trigger data fetch on mount
  useEffect(() => {
    fetchUserDataAndShifts()
  }, [])

  // Memoize displayedShifts to prevent infinite re-render loops caused by new array references on every render
  const displayedShifts = useMemo(() => {
    return selectedStaffFilter === 'all'
      ? shifts
      : shifts.filter(shift => shift.user_id === selectedStaffFilter)
  }, [shifts, selectedStaffFilter])

  // 2. Recalculate stats whenever displayedShifts, leaves, profile, or the current month updates
  useEffect(() => {
    if (profile && displayedShifts.length >= 0) {
      const viewStartDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const viewEndDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59)

      const calculatedStats = calculateDashboardStats(
        displayedShifts, 
        leaves, 
        profile.contracted_hours || 40,
        viewStartDate,
        viewEndDate
      )
      setStats(calculatedStats)
    }
  }, [displayedShifts, leaves, profile, currentMonth])

  const fetchUserDataAndShifts = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/'); return; }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('contracted_hours, id, role, full_name, email, employment_type')
      .eq('id', session.user.id)
      .single()

    if (profileError) console.error("Profile error:", profileError)
    setProfile(userProfile)

    // If manager, master, or admin, fetch all staff and all company shifts/leaves
    const isAdminOrManager = userProfile?.role === 'manager' || userProfile?.role === 'master' || userProfile?.role === 'admin'

    if (isAdminOrManager) {
      const { data: staffList } = await supabase.from('profiles').select('id, full_name')
      setAllStaff(staffList || [])

      const { data: allShifts, error: shiftError } = await supabase.from('daily_shifts').select('*')
      if (shiftError) console.error("Shift fetch error:", shiftError)
      setShifts(allShifts || [])

      const { data: allLeaves, error: leaveError } = await supabase.from('leave_requests').select('*')
      if (leaveError) console.error("Leave fetch error:", leaveError)
      setLeaves(allLeaves || [])
    } else {
      const { data: shiftData } = await supabase.from('daily_shifts').select('*').eq('user_id', session.user.id)
      const { data: leaveData } = await supabase.from('leave_requests').select('*').eq('user_id', session.user.id)
      setShifts(shiftData || [])
      setLeaves(leaveData || [])
    }

    setLoading(false)
  }

  const TeamCalendarWithShifts = TeamCalendar as any

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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
            <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md uppercase tracking-wider">
              {profile?.employment_type || 'Employee'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(profile?.role === 'manager' || profile?.role === 'master' || profile?.role === 'admin') && (
              <button onClick={() => router.push('/dashboard/admin')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">⚙️ Admin Builder</button>
            )}
            <button onClick={() => router.push('/dashboard/payslip')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">📄 View Payslip</button>
            <button onClick={handleSignOut} className="text-slate-500 hover:text-red-600 font-medium px-2 py-2 transition-colors">Sign Out</button>
          </div>
        </div>

        {/* Summary Panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Scheduled Work */}
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Scheduled Work</div>
              <div className="text-2xl font-black text-blue-900">{stats.scheduled}h</div>
            </div>
            <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-xl">💼</div>
          </div>

          {/* Overtime */}
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Overtime</div>
              <div className="text-2xl font-black text-indigo-600">{stats.overtime}h</div>
            </div>
            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-xl">⚡</div>
          </div>

          {/* Approved Holiday */}
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Approved Holiday</div>
              <div className="text-2xl font-black text-emerald-900">{stats.holiday}h</div>
            </div>
            <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-xl">🌴</div>
          </div>

          {/* Reported Sick */}
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Reported Sick</div>
              <div className="text-2xl font-black text-red-900">{stats.sick}h</div>
            </div>
            <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center text-xl">🤒</div>
          </div>
        </div>

        <SwapRequests userRole={profile?.role ?? 'staff'} />

        {/* Roster Calendar Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800">Team Roster</h2>

            {/* Staff View Filter Dropdown (Manager/Admin Only) */}
            {(profile?.role === 'manager' || profile?.role === 'master' || profile?.role === 'admin') && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">View Roster For:</label>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg p-2 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">👥 All Staff</option>
                  <option value={profile.id}>👤 Just Me ({profile.full_name})</option>
                  {allStaff
                    .filter(staff => staff.id !== profile.id)
                    .map(staff => (
                      <option key={staff.id} value={staff.id}>
                        👤 {staff.full_name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <TeamCalendarWithShifts 
            userRole={profile?.role} 
            userId={profile?.id} 
            shifts={displayedShifts}
          />
        </div>

      </div>
    </div>
  )
}