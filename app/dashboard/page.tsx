'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import moment from 'moment'
import TeamCalendar from '../components/TeamCalendar'

export default function StaffDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [activeMonth, setActiveMonth] = useState<string>(moment().format('YYYY-MM'))
  
  // Standalone Clock In/Out State
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [isClocking, setIsClocking] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [shiftAlert, setShiftAlert] = useState<string | null>(null)

  // Leave Request Form State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/')

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    setProfile(profileData)

    // Fetch user's shifts
    const { data: shiftData } = await supabase
      .from('daily_shifts')
      .select('*')
      .eq('user_id', session.user.id)

    setShifts(shiftData || [])

    // Find today's active shift for the standalone clock widget & notifications
    const todayStr = moment().format('YYYY-MM-DD')
    const todaysShift = (shiftData || []).find((s: any) => s.date === todayStr)
    setCurrentShift(todaysShift)

    // Check for upcoming or active shift warnings
    if (todaysShift && todaysShift.rostered_start && todaysShift.rostered_end) {
      const startTimeStr = todaysShift.rostered_start.slice(0, 5)
      const shiftStartDateTime = moment(`${todayStr} ${startTimeStr}`, 'YYYY-MM-DD HH:mm')
      const now = moment()

      const diffMinutes = shiftStartDateTime.diff(now, 'minutes')

      if (todaysShift.actual_start && !todaysShift.actual_finish) {
        setShiftAlert(`🟢 You are currently clocked in for today's shift (${startTimeStr} - ${todaysShift.rostered_end.slice(0, 5)}).`)
      } else if (!todaysShift.actual_start && diffMinutes > 0 && diffMinutes <= 120) {
        setShiftAlert(`⏰ Reminder: Your shift starts soon at ${startTimeStr} (${diffMinutes} minutes from now)!`)
      } else if (!todaysShift.actual_start && diffMinutes <= 0 && diffMinutes >= -60) {
        setShiftAlert(`⚠️ Your shift started at ${startTimeStr}. Please remember to clock in!`)
      } else {
        setShiftAlert(null)
      }
    }

    // Fetch user leave requests
    const { data: leaveData } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', session.user.id)

    setLeaveRequests(leaveData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const onViewPayslip = (userId?: string) => {
    if (userId) {
      router.push(`/dashboard/payslip/${userId}`)
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out error:', error.message)
      return
    }

    router.push('/')
  }

  // Standalone live clock toggle button for staff members
  const handleClockToggle = async () => {
    if (!currentShift) {
      setNotification("No shift assigned for today to clock into.")
      return
    }

    setIsClocking(true)
    const now = moment().toISOString()
    const isClockingIn = !currentShift.actual_start

    const updateField = isClockingIn ? { actual_start: now } : { actual_finish: now }

    const { error: shiftError } = await supabase
      .from('daily_shifts')
      .update(updateField)
      .eq('id', currentShift.id)

    if (shiftError) {
      setNotification(`Error: ${shiftError.message}`)
      setIsClocking(false)
      return
    }

    const { error: logError } = await supabase
      .from('manual_logs')
      .insert({
        user_id: profile?.id,
        action: isClockingIn ? 'clock_in' : 'clock_out',
        timestamp: now,
        shift_id: currentShift.id
      })

    if (logError) {
      console.warn("Manual log table insert warning:", logError.message)
    }

    setNotification(isClockingIn ? "Successfully clocked in!" : "Successfully clocked out!")
    fetchData()
    setIsClocking(false)
    setTimeout(() => setNotification(null), 3000)
  }

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      alert("Please select start and end dates.")
      return
    }

    setIsSubmittingLeave(true)
    const { data: { session } } = await supabase.auth.getSession()

    const { error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: session?.user.id,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending'
      })

    if (error) {
      alert(`Failed to submit leave request: ${error.message}`)
    } else {
      alert("Leave request submitted successfully!")
      setStartDate('')
      setEndDate('')
      setReason('')
      fetchData()
    }
    setIsSubmittingLeave(false)
  }

  // Calculations for Ticker Stats
  let totalScheduledMinutes = 0
  let totalWorkedMinutes = 0

  shifts.forEach(shift => {
    if (shift.rostered_start && shift.rostered_end) {
      const rStart = moment(shift.rostered_start, ['HH:mm', 'HH:mm:ss'])
      const rEnd = moment(shift.rostered_end, ['HH:mm', 'HH:mm:ss'])
      let mins = rEnd.diff(rStart, 'minutes')
      if (mins < 0) mins += 24 * 60
      totalScheduledMinutes += mins
    }
    if (shift.actual_start && shift.actual_finish) {
      const aStart = moment(shift.actual_start)
      const aFinish = moment(shift.actual_finish)
      const diff = aFinish.diff(aStart, 'minutes')
      if (diff > 0) totalWorkedMinutes += diff
    }
  })

  const scheduledHours = (totalScheduledMinutes / 60).toFixed(0)
  const overtimeMinutes = Math.max(0, totalWorkedMinutes - totalScheduledMinutes)
  const overtimeHours = (overtimeMinutes / 60).toFixed(0)

  const totalAllowanceDays = 25
  const approvedLeaveDays = leaveRequests
    .filter(req => req.status === 'approved')
    .reduce((acc, req) => {
      const start = moment(req.start_date)
      const end = moment(req.end_date)
      return acc + end.diff(start, 'days') + 1
    }, 0)
  const remainingBalanceDays = Math.max(0, totalAllowanceDays - approvedLeaveDays)

  if (loading) {
    return <div className="p-8 text-slate-600 animate-pulse">Loading Staff Dashboard...</div>
  }

  const isAdmin = ['admin', 'master', 'developer', 'manager'].includes(profile?.role)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
{/* Welcome Header */}
<div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">Welcome, {profile?.full_name || 'Staff Member'}</h1>
    <p className="text-sm text-slate-500">Here is your personal schedule and attendance overview.</p>
  </div>
  
  <div className="flex items-center gap-3">
    {isAdmin && (
      <button
        onClick={() => router.push('/dashboard/admin')}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition"
      >
        Switch to Admin Roster Builder &rarr;
      </button>
    )}
    
    <button
      onClick={handleSignOut}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition"
    >
      Sign Out
    </button>
  </div>

