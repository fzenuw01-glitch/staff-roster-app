'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import moment from 'moment';
import Link from 'next/link';

interface ShiftRecord {
  id: string;
  user_id: string;
  date: string;
  rostered_start: string;
  rostered_end: string;
  actual_start: string | null;
  actual_finish: string | null;
  status: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export default function TimesheetsPage() {
  const supabase = createClient();
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    moment().startOf('isoWeek').format('YYYY-MM-DD')
  );
  
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

    const { data: profileData } = await supabase.from('profiles').select('*');
    setProfiles(profileData || []);

    const { data: shiftData, error } = await supabase
      .from('daily_shifts')
      .select(`
        *,
        profiles:user_id (full_name, email)
      `)
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

  // Track daily grand totals across all staff
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
    <div className="p-6 max-w-[100rem] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-xs border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Weekly Attendance & Timesheets</h1>
          <p className="text-sm text-slate-500">Review weekly logs and track staff attendance summaries.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={handlePrevWeek} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-semibold rounded-lg text-sm transition">
            &larr; Prev Week
          </button>
          <span className="text-sm font-bold text-slate-800">
            {moment(currentWeekStart).format('DD MMM YYYY')} &mdash; {moment(currentWeekStart).add(6, 'days').format('DD MMM YYYY')}
          </span>
          <button onClick={handleNextWeek} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-semibold rounded-lg text-sm transition">
            Next Week &rarr;
          </button>
        </div>
      </div>

      {/* Back Button */}
      <div>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
      {notification && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-sm font-medium">
          {notification}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
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

                      {/* Contracted Weekly Calculation */}
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

                      {/* Daily Entry Cells */}
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

                      {/* Total Weekly Actual Hours Worked */}
                      <td className="p-3 text-center font-extrabold text-slate-900 bg-slate-50 text-sm">
                        {(totalWeeklyWorkedMinutes / 60).toFixed(2)}h
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Grand Totals Footer Row */}
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
    </div>
  );
}