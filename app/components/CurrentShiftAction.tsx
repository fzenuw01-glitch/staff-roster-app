// components/CurrentShiftAction.tsx
import { useState, useEffect } from 'react';
import ClockInButton from './ClockInButton';
import { createBrowserClient } from '@supabase/ssr';

type Shift = {
  id: string;
  rostered_start: string;
  actual_start: string | null;
  date?: string;
  user_id?: string;
};

export default function CurrentShiftAction({ userId, userRole }: { userId: string; userRole: string }) {
  const [shift, setShift] = useState<Shift | null>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchTodayShift = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all shifts for today without single/maybeSingle constraints
      const { data, error } = await supabase
        .from('daily_shifts')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today);

      if (error) {
        console.error("Shift fetch error:", error);
        return;
      }
      
      // Find the first shift that hasn't been clocked into yet, or fallback to the first entry
      const activeShift = data?.find((s: Shift) => !s.actual_start) || data?.[0] || null;
      
      setShift(activeShift);
    };

    fetchTodayShift();
  }, [userId]);

  if (!shift || shift.actual_start) return null; // Don't show if no shift or already clocked in

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg my-4">
      <h3 className="font-bold">Shift Today: {shift.rostered_start}</h3>
      <p>Please clock in to begin your shift at Pay and Sleep.</p>
      <ClockInButton 
        shiftId={shift.id} 
        userRole={userRole} 
        rosteredStart={shift.rostered_start} 
      />
    </div>
  );
}