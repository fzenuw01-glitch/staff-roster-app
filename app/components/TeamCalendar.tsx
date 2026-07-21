"use client";

import { useEffect, useState } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { createBrowserClient } from '@supabase/ssr';

const localizer = momentLocalizer(moment);

export default function TeamCalendar({ userRole, userId }: { userRole: string, userId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'swap' | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    user_id: '',
    date: '', 
    rostered_start: '09:00',
    rostered_end: '17:00',
    type: 'shift', 
    end_date: '' 
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState<Date>(new Date());
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isManager = userRole === 'manager' || userRole === 'master';

  useEffect(() => {
    fetchCalendarData();
    if (isManager) fetchStaff();
  }, [userRole, userId]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) setStaffList(data);
  };

  const fetchCalendarData = async () => {
    let combinedEvents: any[] = [];

    // 1. Fetch Shifts
    let shiftQuery = supabase.from('daily_shifts').select('*, profiles(full_name)');
    if (userRole === 'staff') shiftQuery = shiftQuery.eq('user_id', userId);
    const { data: shiftData, error: shiftError } = await shiftQuery;

    if (shiftError) console.error("Shift Fetch Error:", shiftError);

    // 2. Fetch Absences (Leaves)
    let leaveQuery = supabase.from('leave_requests').select('*, profiles(full_name)');
    if (userRole === 'staff') leaveQuery = leaveQuery.eq('user_id', userId);
    const { data: leaveData, error: leaveError } = await leaveQuery;

    if (leaveError) {
        console.error("Leave Fetch Error:", leaveError);
        // If the table doesn't exist, this will warn us in the console!
    }

    // Format Shifts
    if (shiftData) {
      const formattedShifts = shiftData
        .filter((shift: any) => shift && shift.date) 
        .map((shift: any) => ({
          id: shift.id,
          title: shift.profiles?.full_name || 'Unnamed Shift',
          start: new Date(`${shift.date}T${shift.rostered_start || '09:00:00'}`),
          end: new Date(`${shift.date}T${shift.rostered_end || '17:00:00'}`),
          user_id: shift.user_id,
          raw_date: shift.date,
          raw_start: shift.rostered_start,
          raw_end: shift.rostered_end,
          eventType: 'shift'
        }));
      combinedEvents = [...combinedEvents, ...formattedShifts];
    }

    // Format Absences
    if (leaveData) {
      const formattedLeaves = leaveData
        .filter((leave: any) => leave && leave.start_date)
        .map((leave: any) => ({
          id: leave.id,
          title: `${leave.profiles?.full_name} (${leave.leave_type === 'sick' ? '🤒 Sick' : '🌴 Holiday'})`,
          start: new Date(`${leave.start_date}T00:00:00`),
          end: new Date(`${leave.end_date}T23:59:59`),
          user_id: leave.user_id,
          raw_date: leave.start_date,
          end_date: leave.end_date,
          eventType: leave.leave_type,
          allDay: true
        }));
      combinedEvents = [...combinedEvents, ...formattedLeaves];
    }

    setEvents(combinedEvents);
  };

  // --- Handlers ---

  const handleSelectSlot = (slotInfo: any) => {
    if (!isManager) return; 
    
    const clickedDate = moment(slotInfo.start).format('YYYY-MM-DD');
    setFormData({
      user_id: staffList.length > 0 ? staffList[0].id : '',
      date: clickedDate,
      end_date: clickedDate, 
      rostered_start: '09:00',
      rostered_end: '17:00',
      type: 'shift'
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event);
    if (isManager) {
      setFormData({
        user_id: event.user_id,
        date: event.raw_date,
        end_date: event.end_date || event.raw_date,
        rostered_start: event.raw_start || '09:00',
        rostered_end: event.raw_end || '17:00',
        type: event.eventType
      });
      setModalMode('edit');
    } else {
      setModalMode(event.eventType === 'shift' ? 'swap' : null);
    }
    
    if (isManager || event.eventType === 'shift') {
        setIsModalOpen(true);
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    let dbError = null;
    
    if (formData.type === 'shift') {
      const payload = {
        user_id: formData.user_id,
        date: formData.date,
        rostered_start: formData.rostered_start,
        rostered_end: formData.rostered_end
      };
      if (modalMode === 'create') {
        const { error } = await supabase.from('daily_shifts').insert([payload]);
        dbError = error;
      } else {
        const { error } = await supabase.from('daily_shifts').update(payload).eq('id', selectedEvent.id);
        dbError = error;
      }
    } else {
      // It's Sick or Holiday
      const payload = {
        user_id: formData.user_id,
        start_date: formData.date,
        end_date: formData.end_date,
        leave_type: formData.type
      };
      
      if (modalMode === 'create') {
        const { error } = await supabase.from('leave_requests').insert([payload]);
        dbError = error;
      } else {
        const { error } = await supabase.from('leave_requests').update(payload).eq('id', selectedEvent.id);
        dbError = error;
      }
    }

    // NEW SAFETY CHECK: If Supabase throws an error, alert the user and stop!
    if (dbError) {
      alert(`Database Error: ${dbError.message}`);
      setIsProcessing(false);
      return; 
    }

    showNotification("Saved successfully!");
    await fetchCalendarData(); 
    setIsProcessing(false);
    setIsModalOpen(false);
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    setIsProcessing(true);
    
    const table = selectedEvent.eventType === 'shift' ? 'daily_shifts' : 'leave_requests';
    const { error } = await supabase.from(table).delete().eq('id', selectedEvent.id);
    
    if (error) {
      alert(`Error Deleting: ${error.message}`);
      setIsProcessing(false);
      return;
    }

    setEvents(events.filter(e => e.id !== selectedEvent.id));
    showNotification("Deleted successfully!");
    setIsProcessing(false);
    setIsModalOpen(false);
  };

  const handleRequestSwap = async () => {
    if (!selectedEvent) return;
    setIsProcessing(true);
    await supabase.from('shift_swaps').insert([
      { shift_id: selectedEvent.id, offered_by_user_id: userId, status: 'pending' }
    ]);
    showNotification("Swap request sent!");
    setIsProcessing(false);
    setIsModalOpen(false);
  };

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Color Coding
  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#4f46e5'; // Indigo default
    if (event.eventType === 'holiday') backgroundColor = '#10b981'; // Emerald Green
    if (event.eventType === 'sick') backgroundColor = '#ef4444'; // Red

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        color: 'white',
        border: 'none',
        display: 'block'
      }
    };
  };

  return (
    <>
      {notification && (
        <div className="absolute top-4 right-4 z-50 p-4 bg-slate-800 text-white rounded-lg shadow-lg font-medium">
          {notification}
        </div>
      )}
      
      <div style={{ height: 600, position: 'relative' }}>
<Calendar
  localizer={localizer}
  events={events}
  startAccessor="start"
  endAccessor="end"
  titleAccessor={(event: any) => event?.title || 'Shift'}
  views={['month', 'week', 'day']}
  view={view} // Controlled view
  date={date} // Controlled date
  onView={(newView) => setView(newView)}
  onNavigate={(newDate) => setDate(newDate)}
  defaultView="month"
  selectable={isManager} 
  onSelectSlot={handleSelectSlot}
  onSelectEvent={handleSelectEvent}
  eventPropGetter={eventStyleGetter}
        />

        {/* Dynamic Modal Overlay */}
        {isModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white p-6 rounded-xl shadow-xl w-96 border border-slate-100">
              
              <h3 className="font-bold text-lg text-slate-800 mb-4">
                {modalMode === 'create' && 'Add Calendar Entry'}
                {modalMode === 'edit' && 'Edit Entry'}
                {modalMode === 'swap' && 'Shift Options'}
              </h3>

              {isManager && (modalMode === 'create' || modalMode === 'edit') ? (
                <div className="space-y-4 mb-6">
                  
                  {modalMode === 'create' && (
                    <div className="flex gap-2 mb-4">
                      {['shift', 'holiday', 'sick'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setFormData({...formData, type})}
                          className={`flex-1 py-1.5 text-sm font-medium rounded-md capitalize ${
                            formData.type === type 
                              ? (type === 'shift' ? 'bg-indigo-100 text-indigo-700' : type === 'holiday' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Staff Member</label>
                    <select 
                      className="w-full p-2 border rounded bg-slate-50"
                      value={formData.user_id}
                      onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                    >
                      {staffList.map(staff => (
                        <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {formData.type === 'shift' ? (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                        <input type="time" className="w-full p-2 border rounded bg-slate-50"
                          value={formData.rostered_start} onChange={(e) => setFormData({...formData, rostered_start: e.target.value})} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label>
                        <input type="time" className="w-full p-2 border rounded bg-slate-50"
                          value={formData.rostered_end} onChange={(e) => setFormData({...formData, rostered_end: e.target.value})} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                        <input type="date" className="w-full p-2 border rounded bg-slate-50"
                          value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                        <input type="date" className="w-full p-2 border rounded bg-slate-50"
                          value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 mb-6 border-b pb-4">
                  {selectedEvent?.title} • {moment(selectedEvent?.start).format('MMM Do')}
                </p>
              )}

              <div className="flex flex-col gap-2">
                {isManager && (modalMode === 'create' || modalMode === 'edit') && (
                  <button onClick={handleSave} disabled={isProcessing} className="w-full py-2.5 bg-slate-800 text-white hover:bg-slate-900 font-semibold rounded-lg transition-colors">
                    {isProcessing ? 'Saving...' : 'Save Entry'}
                  </button>
                )}

                {isManager && modalMode === 'edit' && (
                  <button onClick={handleDelete} disabled={isProcessing} className="w-full py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg transition-colors">
                    {isProcessing ? 'Processing...' : 'Delete Entry'}
                  </button>
                )}
                
                {!isManager && modalMode === 'swap' && (
                  <button onClick={handleRequestSwap} disabled={isProcessing} className="w-full py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-lg transition-colors">
                    {isProcessing ? 'Sending...' : 'Request Swap'}
                  </button>
                )}
                
                <button onClick={() => setIsModalOpen(false)} disabled={isProcessing} className="w-full py-2.5 mt-2 bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}