'use server';

import { createClient } from '../../../lib/supabase';

// Helper to avoid UTC offset shifts
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const calculateHours = (timeIn: string, timeOut: string): number => {
  if (!timeIn || timeIn === "OFF") return 0;

  const parseTime = (timeStr: string): number => {
    const [time, modifier] = timeStr.split(' ');
    const [hoursStr, minutesStr] = time.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours + minutes / 60;
  };

  const inHours = parseTime(timeIn);
  const outHours = parseTime(timeOut);

  return parseFloat(((outHours < inHours ? outHours + 24 : outHours) - inHours).toFixed(2));
};

const getShiftForStaffName = (
  staffName: string,
  dateObj: Date,
  anchorDateStr: string = '2025-11-01',
  ruleChangeDateStr: string = '2026-07-01'
): Array<{ timeIn: string; timeOut: string; hoursWorked: number }> => {
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const anchorDate = parseLocalDate(anchorDateStr);
  const ruleChangeDate = parseLocalDate(ruleChangeDateStr);
  const isNewRules = dateObj >= ruleChangeDate;

  const shifts: Array<{ timeIn: string; timeOut: string; hoursWorked: number }> = [];

  const diffTime = dateObj.getTime() - anchorDate.getTime();
  let cycleDay = Math.round(diffTime / (1000 * 60 * 60 * 24)) % 8;
  if (cycleDay < 0) cycleDay += 8;

  switch (staffName) {
    case "Faisal Zenuwah":
      if (dayName === "Saturday" || dayName === "Sunday") {
        shifts.push({ timeIn: "OFF", timeOut: "OFF", hoursWorked: 0 });
      } else if (dayName === "Monday" || dayName === "Tuesday") {
        shifts.push({ timeIn: "7:00 AM", timeOut: "7:00 PM", hoursWorked: calculateHours("7:00 AM", "7:00 PM") });
      } else if (dayName === "Wednesday") {
        shifts.push({ timeIn: "7:00 AM", timeOut: "2:00 PM", hoursWorked: calculateHours("7:00 AM", "2:00 PM") });
      } else if (dayName === "Thursday") {
        shifts.push({ timeIn: "10:00 AM", timeOut: "3:00 PM", hoursWorked: calculateHours("10:00 AM", "3:00 PM") });
      } else if (dayName === "Friday") {
        shifts.push({ timeIn: "7:00 AM", timeOut: "3:00 PM", hoursWorked: calculateHours("7:00 AM", "3:00 PM") });
      } else {
        shifts.push({ timeIn: "OFF", timeOut: "OFF", hoursWorked: 0 });
      }
      break;

    case "Harri Zenuwah":
      if (dayName === "Monday" || dayName === "Tuesday") {
        shifts.push({ timeIn: "OFF", timeOut: "OFF", hoursWorked: 0 });
      } else if (dayName === "Wednesday") {
        const out = isNewRules ? "10:00 PM" : "11:00 PM";
        shifts.push({ timeIn: "2:00 PM", timeOut: out, hoursWorked: calculateHours("2:00 PM", out) });
      } else if (['Thursday', 'Friday'].includes(dayName)) {
        const out = isNewRules ? "10:00 PM" : "11:00 PM";
        shifts.push({ timeIn: "3:00 PM", timeOut: out, hoursWorked: calculateHours("3:00 PM", out) });
      } else if (dayName === "Saturday") {
        const out = isNewRules ? "10:00 PM" : "7:00 PM";
        shifts.push({ timeIn: "1:00 PM", timeOut: out, hoursWorked: calculateHours("1:00 PM", out) });
      } else if (dayName === "Sunday") {
        shifts.push({ timeIn: "7:00 AM", timeOut: "7:00 PM", hoursWorked: calculateHours("7:00 AM", "7:00 PM") });
      } else {
        shifts.push({ timeIn: "OFF", timeOut: "OFF", hoursWorked: 0 });
      }
      break;

    case "Suad Bello":
      // Fixed Thursday shift (7:00 AM - 1:00 PM)
      if (dayName === "Thursday" && isNewRules) {
        shifts.push({ timeIn: "7:00 AM", timeOut: "1:00 PM", hoursWorked: calculateHours("7:00 AM", "1:00 PM") });
      }

      // Cycle night shift component
      if (cycleDay === 0 || cycleDay === 1 || cycleDay === 6 || cycleDay === 7) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
            shifts.push({ timeIn: "10:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("10:00 PM", "7:00 AM") });
          } else if (['Monday', 'Tuesday', 'Sunday'].includes(dayName)) {
            shifts.push({ timeIn: "7:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("7:00 PM", "7:00 AM") });
          }
        } else {
          if (['Monday', 'Tuesday', 'Saturday', 'Sunday'].includes(dayName)) {
            shifts.push({ timeIn: "7:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("7:00 PM", "7:00 AM") });
          } else if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) {
            shifts.push({ timeIn: "11:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("11:00 PM", "7:00 AM") });
          }
        }
      }
      break;

    case "Sumee Darai":
      // Fixed Saturday shift starting July 1, 2026
      if (dayName === "Saturday" && isNewRules) {
        shifts.push({ timeIn: "7:00 AM", timeOut: "1:00 PM", hoursWorked: calculateHours("7:00 AM", "1:00 PM") });
      }
      // Cycle night shift component
      if (cycleDay === 2) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
            shifts.push({ timeIn: "10:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("10:00 PM", "7:00 AM") });
          } else if (['Monday', 'Tuesday', 'Sunday'].includes(dayName)) {
            shifts.push({ timeIn: "7:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("7:00 PM", "7:00 AM") });
          }
        } else {
          if (['Monday', 'Tuesday', 'Saturday', 'Sunday'].includes(dayName)) {
            shifts.push({ timeIn: "7:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("7:00 PM", "7:00 AM") });
          } else if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) {
            shifts.push({ timeIn: "11:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("11:00 PM", "7:00 AM") });
          }
        }
      }
      break;

    case "Sam(Mujib)":
      if (cycleDay >= 3 && cycleDay <= 5) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
            shifts.push({ timeIn: "10:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("10:00 PM", "7:00 AM") });
          } else if (['Monday', 'Tuesday', 'Sunday'].includes(dayName)) {
            shifts.push({ timeIn: "7:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("7:00 PM", "7:00 AM") });
          }
        } else {
          if (['Monday', 'Tuesday', 'Saturday', 'Sunday'].includes(dayName)) {
            shifts.push({ timeIn: "7:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("7:00 PM", "7:00 AM") });
          } else if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) {
            shifts.push({ timeIn: "11:00 PM", timeOut: "7:00 AM", hoursWorked: calculateHours("11:00 PM", "7:00 AM") });
          }
        }
      }
      break;
  }

  // Fallback to OFF if no shifts matched
  if (shifts.length === 0) {
    shifts.push({ timeIn: "OFF", timeOut: "OFF", hoursWorked: 0 });
  }

  return shifts;
};

type StaffShiftAssignment = {
  staff_id: string;
  name: string;
  start_date?: string;
};

// 1. Generate Shifts
export const generateShifts = async (
  startDateString: string,
  endDateString: string,
  staffList: StaffShiftAssignment[]
): Promise<any[]> => {
  const supabase = createClient();

  if (!startDateString || !endDateString) {
    throw new Error("Start date and end date are required.");
  }

  let currentDate = parseLocalDate(startDateString);
  const endDate = parseLocalDate(endDateString);
  const shiftsToInsert: any[] = [];

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    for (const staff of staffList) {
      if (!staff || !staff.staff_id || !staff.name) continue;

      // Skip only the developer account profile explicitly
      if (staff.name === "Faisal Y Zenuwah") continue;

      if (staff.start_date && staff.start_date > formattedDate) continue;

      const shiftDetailsArray = getShiftForStaffName(staff.name, currentDate);

      for (const shiftDetails of shiftDetailsArray) {
        const timeIn = shiftDetails.timeIn === 'OFF' ? null : shiftDetails.timeIn;
        const timeOut = shiftDetails.timeOut === '' || shiftDetails.timeOut === 'OFF' ? null : shiftDetails.timeOut;

        const uniqueKey = `${staff.staff_id}-${formattedDate}-${timeIn ?? 'OFF'}-${timeOut ?? 'OFF'}`;

        if (!shiftsToInsert.some((existingShift) => existingShift.id === uniqueKey)) {
          shiftsToInsert.push({
            id: crypto.randomUUID(),
            user_id: staff.staff_id,
            date: formattedDate,
            rostered_start: timeIn,
            rostered_end: timeOut,
            hours: shiftDetails.hoursWorked || 0,
            is_off: shiftDetails.timeIn === 'OFF',
            is_manual: false,
          });
        }
      }
    }

    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  }

  if (shiftsToInsert.length > 0) {
    await supabase
      .from('daily_shifts')
      .delete()
      .gte('date', startDateString)
      .lte('date', endDateString)
      .eq('is_manual', false);

    const { error: insertError } = await supabase
      .from('daily_shifts')
      .insert(shiftsToInsert);

    if (insertError) throw insertError;
  }

  return shiftsToInsert;
};

// 2. Modify an Individual Shift
export const updateShift = async (shiftId: string, rosteredStart: string, rosteredEnd: string) => {
  const supabase = createClient();
  const hours = calculateHours(rosteredStart, rosteredEnd);
  
  const { error } = await supabase
    .from('daily_shifts')
    .update({
      rostered_start: rosteredStart === 'OFF' ? null : rosteredStart,
      rostered_end: rosteredEnd === 'OFF' ? null : rosteredEnd,
      hours: hours,
      is_off: rosteredStart === 'OFF',
      is_manual: true
    })
    .eq('id', shiftId);

  if (error) throw new Error(error.message);
  return { success: true };
};

// 3. Delete a Single Shift or Group Range
export const deleteShifts = async ({ shiftId, startDate, endDate }: { shiftId?: string, startDate?: string, endDate?: string }) => {
  const supabase = createClient();

  if (shiftId) {
    const { error } = await supabase.from('daily_shifts').delete().eq('id', shiftId);
    if (error) throw new Error(error.message);
  } else if (startDate && endDate) {
    const { error } = await supabase
      .from('daily_shifts')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw new Error(error.message);
  } else {
    throw new Error("Insufficient parameters provided for deletion.");
  }

  return { success: true };
};