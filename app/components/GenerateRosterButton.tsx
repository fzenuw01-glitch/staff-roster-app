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

      // 1. Fetch all staff directly from profiles table, excluding Faisal Y Zenuwah
      const { data: staffData, error: staffError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .neq('full_name', 'Faisal Y Zenuwah');

      if (staffError) throw staffError;

      // 2. Map directly to the format your generator expects
      const staffAssignments = (staffData ?? []).map((staff: any) => ({
        staff_id: staff.id,
        name: staff.full_name || 'Unknown Staff',
        pattern_id: 'name-based',
      }));

      console.log("Resolved staff for generation:", staffAssignments);

      if (staffAssignments.length === 0) {
        alert("Warning: No staff profiles found.");
      }

      // 3. Generate shifts (deletion of old non-manual shifts is handled inside shiftGenerator)
      const newShifts = await generateShifts(startDate, endDate, staffAssignments);

      if (newShifts.length > 0) {
        const { error: insertError } = await supabase
          .from('daily_shifts')
          .insert(newShifts);

        if (insertError) throw insertError;
      }

      alert(`Roster for ${selectedMonth} successfully generated!`);
      
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
      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm cursor-pointer"
    >
      {isGenerating ? "Generating..." : "⚡ Generate Roster"}
    </button>
  );
}