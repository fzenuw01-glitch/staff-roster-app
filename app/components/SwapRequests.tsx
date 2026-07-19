"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SwapRequests({ userRole }: { userRole: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shift_swaps')
      .select('*, profiles!shift_swaps_offered_by_user_id_fkey(full_name), daily_shifts(date)')
      .eq('status', 'pending');
    setRequests(data || []);
    setLoading(false);
  };

  const handleAction = async (id: string, shiftId: string, status: string, targetUserId: string) => {
    if (status === 'approved') {
      await supabase.from('daily_shifts').update({ user_id: targetUserId }).eq('id', shiftId);
    }
    await supabase.from('shift_swaps').update({ status }).eq('id', id);
    fetchRequests(); 
  };

  // Only show to admins/managers
 if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'master') return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Pending Swap Requests</h2>
      {loading ? (
        <p className="text-sm text-gray-500">Loading requests...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-500">No pending swaps.</p>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <p className="font-semibold text-slate-700">{req.profiles?.full_name} wants to swap</p>
                <p className="text-xs text-slate-500">Shift Date: {req.daily_shifts?.date}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAction(req.id, req.shift_id, 'approved', req.requested_by_user_id || '')} 
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleAction(req.id, req.shift_id, 'declined', '')} 
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}