const getDurationInHours = (start: string | null, end: string | null) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  return (eH * 60 + eM - (sH * 60 + sM)) / 60;
};

export const calculateDashboardStats = (
  shifts: any[], 
  leave: any[], 
  contractedHours: number, 
  viewStartDate?: Date | string, 
  viewEndDate?: Date | string
) => {
  let scheduled = 0;
  let holiday = 0;
  let sick = 0;

  // Filter shifts to only include those falling within the current calendar view bounds
  const visibleShifts = shifts.filter((shift) => {
    if (!viewStartDate || !viewEndDate) return true;
    const shiftDate = new Date(shift.date);
    return shiftDate >= new Date(viewStartDate) && shiftDate <= new Date(viewEndDate);
  });

  visibleShifts.forEach((shift) => {
    // Fallback to shift.hours if start/end aren't used for a specific entry
    const hours = getDurationInHours(shift.rostered_start, shift.rostered_end) || Number(shift.hours || 0);

    if (shift.status === 'Working') {
      scheduled += hours;
    } else if (shift.status === 'Holiday') {
      holiday += hours;
    } else if (shift.status === 'Sick') {
      sick += hours;
    }
  });

  // Calculate overtime based on scheduled work vs contracted hours
  const overtime = Math.max(0, scheduled - contractedHours);

  return {
    scheduled,
    holiday,
    sick,
    overtime,
  };
};