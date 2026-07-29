'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function LeaveRequestForm({ userId, onRequestSubmitted }: { userId: string; onRequestSubmitted: () => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setMessage('Please select both start and end dates.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.from('leave_requests').insert({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'pending',
    });

    setLoading(false);

    if (error) {
      setMessage(`Error submitting request: ${error.message}`);
    } else {
      setMessage('Leave request submitted successfully!');
      setStartDate('');
      setEndDate('');
      setReason('');
      onRequestSubmitted();
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Request Time Off / Holiday</h3>
      
      {message && (
        <div className={`p-3 mb-4 rounded-lg text-sm font-medium ${message.includes('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Notes</label>
          <textarea 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            placeholder="Optional details (e.g., Annual family holiday)" 
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Leave Request'}
        </button>
      </form>
    </div>
  );
}