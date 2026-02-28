export const getRelativeDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const INITIAL_DATA = {
  clinic: {
    name: 'CareOPD General Clinic',
    address: '123 Health Ave, Metro City',
    phone: '+1 555-0123',
    email: 'admin@careopd.com',
    hours: '09:00 AM - 06:00 PM'
  },
  doctors: [
    { id: 101, name: 'Dr. Sarah Smith', department: 'Cardiology', status: 'Available', photo: 'S', morningStart: '09:00', morningEnd: '13:00', eveningStart: '17:00', eveningEnd: '20:00' },
    { id: 102, name: 'Dr. James Wilson', department: 'General Practice', status: 'On Leave', photo: 'J', morningStart: '10:00', morningEnd: '13:00', eveningStart: '17:00', eveningEnd: '21:00' },
    { id: 103, name: 'Dr. Emily Chen', department: 'Pediatrics', status: 'Inactive', photo: 'E', morningStart: '09:00', morningEnd: '12:00', eveningStart: '16:00', eveningEnd: '19:00' },
    { id: 104, name: 'Dr. John Doe', department: 'Cardiology', status: 'Available', photo: 'D', morningStart: '09:00', morningEnd: '13:00', eveningStart: '17:00', eveningEnd: '21:00' },
  ],
  patients: [
    { id: 201, name: 'John Doe', age: 34, gender: 'M', phone: '555-1111', lastVisit: getRelativeDate(-15), type: 'Returning', address: '123 Main St' },
    { id: 202, name: 'Jane Roe', age: 28, gender: 'F', phone: '555-2222', lastVisit: getRelativeDate(-200), type: 'New', address: '456 Oak St' },
    { id: 203, name: 'Robert Fox', age: 45, gender: 'M', phone: '555-3333', lastVisit: getRelativeDate(-5), type: 'Returning', address: '789 Pine St' },
    { id: 204, name: 'Alice Smith', age: 30, gender: 'F', phone: '555-4444', lastVisit: '-', type: 'New', address: '101 Elm St' },
    { id: 205, name: 'Charlie Brown', age: 50, gender: 'M', phone: '555-5555', lastVisit: getRelativeDate(-45), type: 'Returning', address: '202 Cedar St' }
  ],
  appointments: [
    { id: 501, patientId: 201, doctorId: 101, time: '09:00', date: getRelativeDate(0), type: 'Checkup', status: 'Confirmed' },
    { id: 502, patientId: 202, doctorId: 102, time: '10:30', date: getRelativeDate(0), type: 'Consultation', status: 'Pending' },
    { id: 503, patientId: 203, doctorId: 101, time: '14:00', date: getRelativeDate(-1), type: 'Follow-up', status: 'Completed' },
    { id: 504, patientId: 201, doctorId: 103, time: '16:00', date: getRelativeDate(2), type: 'Checkup', status: 'Cancelled' },
    { id: 505, patientId: 201, doctorId: 104, time: '11:00', date: getRelativeDate(0), type: 'Consultation', status: 'Pending' },
    { id: 601, patientId: 203, doctorId: 101, time: '14:00', date: getRelativeDate(-1), type: 'Follow-up', status: 'Completed' },
    { id: 602, patientId: 201, doctorId: 102, time: '10:00', date: getRelativeDate(-1), type: 'Consultation', status: 'Completed' },
    { id: 603, patientId: 202, doctorId: 104, time: '09:30', date: getRelativeDate(-2), type: 'Checkup', status: 'Completed' },
    { id: 604, patientId: 203, doctorId: 101, time: '15:00', date: getRelativeDate(-3), type: 'Consultation', status: 'Completed' },
    { id: 605, patientId: 201, doctorId: 102, time: '11:15', date: getRelativeDate(-5), type: 'Checkup', status: 'Completed' },
    { id: 606, patientId: 202, doctorId: 103, time: '16:45', date: getRelativeDate(-7), type: 'Vaccination', status: 'Completed' },
    { id: 607, patientId: 203, doctorId: 101, time: '09:00', date: getRelativeDate(-10), type: 'Follow-up', status: 'Completed' },
    { id: 608, patientId: 201, doctorId: 102, time: '13:30', date: getRelativeDate(-15), type: 'Consultation', status: 'Completed' },
    { id: 609, patientId: 205, doctorId: 104, time: '10:00', date: getRelativeDate(-45), type: 'Checkup', status: 'Completed' },
    { id: 610, patientId: 203, doctorId: 101, time: '14:20', date: getRelativeDate(-40), type: 'Consultation', status: 'Completed' },
  ],
  templates: [
    { id: 1, name: 'Appointment Reminder', text: 'Hello {patient_name}, reminder for your appointment with {doctor_name} at {time}.' },
    { id: 2, name: 'Follow-up', text: 'Dear {patient_name}, please schedule your follow-up visit.' }
  ]
};