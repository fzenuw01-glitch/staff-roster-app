"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { SHIFT_TYPES } from '@/lib/constants';

export default function RosterEditor({ userId }: { userId: string }) {
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split('T')[0]);
  const [updateScope, setUpdateScope] = useState<'single' | 'series'>('single');

  const [type, setType] = useState(SHIFT_TYPES[0].value);
  const [isPaid, setIsPaid] = useState(SHIFT_TYPES[0].defaultPaid);
  const [isAdditional, setIsAdditional] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleTypeChange = (selectedType: string) => {
    setType(selectedType);
    const typeConfig = SHIFT_TYPES.find(t => t.value === selectedType);
    if (typeConfig) {
      setIsPaid(typeConfig.defaultPaid);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    let error;

if (updateScope === 'series') {
    // Update matching shifts in series range
    const { error: updateError } = await supabase
      .from('daily_shifts')
      .update({
        status: type,
        is_paid: isPaid,
      })
      .eq('user_id', userId)
      .gte('date', shiftDate);
    error = updateError;
  } else if (isAdditional) {
    // Explicitly inserting an extra shift row for the same day
    const { error: insertError } = await supabase
      .from('daily_shifts')
      .insert({
        id: crypto.randomUUID(), // Ensures double shifts don't collide
        user_id: userId,
        date: shiftDate,
        status: type,
        is_paid: isPaid,
        is_manual: true,
      });
    error = insertError;
  } else {
    // For standard single edits without duplication, target the most recent shift 
    // or perform a clean insert/update safely without wiping co-existing double shifts.
    // If you want to overwrite a specific single shift, target by primary ID if available, 
    // otherwise fallback to inserting a clean manual entry or updating cleanly.
    const { error: insertError } = await supabase
      .from('daily_shifts')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        date: shiftDate,
        status: type,
        is_paid: isPaid,
        is_manual: true,
      });
    error = insertError;
  }

    if (error) alert("Error saving shift: " + error.message);
    else alert("Shift/Absence saved successfully!");
    setLoading(false);
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm mt-4">
      <h3 className="font-bold mb-3">Create/Modify Roster Entry</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Shift Date</label>
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Update Scope</label>
          <select
            value={updateScope}
            onChange={(e) => setUpdateScope(e.target.value as 'single' | 'series')}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800"
          >
            <option value="single">Single Date / Entry</option>
            <option value="series">Apply to Series (This date onward)</option>
          </select>
        </div>
        
        <select 
          value={type} 
          onChange={(e) => handleTypeChange(e.target.value)} 
          className="p-2 border rounded"
        >
          {SHIFT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={isPaid} 
            onChange={(e) => setIsPaid(e.target.checked)} 
          />
          Paid Entry
        </label>

        <label className="flex items-center gap-2 md:col-span-2">
          <input 
            type="checkbox" 
            checked={isAdditional} 
            onChange={(e) => setIsAdditional(e.target.checked)} 
          />
          Add as additional shift on this day
        </label>
        
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 disabled:opacity-50 md:col-span-2"
        >
          {loading ? "Saving..." : "Save Entry"}
        </button>
      </div>
    </div>
  );
}