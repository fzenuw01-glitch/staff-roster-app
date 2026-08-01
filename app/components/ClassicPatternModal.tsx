'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'

interface StaffMember {
  id: string;
  full_name: string;
}

interface ClassicPatternModalProps {
  staffList: StaffMember[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClassicPatternModal({ staffList, isOpen, onClose, onSuccess }: ClassicPatternModalProps) {
  const supabase = createClient();
  const [classicStaffId, setClassicStaffId] = useState('');
  const [classicStartDate, setClassicStartDate] = useState('');
  const [classicEndDate, setClassicEndDate] = useState('');
  
  const [daySchedules, setDaySchedules] = useState<{ [key: string]: { timeIn: string; timeOut: string; enabled: boolean } }>({
    Monday: { timeIn: '19:00', timeOut: '07:00', enabled: true },
    Tuesday: { timeIn: '19:00', timeOut: '07:00', enabled: true },
    Wednesday: { timeIn: '22:00', timeOut: '07:00', enabled: true },
    Thursday: { timeIn: '22:00', timeOut: '07:00', enabled: true },
    Friday: { timeIn: '22:00', timeOut: '07:00', enabled: true },
    Saturday: { timeIn: '22:00', timeOut: '07:00', enabled: true },
    Sunday: { timeIn: '19:00', timeOut: '07:00', enabled: true },
  });
  
  const [classicLoading, setClassicLoading] = useState(false);

  if (!isOpen) return null;

  const handleDayChange = (day: string, field: 'timeIn' | 'timeOut' | 'enabled', value: any) => {
    setDaySchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleGenerateClassic = async () => {
    if (!classicStaffId || !classicStartDate || !classicEndDate) {
      alert('Please select a staff member and date range.');
      return;
    }

    setClassicLoading(true);
    try {
      await supabase
        .from('daily_shifts')
        .delete()
        .eq('user_id', classicStaffId)
        .gte('date', classicStartDate)
        .lte('date', classicEndDate)
        .eq('is_manual', false);

      const start = new Date(`${classicStartDate}T00:00:00`);
      const end = new Date(`${classicEndDate}T00:00:00`);
      const shiftsToInsert = [];

      let curr = new Date(start);
      while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayName = curr.toLocaleDateString('en-US', { weekday: 'long' });
        const schedule = daySchedules[dayName];

        if (schedule && schedule.enabled && schedule.timeIn && schedule.timeIn.toUpperCase() !== 'OFF') {
          shiftsToInsert.push({
            user_id: classicStaffId,
            date: dateStr,
            rostered_start: schedule.timeIn,
            rostered_end: schedule.timeOut,
            status: 'scheduled',
            is_manual: false
          });
        } else {
          shiftsToInsert.push({
            user_id: classicStaffId,
            date: dateStr,
            rostered_start: null,
            rostered_end: null,
            status: 'off',
            is_manual: false
          });
        }

        curr.setDate(curr.getDate() + 1);
      }

      const { error: insertError } = await supabase
        .from('daily_shifts')
        .insert(shiftsToInsert);

      if (insertError) throw insertError;

      alert('Classic weekly pattern applied successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Error generating pattern: ${err.message}`);
    } finally {
      setClassicLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white p-6 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 space-y-4 my-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Classic Pattern Generator</h3>
          <p className="text-xs text-slate-500 mt-1">Configure weekly recurring shift templates day-by-day.</p>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Staff Member</label>
            <select
              value={classicStaffId}
              onChange={(e) => setClassicStaffId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">-- Choose Staff Member --</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={classicStartDate}
                onChange={(e) => setClassicStartDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
              <input
                type="date"
                value={classicEndDate}
                onChange={(e) => setClassicEndDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Weekly Schedule Template</h4>
            {Object.keys(daySchedules).map((day) => (
              <div key={day} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2 w-28">
                  <input
                    type="checkbox"
                    checked={daySchedules[day].enabled}
                    onChange={(e) => handleDayChange(day, 'enabled', e.target.checked)}
                    className="w-4 h-4 text-slate-700 rounded border-slate-300"
                  />
                  <span className="font-bold text-slate-800">{day}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input
                    type="text"
                    value={daySchedules[day].timeIn}
                    onChange={(e) => handleDayChange(day, 'timeIn', e.target.value)}
                    disabled={!daySchedules[day].enabled}
                    placeholder="19:00 or OFF"
                    className="w-24 p-1.5 border border-slate-200 rounded uppercase text-center disabled:bg-slate-100"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="text"
                    value={daySchedules[day].timeOut}
                    onChange={(e) => handleDayChange(day, 'timeOut', e.target.value)}
                    disabled={!daySchedules[day].enabled}
                    placeholder="07:00"
                    className="w-24 p-1.5 border border-slate-200 rounded uppercase text-center disabled:bg-slate-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 p-2.5 font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateClassic}
            disabled={classicLoading}
            className="flex-1 p-2.5 font-bold bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 transition shadow-sm text-sm cursor-pointer"
          >
            {classicLoading ? 'Applying...' : 'Apply Weekly Template'}
          </button>
        </div>
      </div>
    </div>
  );
}