// utils/shiftGenerator.js

const ANCHOR_DATE = new Date('2025-11-01T00:00:00');
const RULE_CHANGE_DATE = new Date('2026-06-03T00:00:00');

// Helper to determine the rolling 8-day cycle position
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
    case 'pattern_fixed_a': // Originally: "Faisal Main Hours"
      if (['Monday', 'Tuesday'].includes(dayName)) { timeIn = "7:00 AM"; timeOut = "7:00 PM"; }
      else if (dayName === "Wednesday") { timeIn = "11:00 AM"; timeOut = "5:00 PM"; }
      else if (dayName === "Thursday") { timeIn = "7:00 AM"; timeOut = "5:00 PM"; }
      else if (dayName === "Friday") { timeIn = "7:00 AM"; timeOut = "11:00 AM"; }
      break;

    case 'pattern_fixed_b': // Originally: "Harri Main Hours"
      if (['Wednesday', 'Thursday'].includes(dayName)) {
        timeIn = "5:00 PM"; timeOut = isNewRules ? "10:00 PM" : "11:00 PM";
      } else if (dayName === "Friday") {
        timeIn = "11:00 AM"; timeOut = isNewRules ? "10:00 PM" : "11:00 PM";
      } else if (dayName === "Saturday") {
        timeIn = "1:00 PM"; timeOut = isNewRules ? "10:00 PM" : "7:00 PM";
      } else if (dayName === "Sunday") {
        timeIn = "7:00 AM"; timeOut = "7:00 PM";
      }
      break;

    case 'pattern_rolling_4_on_4_off': // Originally: "Suad Main Hours"
      if ([0, 1, 6, 7].includes(cycleDay)) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) { timeIn = "10:00 PM"; timeOut = "7:00 AM"; }
          else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
        } else {
          if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) { timeIn = "11:00 PM"; timeOut = "7:00 AM"; }
          else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
        }
      }
      break;

    case 'pattern_rolling_1_on_7_off': // Originally: "Sumee Night Hours"
      if (cycleDay === 2) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) { timeIn = "10:00 PM"; timeOut = "7:00 AM"; }
          else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
        } else {
          if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) { timeIn = "11:00 PM"; timeOut = "7:00 AM"; }
          else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
        }
      }
      break;

    case 'pattern_rolling_3_on_5_off': // Originally: "Sam(Mujib) Mian Hours"
      if (cycleDay >= 3 && cycleDay <= 5) {
        if (isNewRules) {
          if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) { timeIn = "10:00 PM"; timeOut = "7:00 AM"; }
          else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
        } else {
          if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) { timeIn = "11:00 PM"; timeOut = "7:00 AM"; }
          else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
        }
      }
      break;

    case 'pattern_bf_a': // Originally: "Faisal Breakfast Hours"
      if (['Tuesday', 'Thursday', 'Friday'].includes(dayName)) { timeIn = "7:00 AM"; timeOut = "1:00 PM"; }
      break;
      
    case 'pattern_bf_b': // Originally: "Sumee Sat BF Hours"
      if (dayName === "Saturday") { timeIn = "7:00 AM"; timeOut = "1:00 PM"; }
      break;
      
    case 'pattern_bf_c': // Originally: "Suad Wed BF Hours"
      if (dayName === "Wednesday") { timeIn = "7:00 AM"; timeOut = "1:00 PM"; }
      break;

    case 'pattern_bf_general': // Originally: "Breakfast"
      if (['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) { timeIn = "7:00 AM"; timeOut = "1:00 PM"; }
      break;

    case 'pattern_other_a': // Originally: "Faisal Other Hours"
      if (dayName === "Wednesday") { timeIn = "2:00 PM"; timeOut = "4:00 PM"; }
      else if (['Thursday', 'Friday'].includes(dayName)) { timeIn = "2:00 PM"; timeOut = "4:30 PM"; }
      break;

    case 'pattern_other_b': // Originally: "Harri Other Hours"
      if (['Wednesday', 'Thursday', 'Friday'].includes(dayName)) { timeIn = "9:00 PM"; timeOut = "11:00 PM"; }
      break;

    case 'pattern_night_general': // Originally: "Night Shift"
      if (isNewRules) {
        if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) { timeIn = "10:00 PM"; timeOut = "7:00 AM"; }
        else { timeIn = "7:00 PM"; timeOut = "7:00 AM"; }
      } else {
        timeIn = "7:00 PM"; timeOut = "7:00 AM";
      }
      break;
  }

  return { timeIn, timeOut, hoursWorked: calculateHours(timeIn, timeOut) };
};

type StaffShiftAssignment = {
  staff_id: string;
  pattern_id: string;
};

type ShiftRecord = {
  user_id: string;          // Changed from staff_id
  date: string;             // Changed from shift_date
  rostered_start: string | null; // Changed from time_in
  rostered_end: string | null;   // Changed from time_out
  hours_worked: number;
  is_off: boolean;
};

/**
 * Generates an array of shift objects ready for database insertion.
 */
export const generateShifts = (
  startDateString: string,
  endDateString: string,
  staffList: StaffShiftAssignment[]
): ShiftRecord[] => {
  const shiftsToInsert: ShiftRecord[] = [];
  let currentDate = new Date(`${startDateString}T00:00:00`);
  const endDate = new Date(`${endDateString}T00:00:00`);

  while (currentDate <= endDate) {
  const formattedDate = currentDate.toISOString().split('T')[0];

  staffList.forEach((staff) => {
    const shiftDetails = getShiftForPattern(staff.pattern_id, currentDate);

// Inside your generateShifts while loop:
shiftsToInsert.push({
  user_id: staff.staff_id,
  date: formattedDate,
  rostered_start: shiftDetails.timeIn === 'OFF' ? null : shiftDetails.timeIn,
  rostered_end: shiftDetails.timeOut === '' ? null : shiftDetails.timeOut,
  hours_worked: shiftDetails.hoursWorked,
  is_off: shiftDetails.timeIn === 'OFF',
});
  });

  currentDate.setDate(currentDate.getDate() + 1);
}

return shiftsToInsert;
};