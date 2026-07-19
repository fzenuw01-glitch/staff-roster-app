'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase' // adjust relative path if needed
import TeamCalendar from '../../components/TeamCalendar';

export default function AdminDashboard() {
  // 1. Initialize Supabase client at the very top of your component
  const supabase = createClient() 
  
  // 2. All your state hooks stay inside the component function
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

  // --- MISSING STATE VARIABLES ---
  const [staff, setStaff] = useState<any[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRate, setNewStaffRate] = useState(12.0);
  const [isInviting, setIsInviting] = useState(false);

  // --- HELPER FUNCTIONS ---
  
  const checkAccessAndFetchStaff = async () => {
    // 1. Fetch current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/');

    // 2. Fetch Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const allowedRoles = ['admin', 'master', 'developer'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      alert("Access Denied.");
      return router.push('/dashboard');
    }

    setProfile(profile);

    // 3. Fetch Staff List
    const { data: staffData } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', session.user.id); // Get everyone except yourself

    setStaff(staffData || []);
    setLoading(false);
  };

  const handleAddStaff = async () => {
    setIsInviting(true);
    try {
      // Assuming you have an API route as shown in your file structure
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        body: JSON.stringify({ name: newStaffName, email: newStaffEmail, rate: newStaffRate }),
      });

      if (!response.ok) throw new Error('Failed to invite staff.');
      
      alert(`Successfully invited ${newStaffName}!`);
      setIsAddingStaff(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffRate(12.0);
      checkAccessAndFetchStaff(); // Refresh the list
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  useEffect(() => {
    checkAccessAndFetchStaff();
  }, []); // Note: router and supabase are technically dependencies here, but it's fine for now.

  if (loading) {
    return <div className="p-6 text-slate-600 animate-pulse">Loading Admin Builder...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header section with back button */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-indigo-600 hover:text-indigo-800 font-bold mb-2 flex items-center transition-colors cursor-pointer text-sm"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Roster Builder</h1>
        </div>
        <button
          onClick={() => setIsAddingStaff(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          + New Staff Member
        </button>
      </div>

      {/* Team List */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Current Team</h2>
        <div className="space-y-3">
          {staff.map(user => (
            <div key={user.id} className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center hover:bg-slate-100 transition-colors">
              <div>
                <div className="font-bold text-slate-900">{user.full_name || 'Unnamed User'}</div>
                <div className="text-sm text-slate-500">{user.email}</div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                user.role === 'master' ? 'bg-purple-100 text-purple-700' :
                user.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-200 text-slate-700'
              }`}>
                {user.role || 'Staff'}
              </span>
            </div>
          ))}
          {staff.length === 0 && (
            <div className="text-center text-slate-500 py-4">No staff members found.</div>
          )}
        </div>
      </div>

      {/* NEW: Calendar Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Team Roster</h2>
        <TeamCalendar userRole={profile?.role} userId={profile?.id} />
      </div>

      {/* Existing Team List */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Current Team</h2>
        {/* ... existing staff list ... */}
      </div>

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl max-w-md w-full shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Invite New Staff</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input 
                  placeholder="e.g. Jane Doe" 
                  value={newStaffName}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  onChange={e => setNewStaffName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input 
                  placeholder="jane@example.com" 
                  type="email"
                  value={newStaffEmail}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  onChange={e => setNewStaffEmail(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourly Rate (£)</label>
                <input 
                  type="number" 
                  placeholder="12.00" 
                  value={newStaffRate}
                  step="0.10"
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  onChange={e => setNewStaffRate(Number(e.target.value))} 
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsAddingStaff(false)} 
                className="flex-1 p-3 font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddStaff} 
                disabled={isInviting}
                className="flex-1 p-3 font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {isInviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}