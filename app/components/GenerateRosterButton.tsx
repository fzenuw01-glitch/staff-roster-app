import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { generateShifts } from './utils/shiftGenerator';

interface GenerateRosterButtonProps {
  selectedMonth: string;
  onRosterGenerated: () => void;
}

export default function GenerateRosterButton({ selectedMonth, onRosterGenerated }: GenerateRosterButtonProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // 1. Fetch profiles and their assigned patterns
      const { data: staffList, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          roster_assignments (
            pattern_id
          )
        `);

      if (fetchError) throw fetchError;

      const staffAssignments = (staffList ?? []).map((staff: any) => ({
        staff_id: staff.id,
        pattern_id: staff.roster_assignments?.[0]?.pattern_id || null,
      })).filter(staff => staff.pattern_id);

      // 2. Dynamically calculate start and end dates from the selected month (YYYY-MM)
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${selectedMonth}-01`;
      // Find the last day of the selected month automatically
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      // 3. Clear any existing shifts for this specific month first
      const { error: deleteError } = await supabase
        .from('daily_shifts')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

      if (deleteError) throw deleteError;

      // 4. Generate new shifts
      const newShifts = generateShifts(startDate, endDate, staffAssignments);

      // 5. Clean up fields not in schema and add the required 'status' field
      const shiftsToInsert = newShifts.map(({ hours_worked, is_off, ...rest }) => ({
        ...rest,
        status: 'scheduled' // Satisfies the database not-null constraint
      }));

      // 6. Insert into Supabase
      const { error: insertError } = await supabase
        .from('daily_shifts') 
        .insert(shiftsToInsert);

      if (insertError) throw insertError;
      
      alert(`Roster for ${selectedMonth} successfully generated!`);
      
      // Trigger data fetch in parent dashboard instead of a full reload
      onRosterGenerated();

    } catch (error: any) {
      console.error("Failed to generate roster:", error);
      alert("Error: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button 
      onClick={handleGenerate} 
      disabled={isGenerating}
      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm"
    >
      {isGenerating ? "Generating..." : "⚡ Generate Roster"}
    </button>
  );
}