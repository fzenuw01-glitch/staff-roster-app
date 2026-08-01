'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'

interface StaffMember {
  id: string;
  full_name: string;
}

interface ShiftGeneratorModalProps {
  staffList: StaffMember[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ShiftBlock {
  timeIn: string;
  timeOut: string;
}

interface PatternStep {
  dayIndex: number;
  shifts: ShiftBlock[]; // Allows multiple shift blocks per day
}

export default function ShiftGeneratorModal({ staffList, isOpen, onClose, onSuccess }: ShiftGeneratorModalProps) {
  const supabase = createClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pattern configuration state
  const [patternType, setPatternType] = useState<'standard_weekly' | 'multi_day_sequence' | 'saturday_override'>('multi_day_sequence');
  const [anchorDate, setAnchorDate] = useState<string>('2025-11-01');
  const [clearingRedundant, setClearingRedundant] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  // Multi-day pattern sequence state supporting multiple shifts per day
  const [patternSteps, setPatternSteps] = useState<PatternStep[]>([
    { dayIndex: 0, shifts: [{ timeIn: '19:00', timeOut: '07:00' }] },
    { dayIndex: 1, shifts: [{ timeIn: 'OFF', timeOut: 'OFF' }] },
  ]);

  const [standardTimeIn, setStandardTimeIn] = useState<string>('07:00');
  const [standardTimeOut, setStandardTimeOut] = useState<string>('19:00');

  if (!isOpen) return null;

  const handleAddDayStep = () => {
    setPatternSteps([
      ...patternSteps,
      { dayIndex: patternSteps.length, shifts: [{ timeIn: '07:00', timeOut: '15:00' }] }
    ]);
  };

  const handleRemoveDayStep = (index: number) => {
    const updated = patternSteps.filter((_, i) => i !== index);
    const reindexed = updated.map((step, idx) => ({ ...step, dayIndex: idx }));
    setPatternSteps(reindexed);
  };

  const handleAddShiftBlock = (dayIndex: number) => {
    const updated = [...patternSteps];
    updated[dayIndex].shifts.push({ timeIn: '08:00', timeOut: '17:00' });
    setPatternSteps(updated);
  };

  const handleRemoveShiftBlock = (dayIndex: number, shiftIndex: number) => {
    const updated = [...patternSteps];
    updated[dayIndex].shifts = updated[dayIndex].shifts.filter((_, i) => i !== shiftIndex);
    // If all shifts are removed, default it back to an OFF block
    if (updated[dayIndex].shifts.length === 0) {
      updated[dayIndex].shifts = [{ timeIn: 'OFF', timeOut: 'OFF' }];
    }
    setPatternSteps(updated);
  };

  const handleShiftBlockChange = (dayIndex: number, shiftIndex: number, field: 'timeIn' | 'timeOut', value: string) => {
    const updated = [...patternSteps];
    updated[dayIndex].shifts[shiftIndex][field] = value;
    setPatternSteps(updated);
  };

  const handleGenerate = async () => {
    if (!selectedStaffId || !startDate || !endDate) {
      alert('Please select a staff member and a valid date range.');
      return;
    }

    setLoading(true);
    try {
      if (clearingRedundant) {
        const { error: deleteError } = await supabase
          .from('daily_shifts')
          .delete()
          .eq('user_id', selectedStaffId)
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('is_manual', false);

        if (deleteError) throw deleteError;
      }

      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      const anchor = new Date(`${anchorDate}T00:00:00`);
      const shiftsToInsert = [];

      let curr = new Date(start);
      while (curr <= end) {
        const dateStr = curr.toISOString().split('T')[0];
        const dayName = curr.toLocaleDateString('en-US', { weekday: 'long' });

        if (patternType === 'multi_day_sequence') {
          const diffTime = curr.getTime() - anchor.getTime();
          const cycleLength = patternSteps.length;
          let cycleDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) % cycleLength;
          if (cycleDay < 0) cycleDay += cycleLength;

          const matchedStep = patternSteps.find(s => s.dayIndex === cycleDay);
          if (matchedStep) {
            // Check if the day is marked fully OFF
            const isDayOff = matchedStep.shifts.length === 1 && 
              (matchedStep.shifts[0].timeIn.toUpperCase() === 'OFF' || matchedStep.shifts[0].timeIn === '');

            if (isDayOff) {
              shiftsToInsert.push({
                user_id: selectedStaffId,
                date: dateStr,
                rostered_start: null,
                rostered_end: null,
                status: 'off',
                is_manual: false
              });
            } else {
              // Insert each shift block for this day
              for (const shift of matchedStep.shifts) {
                shiftsToInsert.push({
                  user_id: selectedStaffId,
                  date: dateStr,
                  rostered_start: shift.timeIn,
                  rostered_end: shift.timeOut,
                  status: 'scheduled',
                  is_manual: false
                });
              }
            }
          }
        } else if (patternType === 'saturday_override' && dayName === 'Saturday') {
          shiftsToInsert.push({
            user_id: selectedStaffId,
            date: dateStr,
            rostered_start: '07:00',
            rostered_end: '13:00',
            status: 'scheduled',
            is_manual: false
          });
        } else {
          // Standard fixed repeat fallback
          shiftsToInsert.push({
            user_id: selectedStaffId,
            date: dateStr,
            rostered_start: standardTimeIn,
            rostered_end: standardTimeOut,
            status: 'scheduled',
            is_manual: false
          });
        }

        curr.setDate(curr.getDate() + 1);
      }

      const { error: insertError } = await supabase
        .from('daily_shifts')
        .insert(shiftsToInsert);

      if (insertError) throw insertError;

      alert('Shift pattern with multiple blocks projected successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Error generating shifts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white p-6 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 space-y-4 my-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Dynamic Shift Generator</h3>
          <p className="text-xs text-slate-500 mt-1">Configure multi-day cycles supporting single or multiple shift time blocks per day.</p>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Staff Member</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pattern Rule Type</label>
            <select
              value={patternType}
              onChange={(e: any) => setPatternType(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="multi_day_sequence">Custom Multi-Day Rotation (Supports multiple shifts per day)</option>
              <option value="standard_weekly">Standard Fixed Daily Repeat</option>
              <option value="saturday_override">Saturday Morning Special Override</option>
            </select>
          </div>

          {patternType === 'multi_day_sequence' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Cycle Sequence Builder</h4>
                  <p className="text-[11px] text-slate-500">Add multiple shift blocks to any cycle day if needed.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Anchor Date</label>
                  <input
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    className="p-1.5 border border-slate-200 rounded text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {patternSteps.map((step, dayIdx) => (
                  <div key={dayIdx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-xs font-bold text-indigo-600 uppercase">Cycle Day {dayIdx + 1}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddShiftBlock(dayIdx)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded transition cursor-pointer"
                        >
                          + Add Shift Block
                        </button>
                        {patternSteps.length > 1 && (
                          <button
                            onClick={() => handleRemoveDayStep(dayIdx)}
                            className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer px-1"
                            title="Remove Day"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {step.shifts.map((shift, shiftIdx) => (
                        <div key={shiftIdx} className="flex items-center gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="In (e.g. 07:00 or OFF)"
                              value={shift.timeIn}
                              onChange={(e) => handleShiftBlockChange(dayIdx, shiftIdx, 'timeIn', e.target.value)}
                              className="p-1.5 border border-slate-200 rounded text-xs bg-white uppercase"
                            />
                            <input
                              type="text"
                              placeholder="Out (e.g. 15:00 or OFF)"
                              value={shift.timeOut}
                              onChange={(e) => handleShiftBlockChange(dayIdx, shiftIdx, 'timeOut', e.target.value)}
                              className="p-1.5 border border-slate-200 rounded text-xs bg-white uppercase"
                            />
                          </div>
                          {step.shifts.length > 1 && (
                            <button
                              onClick={() => handleRemoveShiftBlock(dayIdx, shiftIdx)}
                              className="text-slate-400 hover:text-red-600 text-xs font-bold px-1 cursor-pointer"
                              title="Remove Block"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddDayStep}
                className="w-full py-2 bg-white border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                + Add Next Day in Cycle
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="clearRedundant"
              checked={clearingRedundant}
              onChange={(e) => setClearingRedundant(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="clearRedundant" className="text-xs text-slate-700 font-medium">
              Automatically clear redundant / overlapping auto-generated shifts in this range
            </label>
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
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 p-2.5 font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm text-sm cursor-pointer"
          >
            {loading ? 'Projecting...' : 'Project & Save Shifts'}
          </button>
        </div>
      </div>
    </div>
  );
}