'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { sendEmailNotification } from '@/lib/email';

export default function LeaveApprovalWidget({ userRole }: { userRole: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leave_requests')
      .select('*, profiles(full_name, email)')
      .eq('status', 'pending')
      .order('start_date', { ascending: true });

    setRequests(data || []);
    setLoading(false);
  };

  const handleAction = async (req: any, status: 'approved' | 'declined') => {
    // 1. Update the leave request status
    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', req.id);

    if (error) {
      alert(`Error updating leave request: ${error.message}`);
      return;
    }

    // 2. If approved, automatically sync dates to the shifts/roster table
    if (status === 'approved') {
      try {
        const startDate = new Date(req.start_date);
        const endDate = new Date(req.end_date);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateString = d.toISOString().split('T')[0];

          await supabase
            .from('shifts')
            .upsert({
              user_id: req.user_id,
              date: dateString,
              shift_type: 'OFF',
              notes: 'Approved Holiday/Leave'
            }, { onConflict: 'user_id,date' });
        }
      } catch (err: any) {
        console.error('Error syncing approved leave to shifts:', err.message);
      }
    }

    // 3. Send Email Notification to Staff Member
    if (req.profiles?.email) {
      const isApproved = status === 'approved';
      await sendEmailNotification({
        to: req.profiles.email,
        subject: `Leave Request ${isApproved ? 'Approved ✅' : 'Declined ❌'}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: ${isApproved ? '#059669' : '#DC2626'};">
              Your Leave Request has been ${status}
            </h2>
            <p>Hi ${req.profiles?.full_name || 'Team Member'},</p>
            <p>Your time-off request from <strong>${req.start_date}</strong> to <strong>${req.end_date}</strong> has been <strong>${status}</strong> by management.</p>
            ${isApproved ? '<p>Your shifts for these dates have been automatically updated to OFF on the roster calendar.</p>' : ''}
            <p>Best regards,<br>Pay & Sleep Management</p>
          </div>
        `,
      });
    }

    // Refresh queue
    fetchLeaveRequests();
  };

  // Only render for admins, managers, or master roles
  if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'master') {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Pending Leave & Holiday Requests</h3>
      
      {loading ? (
        <p className="text-sm text-slate-500">Loading leave requests...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">No pending leave requests.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-50 rounded-lg border border-slate-200 gap-4">
              <div>
                <p className="font-semibold text-slate-800">{req.profiles?.full_name || 'Staff Member'}</p>
                <p className="text-xs font-medium text-indigo-600 mt-0.5">
                  {req.start_date} to {req.end_date}
                </p>
                {req.reason && (
                  <p className="text-xs text-slate-500 mt-1 italic">&quot;{req.reason}&quot;</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(req, 'approved')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(req, 'declined')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
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