'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  employment_type: string;
}

export default function StaffManagementPage() {
  // Add Staff State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rate, setRate] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  // Profiles List State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, employment_type')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching profiles:', error.message);
    } else if (data) {
      setProfiles(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setMessage('');

    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, rate: parseFloat(rate) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add staff');

      setMessage('Staff member created and temporary password email sent successfully!');
      setName('');
      setEmail('');
      setRate('');
      fetchProfiles(); // Refresh the table list automatically
    } catch (err: any) {
      setMessage('Error: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: string, newRole: string, newType: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, employment_type: newType })
        .eq('id', id);

      if (error) throw error;

      setProfiles(profiles.map(p => p.id === id ? { ...p, role: newRole, employment_type: newType } : p));
      alert('Staff details updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update staff.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Staff & Contractor Management</h1>

      {/* SECTION 1: Add New Staff Form (Sends Temporary Password Email) */}
      <div className="p-6 max-w-md bg-white rounded shadow border">
        <h2 className="text-xl font-bold mb-4">Add New Staff Member</h2>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Hourly Rate</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 border rounded"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {adding ? 'Processing...' : 'Create Staff & Send Email'}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-center text-gray-700">{message}</p>}
      </div>

      {/* SECTION 2: Existing Team Directory & Role Manager */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden border">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold text-slate-800">Existing Team Directory</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading staff directory...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employment Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {profiles.map((profile) => (
                <StaffRow 
                  key={profile.id} 
                  profile={profile} 
                  onSave={handleUpdate} 
                  isUpdating={updatingId === profile.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StaffRow({ profile, onSave, isUpdating }: { 
  profile: Profile; 
  onSave: (id: string, role: string, type: string) => void;
  isUpdating: boolean;
}) {
  const [role, setRole] = useState(profile.role);
  const [employmentType, setEmploymentType] = useState(profile.employment_type || 'staff');

  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
        {profile.full_name || 'Unnamed User'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        {profile.email}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        <select 
          value={role} 
          onChange={(e) => setRole(e.target.value)}
          className="border p-1 rounded text-sm bg-white text-slate-800"
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="master">Master</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
        <select 
          value={employmentType} 
          onChange={(e) => setEmploymentType(e.target.value)}
          className="border p-1 rounded text-sm bg-white text-slate-800"
        >
          <option value="staff">Staff</option>
          <option value="contractor">Contractor</option>
        </select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onSave(profile.id, role, employmentType)}
          disabled={isUpdating}
          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </button>
      </td>
    </tr>
  );
}