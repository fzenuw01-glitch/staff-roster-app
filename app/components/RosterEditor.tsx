"use client";

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { SHIFT_TYPES } from '@/lib/constants'; // Ensure this file exists

export default function RosterEditor({ userId }: { userId: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Initialize state based on the first item in the config
  const [type, setType] = useState(SHIFT_TYPES[0].value);
  const [isPaid, setIsPaid] = useState(SHIFT_TYPES[0].defaultPaid);
  const [isAdditional, setIsAdditional] = useState(false); // Option to add instead of overwrite
  
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Updates type and automatically switches paid status
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

    if (isAdditional) {
      // Insert a new record without conflicting or overwriting existing day entries
      const { error: insertError } = await supabase
        .from('daily_shifts')
        .insert({
          user_id: userId,
          date: date,
          status: type,
          is_paid: isPaid,
        });
      error = insertError;
    } else {
      // Overwrite/upsert based on the unique user_id and date constraint
      const { error: upsertError } = await supabase
        .from('daily_shifts')
        .upsert({
          user_id: userId,
          date: date,
          status: type,
          is_paid: isPaid,
        }, { onConflict: 'user_id,date' });
      error = upsertError;
    }

    if (error) alert("Error saving shift: " + error.message);
    else alert("Shift/Absence saved successfully!");
    setLoading(false);
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm mt-4">
      <h3 className="font-bold mb-3">Create/Modify Roster Entry</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          className="p-2 border rounded"
        />
        
        {/* Dynamic Dropdown */}
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

        <label className="flex items-center gap-2">
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