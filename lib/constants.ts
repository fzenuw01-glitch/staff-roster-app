export const SHIFT_TYPES = [
  { value: 'holiday', label: 'Holiday', defaultPaid: true },
  { value: 'sickness', label: 'Sickness', defaultPaid: true },
  { value: 'training', label: 'Training', defaultPaid: true },
  { value: 'authorized_absence', label: 'Authorized Absence', defaultPaid: true },
  { value: 'unpaid_authorized_absence', label: 'Unpaid Authorized Absence', defaultPaid: false },
  { value: 'unauthorized_absence', label: 'Unauthorised Absence', defaultPaid: false },
  { value: 'compassionate_leave', label: 'Compassionate Leave', defaultPaid: true }, // Add this
  { value: 'jury_duty', label: 'Jury Duty', defaultPaid: false }, // Add this
];