<div className="flex items-center gap-2">
    {/* Restored View Payslip Button */}
    <button
      onClick={() => onViewPayslip(profile?.id)}
      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition"
    >
      View Payslip
    </button>
  </div>
</div>

      {/* Dynamic Shift Reminder / Status Alert */}
      {shiftAlert && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm font-semibold shadow-sm flex items-center justify-between">
          <span>{shiftAlert}</span>
        </div>
      )}

      {notification && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-sm font-medium">
          {notification}
        </div>
      )}

      {/* Personal Metric Tickers */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Allowance</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalAllowanceDays} Days</h3>
            </div>
            <div className="text-2xl">📅</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Used Holiday</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-1">{approvedLeaveDays} Days</h3>
            </div>
            <div className="text-2xl">✈️</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{remainingBalanceDays} Days</h3>
            </div>
            <div className="text-2xl">🌴</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Work</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{scheduledHours}h</h3>
            </div>
            <div className="text-2xl">💼</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overtime</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-1">{overtimeHours}h</h3>
            </div>
            <div className="text-2xl">⚡</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Holiday</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{approvedLeaveDays * 8}h</h3>
            </div>
            <div className="text-2xl">🌴</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reported Sick</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">0h</h3>
            </div>
            <div className="text-2xl">🤒</div>
          </div>
        </div>
      </div>

      {/* Action Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Clock In / Out</h2>
          <p className="text-sm text-slate-500">
            {currentShift 
              ? `Today's Shift: ${currentShift.rostered_start?.slice(0,5)} - ${currentShift.rostered_end?.slice(0,5)}`
              : 'No shift rostered for today.'}
          </p>
          <button
            onClick={handleClockToggle}
            disabled={isClocking || !currentShift}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition shadow-sm cursor-pointer ${
              currentShift?.actual_start && !currentShift?.actual_finish 
                ? 'bg-rose-600 hover:bg-rose-700' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {isClocking ? 'Processing...' : currentShift?.actual_start && !currentShift?.actual_finish ? 'Clock Out' : 'Clock In'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Request Time Off / Holiday</h2>
          <form onSubmit={handleLeaveSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Notes</label>
              <input 
                placeholder="Optional details (e.g., Annual family holiday)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button 
              type="submit"
              disabled={isSubmittingLeave}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmittingLeave ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>
      </div>

      {/* My Assigned Shifts Calendar View */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">My Schedule</h2>
        <TeamCalendar
          userRole={profile?.role}
          userId={profile?.id}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
        />
      </div>
    </div>
  )
}