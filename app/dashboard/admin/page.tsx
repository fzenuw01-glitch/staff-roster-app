'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import TeamCalendar from '../../components/TeamCalendar';
import LeaveApprovalWidget from '../../components/LeaveApprovalWidget';
import ShiftGeneratorModal from '../../components/ShiftGeneratorModal';
import moment from 'moment';
import ClassicPatternModal from '../../components/ClassicPatternModal';
import ShiftControls from '../../components/utils/ShiftControls'

interface ShiftRecord {
  id: string;
  user_id: string;
  date: string;
  rostered_start: string;
  rostered_end: string;
  actual_start: string | null;
  actual_finish: string | null;
  status: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

// Inline Timesheets & Manual Logs Component
const TimesheetLogsView = () => {
  const supabase = createClient();
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    moment().startOf('isoWeek').format('YYYY-MM-DD')
  );

  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };
  
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => 
    moment(currentWeekStart).add(i, 'days').format('YYYY-MM-DD')
  );

  const fetchTimesheetsData = async () => {
    setLoading(true);
    const weekEnd = moment(currentWeekStart).add(6, 'days').format('YYYY-MM-DD');

    const profileResponse = await supabase.from('profiles').select('*');
    const profileData = profileResponse.data as Profile[] | null;
    
    const filteredProfiles = (profileData || []).filter(
      p => p.role !== 'master' && p.role !== 'developer'
    );
    setProfiles(filteredProfiles);

    const { data: shiftData, error } = await supabase
      .from('daily_shifts')
      .select('*')
      .gte('date', currentWeekStart)
      .lte('date', weekEnd);

    if (error) {
      setNotification(`Error loading timesheets: ${error.message}`);
    } else {
      setShifts(shiftData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTimesheetsData();
  }, [currentWeekStart]);

  const handleTimeChange = async (userId: string, dateStr: string, field: 'actual_start' | 'actual_finish', timeValue: string) => {
    if (!timeValue) return;
    const fullTimestamp = moment(`${dateStr} ${timeValue}:00`, 'YYYY-MM-DD HH:mm:ss').toISOString();

    const existingShift = shifts.find(s => s.user_id === userId && s.date === dateStr);

    if (existingShift) {
      const { error } = await supabase
        .from('daily_shifts')
        .update({ [field]: fullTimestamp })
        .eq('id', existingShift.id);

      if (error) setNotification(`Failed to update: ${error.message}`);
      else {
        setNotification('Timesheet updated.');
        setTimeout(() => setNotification(null), 2000);
        fetchTimesheetsData();
      }
    } else {
      const { error } = await supabase
        .from('daily_shifts')
        .insert({
          user_id: userId,
          date: dateStr,
          status: 'scheduled',
          [field]: fullTimestamp
        });

      if (error) setNotification(`Failed to create log: ${error.message}`);
      else {
        setNotification('Timesheet log created.');
        setTimeout(() => setNotification(null), 2000);
        fetchTimesheetsData();
      }
    }
  };

  const formatTimeForInput = (timestamp: string | null) => {
    if (!timestamp) return '';
    return moment(timestamp).format('HH:mm');
  };

  const handlePrevWeek = () => {
    setCurrentWeekStart(moment(currentWeekStart).subtract(1, 'weeks').format('YYYY-MM-DD'));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(moment(currentWeekStart).add(1, 'weeks').format('YYYY-MM-DD'));
  };

  const dailyTotals: { [key: string]: number } = {};
  weekDates.forEach(date => { dailyTotals[date] = 0; });
  let grandTotalWeeklyMinutes = 0;

  profiles.forEach(staff => {
    weekDates.forEach(date => {
      const shift = shifts.find(s => s.user_id === staff.id && s.date === date);
      if (shift?.actual_start && shift?.actual_finish) {
        const start = moment(shift.actual_start);
        const finish = moment(shift.actual_finish);
        const diff = finish.diff(start, 'minutes');
        if (diff > 0) {
          dailyTotals[date] += diff;
          grandTotalWeeklyMinutes += diff;
        }
      }
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <span className="text-sm font-bold text-slate-800">
          Showing Week: {moment(currentWeekStart).format('DD MMM YYYY')} &mdash; {moment(currentWeekStart).add(6, 'days').format('DD MMM YYYY')}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevWeek} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 font-semibold rounded-md text-xs transition cursor-pointer">
            &larr; Prev Week
          </button>
          <button onClick={handleNextWeek} className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 font-semibold rounded-md text-xs transition cursor-pointer">
            Next Week &rarr;
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-medium">
          {notification}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
              <th className="p-3 min-w-45">Staff Member</th>
              <th className="p-3 text-center bg-indigo-50/50 text-indigo-900">Contracted Weekly Avg</th>
              {weekDates.map(date => (
                <th key={date} className="p-3 text-center min-w-35">
                  {moment(date).format('ddd DD MMM')}
                </th>
              ))}
              <th className="p-3 text-center bg-slate-100 font-extrabold">Total Worked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">Loading weekly timesheets...</td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">No staff profiles found.</td>
              </tr>
            ) : (
              profiles.map((staff) => {
                let totalWeeklyWorkedMinutes = 0;
                let totalContractedWeeklyMinutes = 0;

                return (
                  <tr key={staff.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-semibold text-slate-900 text-sm">
                      {staff.full_name}
                      <div className="text-xs font-normal text-slate-400">{staff.email}</div>
                    </td>

                    {(() => {
                      weekDates.forEach(date => {
                        const shift = shifts.find(s => s.user_id === staff.id && s.date === date);
                        if (shift && shift.rostered_start && shift.rostered_end) {
                          const rStart = moment(shift.rostered_start, ['HH:mm', 'HH:mm:ss']);
                          const rEnd = moment(shift.rostered_end, ['HH:mm', 'HH:mm:ss']);
                          let mins = rEnd.diff(rStart, 'minutes');
                          if (mins < 0) mins += 24 * 60;
                          totalContractedWeeklyMinutes += mins;
                        }
                      });
                      return (
                        <td className="p-3 text-center font-bold text-indigo-700 bg-indigo-50/30 text-sm">
                          {(totalContractedWeeklyMinutes / 60).toFixed(1)}h
                        </td>
                      );
                    })()}

                    {weekDates.map(date => {
                      const shift = shifts.find(s => s.user_id === staff.id && s.date === date);
                      
                      if (shift?.actual_start && shift?.actual_finish) {
                        const start = moment(shift.actual_start);
                        const finish = moment(shift.actual_finish);
                        const diff = finish.diff(start, 'minutes');
                        if (diff > 0) totalWeeklyWorkedMinutes += diff;
                      }

                      return (
                        <td key={date} className="p-2 border-l border-slate-100 text-center">
                          <div className="text-[10px] text-slate-400 mb-1">
                            Rostered: {shift?.rostered_start && shift?.rostered_end ? `${shift.rostered_start.slice(0,5)}-${shift.rostered_end.slice(0,5)}` : 'Off'}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-emerald-600">In:</span>
                              <input 
                                type="time" 
                                defaultValue={formatTimeForInput(shift?.actual_start || null)}
                                onBlur={(e) => handleTimeChange(staff.id, date, 'actual_start', e.target.value)}
                                className="px-1 py-0.5 border border-slate-300 rounded text-xs bg-white w-24"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-rose-600">Out:</span>
                              <input 
                                type="time" 
                                defaultValue={formatTimeForInput(shift?.actual_finish || null)}
                                onBlur={(e) => handleTimeChange(staff.id, date, 'actual_finish', e.target.value)}
                                className="px-1 py-0.5 border border-slate-300 rounded text-xs bg-white w-24"
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td className="p-3 text-center font-extrabold text-slate-900 bg-slate-50 text-sm">
                      {(totalWeeklyWorkedMinutes / 60).toFixed(2)}h
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
              <td className="p-3 text-sm">Grand Total (All Staff)</td>
              <td className="p-3 text-center text-indigo-800 bg-indigo-100/50">
                {((Object.values(dailyTotals).reduce((a, b) => a + b, 0)) / 60).toFixed(1)}h
              </td>
              {weekDates.map(date => (
                <td key={date} className="p-3 text-center text-slate-700">
                  {(dailyTotals[date] / 60).toFixed(2)}h
                </td>
              ))}
              <td className="p-3 text-center text-indigo-700 bg-slate-200 text-sm">
                {(grandTotalWeeklyMinutes / 60).toFixed(2)}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// Staff Entitlements & Stats Log Component
const EntitlementsStatsLogView = () => {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntitlementsData = async () => {
      setLoading(true);
      const { data: profileData } = await supabase.from('profiles').select('*');
      const { data: shiftData } = await supabase.from('daily_shifts').select('*');
      const { data: leaveData } = await supabase.from('leave_requests').select('*');

      const filteredProfiles = (profileData || []).filter(
        (p: Profile) => p.role !== 'master' && p.role !== 'developer'
      );

      setProfiles(filteredProfiles);
      setShifts(shiftData || []);
      setLeaveRequests(leaveData || []);
      setLoading(false);
    };

    fetchEntitlementsData();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-slate-400 text-xs">Loading entitlements and performance logs...</div>;
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
            <th className="p-3 min-w-45">Staff Member</th>
            <th className="p-3">Role</th>
            <th className="p-3 text-center">Total Allowance</th>
            <th className="p-3 text-center">Used Holiday</th>
            <th className="p-3 text-center">Remaining Balance</th>
            <th className="p-3 text-center">Total Scheduled Work</th>
            <th className="p-3 text-center">Total Overtime</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {profiles.map(profile => {
            const userShifts = shifts.filter(s => s.user_id === profile.id);
            let schedMins = 0;
            let workedMins = 0;

            userShifts.forEach(shift => {
              if (shift.rostered_start && shift.rostered_end) {
                const rStart = moment(shift.rostered_start, ['HH:mm', 'HH:mm:ss']);
                const rEnd = moment(shift.rostered_end, ['HH:mm', 'HH:mm:ss']);
                let mins = rEnd.diff(rStart, 'minutes');
                if (mins < 0) mins += 24 * 60;
                schedMins += mins;
              }
              if (shift.actual_start && shift.actual_finish) {
                const aStart = moment(shift.actual_start);
                const aFinish = moment(shift.actual_finish);
                const diff = aFinish.diff(aStart, 'minutes');
                if (diff > 0) workedMins += diff;
              }
            });

            const schedHours = (schedMins / 60).toFixed(1);
            const otMins = Math.max(0, workedMins - schedMins);
            const otHours = (otMins / 60).toFixed(1);

            const totalAllowance = 25;
            const usedDays = leaveRequests
              .filter(req => req.user_id === profile.id && req.status === 'approved')
              .reduce((acc, req) => {
                const start = moment(req.start_date);
                const end = moment(req.end_date);
                return acc + end.diff(start, 'days') + 1;
              }, 0);
            const remainingDays = Math.max(0, totalAllowance - usedDays);

            return (
              <tr key={profile.id} className="hover:bg-slate-50/80">
                <td className="p-3 font-semibold text-slate-900 text-sm">
                  {profile.full_name}
                  <div className="text-xs font-normal text-slate-400">{profile.email}</div>
                </td>
                <td className="p-3 capitalize">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                    {profile.role || 'Staff'}
                  </span>
                </td>
                <td className="p-3 text-center font-medium">{totalAllowance} Days</td>
                <td className="p-3 text-center font-medium text-indigo-600">{usedDays} Days</td>
                <td className="p-3 text-center font-medium text-emerald-600">{remainingDays} Days</td>
                <td className="p-3 text-center font-medium">{schedHours}h</td>
                <td className="p-3 text-center font-medium text-indigo-600">{otHours}h</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function AdminDashboard() {
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

  const [staff, setStaff] = useState<any[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [showClassicGenerator, setShowClassicGenerator] = useState(false);
  const [showShiftGenerator, setShowShiftGenerator] = useState(false);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRate, setNewStaffRate] = useState(12.0);
  const [isInviting, setIsInviting] = useState(false);
  const [activeMonth, setActiveMonth] = useState<string>(new Date().toISOString().slice(0,7));

  const checkAccessAndFetchStaff = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/');

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .single();

    const allowedRoles = ['admin', 'master', 'developer'];
    if (!profileData || !allowedRoles.includes(profileData.role)) {
      alert("Access Denied.");
      return router.push('/dashboard');
    }

    setProfile(profileData);

    const { data: staffData } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', session.user.id)
      .neq('email', 'faisaly.zenuwah@outlook.com');

    setStaff(staffData || []);
    setLoading(false);
  };

  const handleAddStaff = async () => {
    setIsInviting(true);
    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStaffName, email: newStaffEmail, rate: newStaffRate }),
      });

      if (!response.ok) throw new Error('Failed to invite staff.');
      
      alert(`Successfully invited ${newStaffName}!`);
      setIsAddingStaff(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffRate(12.0);
      checkAccessAndFetchStaff();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  useEffect(() => {
    checkAccessAndFetchStaff();
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-600 animate-pulse">Loading Admin Builder...</div>;
  }

  return (
    <div className="p-6 max-w-[100rem] mx-auto space-y-8">
      {/* Header Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-indigo-600 hover:text-indigo-800 font-bold mb-1 flex items-center transition-colors cursor-pointer text-sm"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Roster Builder</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/dashboard/admin/staff"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            👥 Manage Staff & Contracts
          </a>
          <button
            onClick={() => setIsAddingStaff(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            + New Staff Member
          </button>
        </div>
      </div>

      {/* Leave Approvals Widget */}
      <LeaveApprovalWidget userRole={profile?.role} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">Team Roster</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClassicGenerator(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition shadow cursor-pointer"
          >
            Classic Pattern Generator
          </button>
          <button
            onClick={() => setShowShiftGenerator(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow flex items-center gap-2 cursor-pointer"
          >
            <span>⚡</span> Dynamic Shift Generator
          </button>
        </div>
      </div>

      {/* Shift Controls / Batch Generator */}
      <ShiftControls staffList={staff} />

      {/* Calendar Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Team Roster</h2>
        <TeamCalendar
          userRole={profile?.role}
          userId={profile?.id}
          activeMonth={activeMonth}
          setActiveMonth={setActiveMonth}
        />
      </div>

      {/* Staff Entitlements & Stats Log Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-1 border-b pb-2">Staff Entitlements & Performance Stats Log</h2>
        <p className="text-xs text-slate-500 mb-4">Overview of holiday allowances, remaining balances, scheduled hours, and overtime metrics.</p>
        <EntitlementsStatsLogView />
      </div>

      {/* Timesheet & Manual Logs Section at the bottom */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Timesheet & Manual Logs</h2>
        <TimesheetLogsView />
      </div>

      {/* Dynamic Shift Generator Modal */}
      <ShiftGeneratorModal
        staffList={staff}
        isOpen={showShiftGenerator}
        onClose={() => setShowShiftGenerator(false)}
        onSuccess={() => {
          checkAccessAndFetchStaff();
        }}
      />

      {/* Classic Pattern Generator Modal */}
      <ClassicPatternModal
        staffList={staff}
        isOpen={showClassicGenerator}
        onClose={() => setShowClassicGenerator(false)}
        onSuccess={() => {
          checkAccessAndFetchStaff();
        }}
      />

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Invite New Staff Member</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourly Rate (£)</label>
                <input
                  type="number"
                  step="0.50"
                  value={newStaffRate}
                  onChange={(e) => setNewStaffRate(parseFloat(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddingStaff(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isInviting}
                onClick={handleAddStaff}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {isInviting ? 'Sending Invite...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}