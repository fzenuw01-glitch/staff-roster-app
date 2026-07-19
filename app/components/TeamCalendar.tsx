"use client";

import { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { createBrowserClient } from '@supabase/ssr';

const localizer = momentLocalizer(moment);

export default function TeamCalendar({ userRole, userId }: { userRole: string, userId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchShifts();
  }, [userRole, userId]);

  const fetchShifts = async () => {
    let query = supabase.from('daily_shifts').select('*, profiles(full_name)');
    if (userRole === 'staff') query = query.eq('user_id', userId);
    const { data } = await query;
    if (data) {
      const formattedEvents = data.map((shift: any) => ({
        id: shift.id,
        title: shift.profiles?.full_name || 'Shift',
        start: new Date(`${shift.date}T${shift.rostered_start || '09:00:00'}`),
        end: new Date(`${shift.date}T${shift.rostered_end || '17:00:00'}`),
        user_id: shift.user_id
      }));
      setEvents(formattedEvents);
    }
  };

  const [notification, setNotification] = useState<string | null>(null);

const handleRequestSwap = async () => {
    if (!selectedEvent) return;
    
    await supabase.from('shift_swaps').insert([
      { shift_id: selectedEvent.id, offered_by_user_id: userId, status: 'pending' }
    ]);
    
    // Show notification
    setNotification("Swap request sent to manager!");
    setTimeout(() => setNotification(null), 3000); // Hide after 3 seconds
    
    setIsModalOpen(false);
};

  return (
    <>
      {notification && (
        <div className="absolute top-4 right-4 z-50 p-4 bg-green-500 text-white rounded shadow-lg">
          {notification}
        </div>
      )}
      <div style={{ height: 600, position: 'relative' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={['month', 'week', 'day']}
          defaultView="month"
          onSelectEvent={(event) => {
            setSelectedEvent(event);
            setIsModalOpen(true);
          }}
        />

        {/* Simple Modal Overlay */}
        {isModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-80">
              <h3 className="font-bold text-lg mb-4">Request Swap?</h3>
              <p className="mb-4 text-sm text-gray-600">
                Would you like to request a swap for this shift?
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                <button onClick={handleRequestSwap} className="px-4 py-2 bg-blue-600 text-white rounded">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}