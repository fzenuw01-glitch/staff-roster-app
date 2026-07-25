import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { generateShifts } from './utils/shiftGenerator';
import { useRouter } from 'next/navigation';

interface GenerateRosterButtonProps {
  selectedMonth: string;
  onRosterGenerated: () => void;
}

export default function GenerateRosterButton({ selectedMonth, onRosterGenerated }: GenerateRosterButtonProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

      // 1. Fetch profiles and assigned patterns
      const { data: staffList, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          roster_assignments (
            pattern_id
          )
        `);

      if (fetchError) throw fetchError;

// 2. Fetch staff roster assignments active for or up to this month's start date
const { data: staffAssignmentsData, error: staffError } = await supabase
  .from('roster_assignments')
  .select('user_id, pattern_id, start_date')
  .lte('start_date', endDate); // gets assignments starting on or before the end of this month

if (staffError) throw staffError;

// If a user has multiple, sort/filter to grab the latest applicable start_date for the month
const assignmentMap = new Map();
(staffAssignmentsData ?? []).forEach((assignment: any) => {
  // Keep the most recent start_date that is <= endDate for each user
  if (assignment.pattern_id && assignment.start_date <= endDate) {
    // If multiple exist, you can prioritize the one closest to startDate or latest start_date <= startDate
    assignmentMap.set(assignment.user_id, assignment.pattern_id);
  }
});

const staffAssignments = Array.from(assignmentMap.entries()).map(([user_id, pattern_id]) => ({
  staff_id: user_id,
  pattern_id,
}));

      // 3. Clear existing shifts for this date window
      const { error: deleteError } = await supabase
        .from('daily_shifts')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

      if (deleteError) throw deleteError;

      // 4. Generate shifts
      const newShifts = await generateShifts(startDate, endDate, staffAssignments);
      const shiftsToInsert = newShifts;

      // 5. Insert into Supabase
      const { error: insertError } = await supabase
        .from('daily_shifts')
        .insert(shiftsToInsert);

      if (insertError) throw insertError;

      alert(`Roster for ${selectedMonth} successfully generated!`);
      
      // Refresh router and trigger callback to load new shifts into view
      router.refresh();
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