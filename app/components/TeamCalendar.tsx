"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import moment from 'moment';

export default function TeamCalendar({ 
  userRole, 
  userId, 
  activeMonth, 
  setActiveMonth 
}: { 
  userRole: string; 
  userId: string; 
  activeMonth: string; 
  setActiveMonth: (m: string) => void; 
}) {
  const [shifts, setShifts] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [notification, setNotification] = useState<string | null>(null);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const [viewStartDate, setViewStartDate] = useState(
    moment(`${activeMonth}-01`, 'YYYY-MM-DD').isSame(moment(), 'month')
      ? moment().format('YYYY-MM-DD')
      : `${activeMonth}-01`
  );

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [selectedCell, setSelectedCell] = useState<{
    userId: string;
    userName: string;
    date: string;
    shift?: any;
  } | null>(null);

  const [editForm, setEditForm] = useState({
    rostered_start: '09:00',
    rostered_end: '17:00',
    status: 'scheduled',
    apply_until: '',
    repeat_type: 'none', 
    repeat_interval: 1, 
  });

  const [clipboard, setClipboard] = useState<any>(null);
  const isManager = userRole === 'manager' || userRole === 'master' || userRole === 'admin';

  const [existingShift, setExistingShift] = useState<any>(null); 
  const [extraShifts, setExtraShifts] = useState<any[]>([]);      

  // Wrapped fetchData in useCallback to stabilize dependencies
  const fetchData = useCallback(async () => {
    if (!activeMonth) return;
    const startDate = `${activeMonth}-01`;
    const endDate = moment(`${activeMonth}-01`, 'YYYY-MM-DD').endOf('month').format('YYYY-MM-DD');
    const todayStr = moment().format('YYYY-MM-DD');

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, employment_type')
      .neq('full_name', 'Faisal Y Zenuwah');
    
    let shiftQuery = supabase
      .from('daily_shifts')
      .select('id, date, user_id, rostered_start, rostered_end, actual_start, actual_finish, hours, status, profiles:user_id(full_name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (!isManager) {
      shiftQuery = shiftQuery.eq('user_id', userId);
    }

    const { data: shiftsResult } = await shiftQuery;
    if (shiftsResult) setShifts(shiftsResult);

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
          isUnscheduled,
        };
      });
      setStaffList(updatedProfiles);
    }

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
  }, [activeMonth, isManager, userId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const daysInMonth = useMemo(() => {
    const targetMonth = activeMonth || moment().format('YYYY-MM');
    const startOfMonth = moment(`${targetMonth}-01`, 'YYYY-MM-DD');
    
    if (!startOfMonth.isValid()) return [];

    const daysInCurrentMonth = startOfMonth.daysInMonth();
    const days = [];
    let current = startOfMonth.clone();

    for (let i = 0; i < daysInCurrentMonth; i++) {
      days.push({
        dayNum: current.date(),
        dateStr: current.format('YYYY-MM-DD'),
        dayName: current.format('ddd'),
        isWeekend: current.day() === 0 || current.day() === 6,
      });
      current.add(1, 'day');
    }

    return days;
  }, [activeMonth]);

  const handlePrevMonth = () => {
    const current = activeMonth ? moment(`${activeMonth}-01`, 'YYYY-MM-DD') : moment(viewStartDate, 'YYYY-MM-DD');
    const prev = current.subtract(1, 'month').format('YYYY-MM');
    setActiveMonth(prev);
    setViewStartDate(`${prev}-01`);
  };

  const handleNextMonth = () => {
    const current = activeMonth ? moment(`${activeMonth}-01`, 'YYYY-MM-DD') : moment(viewStartDate, 'YYYY-MM-DD');
    const next = current.add(1, 'month').format('YYYY-MM');
    setActiveMonth(next);
    setViewStartDate(`${next}-01`);
  };

  const handlePrevDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = moment(viewStartDate, 'YYYY-MM-DD').subtract(1, 'day').format('YYYY-MM-DD');
    setViewStartDate(newDate);
    const newMonth = moment(newDate, 'YYYY-MM-DD').format('YYYY-MM');
    if (newMonth !== activeMonth) {
      setActiveMonth(newMonth);
    } else if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: -105, behavior: 'smooth' });
    }
  };

  const handleNextDay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newDate = moment(viewStartDate, 'YYYY-MM-DD').add(1, 'day').format('YYYY-MM-DD');
    setViewStartDate(newDate);
    const newMonth = moment(newDate, 'YYYY-MM-DD').format('YYYY-MM');
    if (newMonth !== activeMonth) {
      setActiveMonth(newMonth);
    } else if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: 105, behavior: 'smooth' });
    }
  };

  const handleCellClick = (staffMember: any, dateStr: string, existingShiftData?: any) => {
    if (!isManager) return;

    setSelectedCell({
      userId: staffMember.id,
      userName: staffMember.full_name,
      date: dateStr,
      shift: existingShiftData,
    });

    setExistingShift(existingShiftData ? { ...existingShiftData } : null);
    setExtraShifts([]);

    setEditForm({
      rostered_start: existingShiftData?.rostered_start || '09:00',
      rostered_end: existingShiftData?.rostered_end || '17:00',
      status: existingShiftData?.status === 'off' ? 'off' : 'scheduled',
      apply_until: dateStr,
      repeat_type: 'none',
      repeat_interval: 1,
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

  const handleDirectManualClock = async (staffId: string, dateStr: string, clockIn: boolean, existingShiftId?: string) => {
    const updateData = clockIn 
      ? { actual_start: moment().format('HH:mm:ss') }
      : { actual_finish: moment().format('HH:mm:ss') };

    if (existingShiftId) {
      const { error } = await supabase
        .from('daily_shifts')
        .update(updateData)
        .eq('id', existingShiftId);

      if (error) {
        setNotification(`Error updating clock state: ${error.message}`);
      } else {
        setNotification(clockIn ? 'Manually clocked in staff.' : 'Manually clocked out staff.');
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('daily_shifts')
        .insert({
          user_id: staffId,
          date: dateStr,
          status: 'scheduled',
          ...updateData
        });

      if (error) {
        setNotification(`Error creating shift for manual clock: ${error.message}`);
      } else {
        setNotification(clockIn ? 'Created shift & manually clocked in.' : 'Created shift & manually clocked out.');
        fetchData();
      }
    }
  };

  const handleSaveShiftsWithRecurrence = async () => {
    if (!selectedCell) return;
    
    // 1. Update existing shift record if present
    if (existingShift && existingShift.id) {
      const { error: updateError } = await supabase
        .from('daily_shifts')
        .update({
          rostered_start: existingShift.rostered_start,
          rostered_end: existingShift.rostered_end,
          status: existingShift.status,
        })
        .eq('id', existingShift.id);

      if (updateError) {
        setNotification(`Error updating shift: ${updateError.message}`);
        return;
      }
    }

    // 2. Insert extra shifts if added
    if (extraShifts.length > 0) {
      const extraPayloads = extraShifts.map(extra => ({
        user_id: selectedCell.userId,
        date: selectedCell.date,
        rostered_start: extra.rostered_start,
        rostered_end: extra.rostered_end,
        status: extra.status,
      }));

      const { error: insertExtraError } = await supabase
        .from('daily_shifts')
        .insert(extraPayloads);

      if (insertExtraError) {
        setNotification(`Error inserting extra shifts: ${insertExtraError.message}`);
        return;
      }
    }

    // 3. Handle Recurrence Payloads (Runs if repeat type is chosen or apply_until is set past current date)
    if (editForm.repeat_type !== 'none' || (editForm.apply_until && editForm.apply_until > selectedCell.date)) {
      const payloads = [];
      let currentDate = moment(selectedCell.date).add(1, 'days'); // Start recurring from next day
      const endDate = editForm.apply_until ? moment(editForm.apply_until) : currentDate;

      while (currentDate.isSameOrBefore(endDate)) {
        payloads.push({
          user_id: selectedCell.userId,
          date: currentDate.format('YYYY-MM-DD'),
          rostered_start: editForm.rostered_start,
          rostered_end: editForm.rostered_end,
          status: editForm.status,
        });

        if (editForm.repeat_type === 'daily') {
          currentDate.add(Number(editForm.repeat_interval) || 1, 'days');
        } else if (editForm.repeat_type === 'weekly') {
          currentDate.add(Number(editForm.repeat_interval) || 1, 'weeks');
        } else if (editForm.repeat_type === 'fortnightly') {
          currentDate.add(2, 'weeks');
        } else if (editForm.repeat_type === 'monthly') {
          currentDate.add(1, 'months');
        } else {
          break; 
        }
      }

      if (payloads.length > 0) {
        const { error } = await supabase
          .from('daily_shifts')
          .insert(payloads);

        if (error) {
          setNotification(`Error saving recurring shifts: ${error.message}`);
          return;
        }
      }
    } else if (!existingShift && extraShifts.length === 0) {
      // Standard single insert if no existing shift was edited and no recurrence is set
      const { error } = await supabase
        .from('daily_shifts')
        .insert({
          user_id: selectedCell.userId,
          date: selectedCell.date,
          rostered_start: editForm.rostered_start,
          rostered_end: editForm.rostered_end,
          status: editForm.status,
        });

      if (error) {
        setNotification(`Error saving shift: ${error.message}`);
        return;
      }
    }

    fetchData();
    setSelectedCell(null);
    setExistingShift(null);
    setExtraShifts([]);
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
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Roster Month:</label>
          <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 transition-colors border-r border-slate-200 font-bold cursor-pointer"
              title="Previous Month"
            >
              ‹
            </button>
            <input
              type="month"
              value={activeMonth || ''}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50 text-slate-800 text-sm font-semibold focus:outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={handleNextMonth}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 transition-colors border-l border-slate-200 font-bold cursor-pointer"
              title="Next Month"
            >
              ›
            </button>
          </div>
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

      {/* Matrix View Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto scroll-smooth">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-200">
                <th className="px-4 py-3 text-left font-bold text-xs uppercase tracking-wider text-white bg-slate-900 sticky left-0 z-10">
                  <div className="flex items-center justify-between">
                    <span>Staff Member</span>
                    <div className="flex items-center gap-1 pr-2 text-lg">
                      <button type="button" onClick={handlePrevDay} className="px-2 py-0.5 hover:bg-slate-700 rounded transition-colors cursor-pointer select-none" title="Previous Day">‹</button>
                      <button type="button" onClick={handleNextDay} className="px-2 py-0.5 hover:bg-slate-700 rounded transition-colors cursor-pointer select-none" title="Next Day">›</button>
                    </div>
                  </div>
                </th>
                {daysInMonth.map(day => (
                  <th key={day.dateStr} className={`p-2.5 text-center min-w-26.25 border-l border-slate-700 ${day.isWeekend ? 'bg-slate-800 text-amber-300' : ''}`}>
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
  const currentShift = shifts.find(
    s => s.user_id === staff.id && moment(s.date).format('YYYY-MM-DD') === day.dateStr
  );
  const leave = leaveData.find(
    l => l.user_id === staff.id && day.dateStr >= l.start_date && day.dateStr <= l.end_date
  );
  const isOff = !currentShift || currentShift.status === 'off' || !currentShift.rostered_start;

  return (
    <td 
      key={day.dateStr} 
      onClick={() => handleCellClick(staff, day.dateStr, currentShift)}
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
        <div className="flex flex-col items-center gap-1">
          <span className="inline-block px-2 py-1 text-[10px] font-bold text-slate-400 bg-slate-100 rounded">
            OFF
          </span>
          {isManager && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDirectManualClock(staff.id, day.dateStr, true, currentShift?.id);
              }}
              className="text-[9px] text-indigo-600 hover:underline font-semibold"
            >
              + Clock In
            </button>
          )}
        </div>
      ) : (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-1.5 text-[11px] shadow-2xs space-y-1">
          <div className="font-bold text-indigo-950 leading-tight">
            {currentShift.rostered_start} - {currentShift.rostered_end}
          </div>
          <div className="text-[10px] text-indigo-600 font-semibold">
            {currentShift.hours ? `${currentShift.hours}h` : ''}
          </div>
          
          {/* Manager Quick Action Clock In/Out Buttons next to shift info */}
          {isManager && (
            <div className="pt-1 border-t border-indigo-100 flex justify-center gap-1.5 text-[9px]" onClick={(e) => e.stopPropagation()}>
              {!currentShift.actual_start || currentShift.actual_finish ? (
                <button
                  type="button"
                  onClick={() => handleDirectManualClock(staff.id, day.dateStr, true, currentShift?.id)}
                  className="px-1.5 py-0.5 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700"
                  title="Manual Clock In"
                >
                  In
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDirectManualClock(staff.id, day.dateStr, false, currentShift?.id)}
                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700"
                  title="Manual Clock Out"
                >
                  Out
                </button>
              )}
            </div>
          )}
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

              {existingShift && (
                <div className="p-3 border rounded-lg bg-slate-50 mb-3 space-y-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Existing Shift</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={existingShift.rostered_start || ''}
                        onChange={(e) => setExistingShift({ ...existingShift, rostered_start: e.target.value })}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={existingShift.rostered_end || ''}
                        onChange={(e) => setExistingShift({ ...existingShift, rostered_end: e.target.value })}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {extraShifts.map((extra, index) => (
                <div key={index} className="p-3 border border-emerald-200 rounded-lg bg-emerald-50/50 mb-3 relative space-y-3">
                  <span className="text-xs font-semibold text-emerald-600 uppercase">Extra Shift #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...extraShifts];
                      updated.splice(index, 1);
                      setExtraShifts(updated);
                    }}
                    className="absolute top-2 right-2 text-red-500 text-xs font-bold hover:underline"
                  >
                    Remove
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-emerald-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={extra.rostered_start}
                        onChange={(e) => {
                          const updated = [...extraShifts];
                          updated[index].rostered_start = e.target.value;
                          setExtraShifts(updated);
                        }}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-emerald-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={extra.rostered_end}
                        onChange={(e) => {
                          const updated = [...extraShifts];
                          updated[index].rostered_end = e.target.value;
                          setExtraShifts(updated);
                        }}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {editForm.status === 'scheduled' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Repeat Frequency</label>
                    <select
                      value={editForm.repeat_type}
                      onChange={(e) => setEditForm({ ...editForm, repeat_type: e.target.value })}
                      className="w-full border rounded-lg p-2 text-sm bg-white"
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Custom Days (X days)</option>
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {editForm.repeat_type === 'daily' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Every X Days</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.repeat_interval}
                        onChange={(e) => setEditForm({ ...editForm, repeat_interval: Number(e.target.value) })}
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Apply Until (Date Range)</label>
              <input
                type="date"
                value={editForm.apply_until}
                onChange={(e) => setEditForm({ ...editForm, apply_until: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm bg-white cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-2 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium transition-colors shadow-sm border border-slate-200"
                >
                  Copy
                </button>
                {clipboard && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    Paste
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setExtraShifts([
                      ...extraShifts,
                      {
                        rostered_start: '09:00',
                        rostered_end: '17:00',
                        status: 'scheduled',
                      }
                    ]);
                  }}
                  className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                >
                  + Add Extra Shift
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCell(null);
                    setExistingShift(null);
                    setExtraShifts([]);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveShiftsWithRecurrence}
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