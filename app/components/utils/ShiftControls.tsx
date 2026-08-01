'use client';

import { useState } from 'react';
import * as shiftGeneratorModule from './shiftGenerator';

const { generateShifts } = shiftGeneratorModule as any;
const deleteShifts = (shiftGeneratorModule as any).deleteShifts;

export default function ShiftControls({ staffList }: { staffList: any[] }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setStatusMessage(null);

    try {
      // Map staff list to match expected parameters
      const formattedStaff = staffList.map(s => ({
        staff_id: s.id,
        name: s.full_name,
        start_date: s.start_date
      }));

      const insertedShifts = await generateShifts(startDate, endDate, formattedStaff);
      setStatusMessage(`Successfully generated and saved ${insertedShifts.length} shifts!`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!startDate || !endDate) return;
    if (!confirm(`Are you sure you want to delete shifts from ${startDate} to ${endDate}?`)) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      await deleteShifts({ startDate, endDate });
      setStatusMessage(`Successfully deleted shift group between ${startDate} and ${endDate}.`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-bold text-slate-800 text-sm">Shift Pattern Controls</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
          />
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs rounded-lg font-medium">
          {statusMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          onClick={handleGenerate}
          disabled={loading || !startDate || !endDate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? 'Processing...' : 'Generate Shifts'}
        </button>

        <button
          onClick={handleDeleteGroup}
          disabled={loading || !startDate || !endDate}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? 'Processing...' : 'Delete Group Range'}
        </button>
      </div>
    </div>
  );
}