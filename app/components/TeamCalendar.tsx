"use client";

import { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import moment from 'moment';

export default function TeamCalendar({ userRole, userId, activeMonth }: { userRole: string, userId: string, activeMonth: string }) {
  const [shifts, setShifts] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [notification, setNotification] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Modal State for Shift Editing
  const [selectedCell, setSelectedCell] = useState<{
    userId: string;
    userName: string;
    date: string;
    shift?: any;
  } | null>(null);

  const [editForm, setEditForm] = useState({
    rostered_start: '',
    rostered_end: '',
    status: 'scheduled', // 'scheduled' | 'off'
    apply_until: '',
  });

  const [clipboard, setClipboard] = useState<any>(null);

  const isManager = userRole === 'manager' || userRole === 'master' || userRole === 'admin';

  // 1. Keep main effect at the top level
  useEffect(() => {
    fetchData();
  }, [activeMonth, userRole, userId]);

  // 2. Define fetchData cleanly
  const fetchData = async () => {
    if (!activeMonth) return; // Guard against undefined
    const startDate = `${activeMonth}-01`;
    const endDate = moment(`${activeMonth}-01`, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD');
    const todayStr = moment().format('YYYY-MM-DD');

    // Fetch staff profiles
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, employment_type');
    
    // Fetch shifts for the month
    let shiftQuery = supabase
      .from('daily_shifts')
      .select('id, date, user_id, rostered_start, rostered_end, actual_start, actual_finish, hours, status, profiles:user_id(full_name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (!isManager) {
      shiftQuery = shiftQuery.eq('user_id', userId);
    }

    const { data: shiftsResult } = await shiftQuery;
    if (shiftsResult) setShifts(shiftsResult);

    // Map clock-in status for today
    if (profiles && shiftsResult) {
      const updatedProfiles = profiles.map(staff => {
        const todaysShift = shiftsResult.find(
          s => s.user_id === staff.id && s.date === todayStr
        );
        const isClockedIn = Boolean(todaysShift?.actual_start && !todaysShift?.actual_finish);
        const isUnscheduled = isClockedIn && (todaysShift?.status === 'off' || !todaysShift?.rostered_start);

        return {
          ...staff,
          isClockedIn,
          isUnscheduled
        };
      });
      setStaffList(updatedProfiles);
    }

    // Fetch leaves for the month
    let leaveQuery = supabase
      .from('leave_requests')
      .select('id, user_id, start_date, end_date, leave_type, profiles(full_name)')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (!isManager) {
      leaveQuery = leaveQuery.eq('user_id', userId);
    }

    const { data: leavesResult } = await leaveQuery;
    if (leavesResult) setLeaveData(leavesResult);
  };

  // 3. Keep browser notification hooks completely outside of fetchData
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkShiftReminders = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = moment();
      
      shifts.forEach((shift) => {
        if (shift.user_id === userId && shift.rostered_start) {
          const shiftStartTime = moment(`${shift.date} ${shift.rostered_start}`, 'YYYY-MM-DD HH:mm');
          const diffMinutes = shiftStartTime.diff(now, 'minutes');

          if (diffMinutes === 30) {
            new Notification('Upcoming Shift Reminder', {
              body: `Your shift starts in 30 minutes at ${shift.rostered_start}. Don't forget to clock in!`,
              icon: '/favicon.ico'
            });
          }
        }
      });
    };

    const interval = setInterval(checkShiftReminders, 60000);
    return () => clearInterval(interval);
  }, [shifts, userId]);

  // Days in current month array
  const daysInMonth = useMemo(() => {
    if (!activeMonth || typeof activeMonth !== 'string' || !activeMonth.includes('-')) {
      return [];
    }
    const [year, month] = activeMonth.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${activeMonth}-${String(dayNum).padStart(2, '0')}`;
      const mDate = moment(dateStr, 'YYYY-MM-DD');
      const isWeekend = mDate.day() === 0 || mDate.day() === 6;
      return {
        dayNum,
        dateStr,
        dayName: mDate.format('ddd'),
        isWeekend
      };
    });
  }, [activeMonth]);

  const handleCellClick = (staffMember: any, dateStr: string, existingShift?: any) => {
    if (!isManager) return;

    setSelectedCell({
      userId: staffMember.id,
      userName: staffMember.full_name,
      date: dateStr,
      shift: existingShift,
    });

    setEditForm({
      rostered_start: existingShift?.rostered_start || '09:00',
      rostered_end: existingShift?.rostered_end || '17:00',
      status: existingShift?.status === 'off' ? 'off' : 'scheduled',
      apply_until: dateStr,
    });
  };

  const handleCopy = () => {
    setClipboard({
      rostered_start: editForm.rostered_start,
      rostered_end: editForm.rostered_end,
      status: editForm.status
    });
    setNotification('Shift copied to clipboard!');
    setTimeout(() => setNotification(null), 2000);
  };

  const handlePaste = () => {
    if (clipboard) {
      setEditForm({
        ...editForm,
        rostered_start: clipboard.rostered_start,
        rostered_end: clipboard.rostered_end,
        status: clipboard.status
      });
    }
  };

  const handleSaveShift = async () => {
    if (!selectedCell) return;

    let calculatedHours = 0;
    if (editForm.status !== 'off' && editForm.rostered_start && editForm.rostered_end) {
      const start = moment(editForm.rostered_start, 'HH:mm');
      const end = moment(editForm.rostered_end, 'HH:mm');
      calculatedHours = moment.duration(end.diff(start)).asHours();
      if (calculatedHours < 0) calculatedHours += 24; 
    }

    const payloads = [];
    let current = moment(selectedCell.date);
    const end = moment(editForm.apply_until || selectedCell.date);

    while (current.isSameOrBefore(end)) {
      payloads.push({
        user_id: selectedCell.userId,
        date: current.format('YYYY-MM-DD'),
        rostered_start: editForm.status === 'off' ? null : editForm.rostered_start,
        rostered_end: editForm.status === 'off' ? null : editForm.rostered_end,
        hours: editForm.status === 'off' ? 0 : calculatedHours,
        status: editForm.status,
      });
      current.add(1, 'days');
    }

    const { error } = await supabase
      .from('daily_shifts')
      .upsert(payloads, { onConflict: 'user_id,date' });

    if (error) {
      setNotification(`Error updating shifts: ${error.message}`);
    } else {
      fetchData();
      setSelectedCell(null);
    }
  };

  const displayedStaff = useMemo(() => {
    if (!isManager) {
      return staffList.filter(s => s.id === userId);
    }
    if (selectedStaffFilter === 'all') {
      return staffList;
    }
    return staffList.filter(s => s.id === selectedStaffFilter);
  }, [staffList, selectedStaffFilter, isManager, userId]);

  const totalStats = useMemo(() => {
    let scheduledHours = 0;

    shifts.forEach(shift => {
      if (selectedStaffFilter === 'all' || shift.user_id === selectedStaffFilter || !isManager) {
        if (shift.status !== 'off' && shift.hours) {
          scheduledHours += Number(shift.hours);
        }
      }
    });

    return {
      scheduled: scheduledHours.toFixed(1),
    };
  }, [shifts, selectedStaffFilter, isManager]);

  return (
    <div className="space-y-6">
      {notification && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-slate-800 text-white rounded-lg shadow-lg font-medium">
          {notification}
        </div>
      )}

      {/* Top Controls & Hours Summary Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase">Roster Month:</label>
          <input 
            type="month" 
            value={activeMonth || ''}
            readOnly
            className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-6 text-sm font-semibold text-slate-700">
          <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 shadow-2xs">
            Total Scheduled Hours: <span className="font-black text-indigo-900">{totalStats.scheduled}h</span>
          </div>
        </div>

        {isManager && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase">Filter Staff:</label>
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 text-sm font-semibold"
            >
              <option value="all">All Staff Members</option>
              {staffList.map(staff => (
                <option key={staff.id} value={staff.id}>{staff.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Matrix View */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-200">
                <th className="p-3.5 sticky left-0 bg-slate-900 z-20 min-w-55 font-bold uppercase tracking-wider">
                  Staff Member
                </th>
                {daysInMonth.map(day => (
                  <th 
                    key={day.dateStr}
                    className={`p-2.5 text-center min-w-26.25 border-l border-slate-700 ${
                      day.isWeekend ? 'bg-slate-800 text-amber-300' : ''
                    }`}
                  >
                    <div className="font-medium text-[11px]">{day.dayName}</div>
                    <div className="text-sm font-black">{day.dayNum}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {displayedStaff.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth.length + 1} className="p-8 text-center text-slate-400 font-medium">
                    No staff records found for this period.
                  </td>
                </tr>
              ) : (
                displayedStaff.map(staff => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sticky left-0 bg-white border-r border-slate-200 font-bold text-slate-900 shadow-sm z-10">
                      <div className="flex flex-col">
                        <div className="text-sm truncate max-w-50" title={staff.full_name}>
                          {staff.full_name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-normal uppercase">
                            {staff.employment_type || 'Standard Employee'}
                          </span>
                          {staff.isClockedIn ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Clocked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-500 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              Not Clocked
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {daysInMonth.map(day => {
                      const shift = shifts.find(
                        s => s.user_id === staff.id && moment(s.date).format('YYYY-MM-DD') === day.dateStr
                      );
                      const leave = leaveData.find(
                        l => l.user_id === staff.id && day.dateStr >= l.start_date && day.dateStr <= l.end_date
                      );
                      const isOff = !shift || shift.status === 'off' || !shift.rostered_start;

                      return (
                        <td 
                          key={day.dateStr} 
                          onClick={() => handleCellClick(staff, day.dateStr, shift)}
                          className={`p-2 text-center border-l border-slate-100 align-middle transition-colors ${
                            isManager ? 'cursor-pointer hover:bg-indigo-50/60' : ''
                          } ${day.isWeekend ? 'bg-slate-50/50' : ''}`}
                        >
                          {leave ? (
                            <div className={`p-1.5 rounded text-[11px] font-bold ${
                              leave.leave_type === 'sick' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {leave.leave_type === 'sick' ? '🤒 Sick' : '🌴 Holiday'}
                            </div>
                          ) : isOff ? (
                            <span className="inline-block px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-100 rounded hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                              OFF
                            </span>
                          ) : (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-1.5 text-[11px] shadow-2xs space-y-1">
                              <div className="font-bold text-indigo-950 leading-tight">
                                {shift.rostered_start} - {shift.rostered_end}
                              </div>
                              <div className="text-[10px] text-indigo-600 font-semibold">
                                {shift.hours ? `${shift.hours}h` : ''}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Shift Edit Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Edit Shift: {selectedCell.userName}
            </h3>
            <p className="text-sm text-slate-500">Date: {selectedCell.date}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm bg-white"
                >
                  <option value="scheduled">Scheduled Work</option>
                  <option value="off">Day Off (OFF)</option>
                </select>
              </div>

              {editForm.status === 'scheduled' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={editForm.rostered_start}
                      onChange={(e) => setEditForm({ ...editForm, rostered_start: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">End Time</label>
                    <input
                      type="time"
                      value={editForm.rostered_end}
                      onChange={(e) => setEditForm({ ...editForm, rostered_end: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Apply Until (Date Range)</label>
              <input
                type="date"
                value={editForm.apply_until}
                min={selectedCell.date}
                onChange={(e) => setEditForm({ ...editForm, apply_until: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm bg-white cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors shadow-sm border border-slate-200"
                >
                  Copy
                </button>
                {clipboard && (
                  <button
                    onClick={handlePaste}
                    className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    Paste
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCell(null)}
                  className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveShift}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                >
                  Save Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}