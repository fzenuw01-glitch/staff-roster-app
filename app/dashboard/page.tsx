'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import moment from 'moment'
import TeamCalendar from '../components/TeamCalendar'
import { getCoordinates } from '@/lib/geolocation'

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

  // Haversine distance calculator for GPS verification
  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); 
  };

const fetchData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/')

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select(`
        *, 
        locations:location_id (latitude, longitude, radius_meters)
      `)
      .eq('id', session.user.id)
      .single()

    setProfile(profileData)

    // Fetch user's shifts
    const { data: shiftData } = await supabase
      .from('daily_shifts')
      .select('*')
      .eq('user_id', session.user.id)

    setShifts(shiftData || [])

    // Robustly find today's active shift checking common date column variations
// Robustly match today's shift
    const todayStr = moment().format('YYYY-MM-DD')
    const todaysShift = (shiftData || []).find((s: any) => {
      const shiftDate = s.date || s.shift_date || (s.rostered_start ? moment(s.rostered_start).format('YYYY-MM-DD') : null)
      return shiftDate === todayStr
    })
    
    setCurrentShift(todaysShift)
    console.log("DEBUG - Today's date:", todayStr, "Matched shift:", todaysShift)

    // Check for upcoming or active shift warnings
    if (todaysShift && todaysShift.rostered_start && todaysShift.rostered_end) {
      const startTimeStr = typeof todaysShift.rostered_start === 'string' && todaysShift.rostered_start.includes('T') 
        ? moment(todaysShift.rostered_start).format('HH:mm') 
        : todaysShift.rostered_start.slice(0, 5)
        
      const shiftStartDateTime = moment(`${todayStr} ${startTimeStr}`, 'YYYY-MM-DD HH:mm')
      const now = moment()

      const diffMinutes = shiftStartDateTime.diff(now, 'minutes')

      if (todaysShift.actual_start && !todaysShift.actual_finish) {
        setShiftAlert(`🟢 You are currently clocked in for today's shift.`)
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

const handleClockToggle = async () => {
    console.log("Clock button clicked. Current shift state:", currentShift);

    if (!currentShift) {
      alert("Clock Action Blocked: No shift assigned for today's date was found in your schedule.");
      return;
    }

    setIsClocking(true);
    setNotification(null);

    try {
      const isClockingIn = !currentShift.actual_start;
      const isExemptRole = ["manager", "master", "admin", "developer"].includes(profile?.role);

      let lat = null;
      let lng = null;

      // Geolocation check with graceful fallback
      if (profile?.locations) {
        const loc = Array.isArray(profile.locations) ? profile.locations[0] : profile.locations;
        if (loc && loc.latitude && loc.longitude && loc.radius_meters) {
          try {
            const coords = await getCoordinates();
            if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
              lat = coords.lat;
              lng = coords.lng;
              const distanceInMeters = getDistance(coords.lat, coords.lng, loc.latitude, loc.longitude);
              const onSite = distanceInMeters <= loc.radius_meters;

              if (!onSite && !isExemptRole) {
                throw new Error(`Clock blocked: You are ${distanceInMeters}m away from site. Must be within ${loc.radius_meters}m.`);
              }
            }
          } catch (geoErr: any) {
            console.warn("GPS warning:", geoErr.message);
            if (!isExemptRole) {
              throw new Error(geoErr.message || "Unable to verify GPS location.");
            }
          }
        }
      }

      const now = moment().toISOString();
      
      // Update payload for daily_shifts table
      const updateData: any = isClockingIn 
        ? { actual_start: now } 
        : { actual_finish: now };

      const { error: shiftError } = await supabase
        .from('daily_shifts')
        .update(updateData)
        .eq('id', currentShift.id);

      if (shiftError) throw shiftError;

      // Audit trail record for manual_logs / timesheets
      const { error: logError } = await supabase
        .from('manual_logs')
        .insert({
          user_id: profile?.id,
          action: isClockingIn ? 'clock_in' : 'clock_out',
          timestamp: now,
          shift_id: currentShift.id
        });

      if (logError) {
        console.warn("Manual log insertion warning:", logError.message);
      }

      const successMsg = isClockingIn ? "Successfully clocked in!" : "Successfully clocked out!";
      setNotification(successMsg);
      alert(successMsg);
      
      await fetchData();
    } catch (err: any) {
      console.error("Clock action error:", err);
      alert(`Clock Error: ${err.message || 'Failed to process action'}`);
    } finally {
      setIsClocking(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

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
  const isClockedIn = Boolean(currentShift?.actual_start) && !currentShift?.actual_finish

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome, {profile?.full_name || 'Staff Member'}</h1>
          <p className="text-sm text-slate-500">Here is your personal schedule and attendance overview.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => router.push('/dashboard/admin')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
            >
              Switch to Admin Roster Builder &rarr;
            </button>
          )}

          <button
            onClick={() => onViewPayslip(profile?.id)}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition cursor-pointer"
          >
            View Payslip
          </button>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
          >
            Sign Out
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

      {/* Action Widgets Grid: Leave Form & Clock Widget side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Request Time Off (Takes up 2 columns) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Request Time Off / Holiday</h2>
          <form onSubmit={handleLeaveSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Notes</label>
              <input
                placeholder="Optional details (e.g., Annual family holiday)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingLeave}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmittingLeave ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>

        {/* Shift Attendance / Standalone Clock Widget (Takes up 1 column) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Shift Attendance</h2>
            <p className="text-xs text-slate-500">Clock in when starting your shift and clock out when finished.</p>
          </div>

          <div className="pt-4">
            {currentShift?.actual_finish ? (
              <span className="text-xs font-bold text-slate-400 uppercase">Shift Completed</span>
            ) : (
<button 
  onClick={handleClockToggle}
  disabled={isClocking || !currentShift}
  className={`w-full py-3 rounded-xl text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
    isClockedIn ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
  }`}
>
  {isClocking ? "Verifying GPS..." : isClockedIn ? "Clock Out" : "Clock In"}
</button>
            )}
          </div>
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