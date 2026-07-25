'use server';

import { createClient } from '../../../lib/supabase';

const supabase = createClient();
// utils/shiftGenerator.js

const ANCHOR_DATE = new Date('2025-11-01T00:00:00');
const RULE_CHANGE_DATE = new Date('2026-06-03T00:00:00');

// Helper to determine the rolling 8-day cycle position for the Night Shift
const getCycleDay = (currentDate: Date) => {
  const diffTime = currentDate.getTime() - ANCHOR_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  let cycleDay = diffDays % 8;
  if (cycleDay < 0) cycleDay += 8;
  return cycleDay;
};

// Helper to calculate decimal hours worked
const calculateHours = (timeIn: string, timeOut: string): number => {
  if (timeIn === "OFF") return 0;
  
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
  
  // Handle overnight shifts (e.g., 10:00 PM to 7:00 AM)
  if (outHours < inHours) outHours += 24;
  
  return parseFloat((outHours - inHours).toFixed(2));
};

// The core rules engine
const getShiftForPattern = (
  patternId: string,
  dateObj: Date
): { timeIn: string; timeOut: string; hoursWorked: number } => {
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const isNewRules = dateObj >= RULE_CHANGE_DATE;
  const cycleDay = getCycleDay(dateObj);

  let timeIn = "OFF";
  let timeOut = "";

  switch (patternId) {
    // 1. Faisal's Schedule (Fixed 7-day rotation)
    case 'ce34f2b4-34f1-474c-8611-5d330e77ad44': 
      if (['Monday', 'Tuesday'].includes(dayName)) { timeIn = "7:00 AM"; timeOut = "7:00 PM"; }
      else if (dayName === "Wednesday") { timeIn = "7:00 AM"; timeOut = "2:00 PM"; }
      else if (dayName === "Thursday") { timeIn = "10:00 AM"; timeOut = "3:00 PM"; }
      else if (dayName === "Friday") { timeIn = "7:00 AM"; timeOut = "3:00 PM"; }
      break;

    // 2. Harri's Schedule (Fixed 7-day rotation)
    case 'cb3d5d10-71f6-42d1-ab54-e210403d06cd':
      if (dayName === "Wednesday") { timeIn = "2:00 PM"; timeOut = "10:00 PM"; }
      else if (['Thursday', 'Friday'].includes(dayName)) { timeIn = "3:00 PM"; timeOut = "10:00 PM"; }
      else if (dayName === "Saturday") { timeIn = "1:00 PM"; timeOut = "10:00 PM"; }
      else if (dayName === "Sunday") { timeIn = "7:00 AM"; timeOut = "7:00 PM"; }
      break;
      
    // 3. Breakfast Shift (7-day rotation: Suad on Thursday, Sumee on Saturday)
    case '48d1d74c-b5ff-49f5-afad-d84348500601': 
      if (dayName === "Thursday") { timeIn = "7:00 AM"; timeOut = "1:00 PM"; } // Suad
      else if (dayName === "Saturday") { timeIn = "7:00 AM"; timeOut = "1:00 PM"; } // Sumee
      break;

    // 4. Night Shift (8-day rotation: Suad 4 days, Sam/Mujib 3 days, Sumee 1 day)
    case '4ebe77ad-8648-4ef3-aa2d-a57bb504': 
      // Suad (4 days), Sam/Mujib (3 days), Sumee (1 day) mapped across the 8-day cycle index
      // Adjust cycleDay check depending on which specific staff member is assigned this pattern UUID, 
      // or evaluate standard Night Shift hours matching your rule:
      if (['Sunday', 'Monday', 'Tuesday'].includes(dayName)) {
        timeIn = "7:00 PM"; timeOut = "7:00 AM";
      } else if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) {
        timeIn = "10:00 PM"; timeOut = "7:00 AM"; // Post-rule change time
      }
      break;

    // Fallbacks or Support Shifts
    case '72a9176c-e470-43ab-b470-3c4065fc34be': // Support Shift
    case 'c41cbcce-b9c9-4444-820c-bf5730560a61': // Standard 4-4
      // Add custom logic or leave OFF if handled elsewhere
      break;
  }

  return { timeIn, timeOut, hoursWorked: calculateHours(timeIn, timeOut) };
};

type StaffShiftAssignment = {
  staff_id: string;
  pattern_id: string;
};

type ShiftRecord = {
  user_id: string;           
  date: string;              
  rostered_start: string | null; 
  rostered_end: string | null;   
  hours: number;
  is_off: boolean;
};

/**
 * Generates an array of shift objects ready for database insertion.
 */
export const generateShifts = async (
  startDateString: string,
  endDateString: string,
  staffList: StaffShiftAssignment[]
): Promise<ShiftRecord[]> => {
  if (!startDateString || !endDateString) {
    throw new Error("Start date and end date are required.");
  }

  const shiftsToInsert: any[] = [];
  let currentDate = new Date(`${startDateString}T00:00:00`);
  const endDate = new Date(`${endDateString}T00:00:00`);

  while (currentDate <= endDate) {
    const formattedDate = currentDate.toISOString().split('T')[0];

    if (formattedDate) {
      staffList.forEach((staff) => {
        if (staff && staff.staff_id) {
          const shiftDetails = getShiftForPattern(staff.pattern_id, currentDate);

          shiftsToInsert.push({
            user_id: staff.staff_id,
            date: formattedDate,
            rostered_start: shiftDetails.timeIn === 'OFF' ? null : shiftDetails.timeIn,
            rostered_end: shiftDetails.timeOut === '' ? null : shiftDetails.timeOut,
            hours: shiftDetails.hoursWorked || 0,
            is_off: shiftDetails.timeIn === 'OFF',
          });
        }
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const uniqueMap = new Map<string, any>();
  for (const shift of shiftsToInsert) {
    const compositeKey = `${shift.user_id}-${shift.date}-${shift.rostered_start || 'none'}-${shift.rostered_end || 'none'}`;
    uniqueMap.set(compositeKey, shift);
  }
  const uniquePayload = Array.from(uniqueMap.values());

  return uniquePayload as ShiftRecord[];
};