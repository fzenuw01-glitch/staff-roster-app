'use server';

import { createClient } from '../../../lib/supabase';

const supabase = createClient();

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

  let inHours = parseTime(timeIn);
  let outHours = parseTime(timeOut);
  if (outHours < inHours) outHours += 24;
  
  return parseFloat((outHours - inHours).toFixed(2));
};

const getShiftForStaffName = (
  staffName: string,
  dateObj: Date,
  anchorDateStr: string = '2025-11-01',
  ruleChangeDateStr: string = '2026-07-01'
): { timeIn: string; timeOut: string; hoursWorked: number } => {
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const anchorDate = new Date(`${anchorDateStr}T00:00:00`);
  const ruleChangeDate = new Date(`${ruleChangeDateStr}T00:00:00`);
  const isNewRules = dateObj >= ruleChangeDate;

  let timeIn = "OFF";
  let timeOut = "";

  // Calculate 8-day cycle offset where applicable
  const diffTime = dateObj.getTime() - anchorDate.getTime();
  let cycleDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) % 8;
  if (cycleDay < 0) cycleDay += 8;

  switch (staffName) {
    case "Faisal Zenuwah":
      if (dayName === "Saturday" || dayName === "Sunday") {
        timeIn = "OFF";
        timeOut = "OFF";
      } else if (dayName === "Monday" || dayName === "Tuesday") {
        timeIn = "7:00 AM";
        timeOut = "7:00 PM";
      } else if (dayName === "Wednesday") {
        timeIn = "7:00 AM";
        timeOut = "2:00 PM";
      } else if (dayName === "Thursday") {
        timeIn = "10:00 AM";
        timeOut = "3:00 PM";
      } else if (dayName === "Friday") {
        timeIn = "7:00 AM";
        timeOut = "3:00 PM";
      }
      break;

    case "Harri Zenuwah":
      if (dayName === "Wednesday") {
        timeIn = "2:00 PM";
        timeOut = isNewRules ? "10:00 PM" : "11:00 PM";
      } else if (['Thursday', 'Friday'].includes(dayName)) {
        timeIn = "3:00 PM";
        timeOut = isNewRules ? "10:00 PM" : "11:00 PM";
      } else if (dayName === "Saturday") {
        timeIn = "1:00 PM";
        timeOut = isNewRules ? "10:00 PM" : "7:00 PM";
      } else if (dayName === "Sunday") {
        timeIn = "7:00 AM";
        timeOut = "7:00 PM";
      }
      break;

    case "Suad Bello": // 8-Day Cycle (4 ON / 4 OFF)
      if (cycleDay === 0 || cycleDay === 1 || cycleDay === 6 || cycleDay === 7) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
            timeIn = "10:00 PM"; timeOut = "7:00 AM";
          } else if (['Monday', 'Tuesday', 'Sunday'].includes(dayName)) {
            timeIn = "7:00 PM"; timeOut = "7:00 AM";
          }
        } else {
          if (['Monday', 'Tuesday', 'Saturday', 'Sunday'].includes(dayName)) {
            timeIn = "7:00 PM"; timeOut = "7:00 AM";
          } else if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) {
            timeIn = "11:00 PM"; timeOut = "7:00 AM";
          }
        }
      }
      break;

    case "Sumee Darai": // 8-Day Cycle (1 ON / 7 OFF)
      if (cycleDay === 2) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
            timeIn = "10:00 PM"; timeOut = "7:00 AM";
          } else if (['Monday', 'Tuesday', 'Sunday'].includes(dayName)) {
            timeIn = "7:00 PM"; timeOut = "7:00 AM";
          }
        } else {
          if (['Monday', 'Tuesday', 'Saturday', 'Sunday'].includes(dayName)) {
            timeIn = "7:00 PM"; timeOut = "7:00 AM";
          } else if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) {
            timeIn = "11:00 PM"; timeOut = "7:00 AM";
          }
        }
      }
      break;

    case "Sam(Mujib)": // 8-Day Cycle (3 ON / 5 OFF)
      if (cycleDay >= 3 && cycleDay <= 5) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
            timeIn = "10:00 PM"; timeOut = "7:00 AM";
          } else if (['Monday', 'Tuesday', 'Sunday'].includes(dayName)) {
            timeIn = "7:00 PM"; timeOut = "7:00 AM";
          }
        } else {
          if (['Monday', 'Tuesday', 'Saturday', 'Sunday'].includes(dayName)) {
            timeIn = "7:00 PM"; timeOut = "7:00 AM";
          } else if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) {
            timeIn = "11:00 PM"; timeOut = "7:00 AM";
          }
        }
      }
      break;
  }

  return { timeIn, timeOut, hoursWorked: calculateHours(timeIn, timeOut) };
};

type StaffShiftAssignment = {
  staff_id: string;
  name: string;
  start_date?: string;
};

export const generateShifts = async (
  startDateString: string,
  endDateString: string,
  staffList: StaffShiftAssignment[]
): Promise<any[]> => {
  if (!startDateString || !endDateString) {
    throw new Error("Start date and end date are required.");
  }

  let currentDate = new Date(`${startDateString}T00:00:00`);
  const endDate = new Date(`${endDateString}T00:00:00`);

  const shiftsToInsert = [];

  while (currentDate <= endDate) {
    const formattedDate = currentDate.toISOString().split('T')[0];

    for (const staff of staffList) {
      if (!staff || !staff.staff_id || !staff.name) continue;
      // Skip generation for Faisal Y Zenuwah if any legacy references remain
      if (staff.name === "Faisal Y Zenuwah") continue;
      if (staff.start_date && staff.start_date > formattedDate) continue;

      const shiftDetails = getShiftForStaffName(staff.name, currentDate);

      shiftsToInsert.push({
        user_id: staff.staff_id,
        date: formattedDate,
        rostered_start: shiftDetails.timeIn === 'OFF' ? null : shiftDetails.timeIn,
        rostered_end: shiftDetails.timeOut === '' ? null : shiftDetails.timeOut,
        hours: shiftDetails.hoursWorked || 0,
        is_off: shiftDetails.timeIn === 'OFF',
        is_manual: false,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Clear only non-manual shifts for this date range before inserting fresh ones
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