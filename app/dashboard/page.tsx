'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase' // using the @ alias is safer!
import CurrentShiftAction from '../components/CurrentShiftAction';
import SwapRequests from '../components/SwapRequests'; // Add this import
import TeamCalendar from '../components/TeamCalendar';
import { calculateDashboardStats } from '@/lib/stats';

export default function StaffDashboard() {
  const supabase = createClient();
  const router = useRouter();

  // Unified State Declarations
  const [profile, setProfile] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]); 
  const [leaves, setLeaves] = useState<any[]>([]);
  const [stats, setStats] = useState({ scheduled: 0, holiday: 0, sick: 0, overtime: 0 });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // 1. Trigger data fetch on mount
  useEffect(() => {
    fetchUserDataAndShifts();
  }, []);

  // 2. Recalculate stats whenever shifts, leaves, or profile update
  useEffect(() => {
    if (profile && shifts.length >= 0 && leaves.length >= 0) {
      const calculatedStats = calculateDashboardStats(
        shifts, 
        leaves, 
        profile.contracted_hours || 40
      );
      setStats(calculatedStats);
    }
  }, [shifts, leaves, profile]);

  const fetchUserDataAndShifts = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('contracted_hours, id, role, full_name, email, employment_type') // Added employment_type here!
      .eq('id', session.user.id)
      .single();

    if (profileError) console.error("Profile error:", profileError);

    // Fetch Shifts 
    const { data: shiftData, error: shiftError } = await supabase
      .from('daily_shifts')
      .select('*')
      .eq('user_id', session.user.id);

    if (shiftError) console.error("Shift fetch error:", shiftError);

    // Fetch Leaves
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', session.user.id);

    if (leaveError) console.error("Leave fetch error:", leaveError);

    // Update States
    setProfile(userProfile);
    setShifts(shiftData || []);
    setLeaves(leaveData || []);
    setLoading(false);
  };
  
  // ... rest of your code

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
            {/* Render the employment type dynamically */}
            <span className="inline-block mt-2 px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md uppercase tracking-wider">
              {profile?.employment_type || 'Employee'}
            </span>
          </div>
            {(profile?.role === 'manager' || profile?.role === 'master') && (
              <button onClick={() => router.push('/dashboard/admin')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">⚙️ Admin Builder</button>
            )}
            <button onClick={() => router.push('/dashboard/payslip')} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">📄 View Payslip</button>
            <button onClick={handleSignOut} className="text-slate-500 hover:text-red-600 font-medium px-2 py-2 transition-colors">Sign Out</button>
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

        {/* Roster Calendar */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Your Roster</h2>
          <TeamCalendar userRole={profile?.role} userId={profile?.id} />
        </div>
      </div>
    </div>
  )
}