'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase' // adjust relative path if needed

export default function StaffManagementPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)

  // Add new staff form state
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffRate, setNewStaffRate] = useState(12.0)
  const [newStaffHours, setNewStaffHours] = useState(160)
  const [isInviting, setIsInviting] = useState(false)

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/')

    // Fetch profile to verify permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const allowedRoles = ['admin', 'master', 'developer']
    if (!profile || !allowedRoles.includes(profile.role)) {
      alert("Access Denied.")
      return router.push('/dashboard')
    }

    // Fetch all staff profiles
    const { data: staffData } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true })

    // Initialize local editable state mapping
    if (staffData) {
      setStaff(staffData.map((s: any) => ({ ...s })) )
    }
    setLoading(false)
  }

  // Handle local row changes before saving
  const handleFieldChange = (id: string, field: string, value: any) => {
    setStaff(prev => prev.map(user => user.id === id ? { ...user, [field]: value } : user))
  }

  // Save modified row to Supabase
  const handleSaveRow = async (user: any) => {
    setSavingId(user.id)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          employment_type: user.employment_type,
          hourly_rate: Number(user.hourly_rate),
          contracted_hours: Number(user.contracted_hours)
        })
        .eq('id', user.id)

      if (error) throw error
      alert(`Successfully updated ${user.full_name || 'Staff Member'}!`)
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  const handleAddStaff = async () => {
    setIsInviting(true)
    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newStaffName, 
          email: newStaffEmail, 
          rate: newStaffRate,
          contracted_hours: newStaffHours 
        }),
      })

      if (!response.ok) {
        const resJson = await response.json()
        throw new Error(resJson.error || 'Failed to invite staff.')
      }
      
      alert(`Successfully invited ${newStaffName}!`)
      setIsAddingStaff(false)
      setNewStaffName('')
      setNewStaffEmail('')
      setNewStaffRate(12.0)
      setNewStaffHours(160)
      fetchSpatialDataOrRefresh()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsInviting(false)
    }
  }

  const fetchSpatialDataOrRefresh = () => {
    fetchStaff()
  }

  const handleResendInvite = async (user: any) => {
    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: user.full_name, 
          email: user.email, 
          rate: user.hourly_rate,
          action: 'resend' 
        }),
      })

      if (!response.ok) {
        const resJson = await response.json()
        throw new Error(resJson.error || 'Failed to resend invite.')
      }

      alert(`Resent invite email to ${user.email}!`)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500">Loading Staff Management...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="text-indigo-600 hover:text-indigo-800 font-bold mb-1 flex items-center transition-colors cursor-pointer text-sm"
          >
            ← Back to Admin Roster Builder
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff & Contractor Management</h1>
        </div>

        <button
          onClick={() => setIsAddingStaff(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          + New Staff Member
        </button>
      </div>

      {/* Add New Staff Form Card */}
      {isAddingStaff && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Add New Staff Member</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
              <input 
                placeholder="Full Name" 
                value={newStaffName}
                onChange={e => setNewStaffName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
              <input 
                placeholder="email@example.com" 
                type="email"
                value={newStaffEmail}
                onChange={e => setNewStaffEmail(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourly Rate (£)</label>
              <input 
                type="number" 
                step="0.10"
                value={newStaffRate}
                onChange={e => setNewStaffRate(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contracted Hours</label>
              <input 
                type="number" 
                value={newStaffHours}
                onChange={e => setNewStaffHours(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              onClick={() => setIsAddingStaff(false)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddStaff}
              disabled={isInviting}
              className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isInviting ? 'Creating...' : 'Create Staff & Send Email'}
            </button>
          </div>
        </div>
      )}

      {/* Editable Existing Team Directory Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Existing Team Directory</h2>
        <table className="w-full text-left border-collapse min-w-200">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
              <th className="pb-3 px-2">Name</th>
              <th className="pb-3 px-2">Email</th>
              <th className="pb-3 px-2">System Role</th>
              <th className="pb-3 px-2">Employment Type</th>
              <th className="pb-3 px-2">Hourly Rate (£)</th>
              <th className="pb-3 px-2">Contracted Hours</th>
              <th className="pb-3 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {staff.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-2">
                  <input
                    type="text"
                    value={user.full_name || ''}
                    onChange={e => handleFieldChange(user.id, 'full_name', e.target.value)}
                    className="w-full p-1.5 border border-slate-200 rounded bg-white text-slate-800 font-medium text-sm"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="email"
                    value={user.email || ''}
                    onChange={e => handleFieldChange(user.id, 'email', e.target.value)}
                    className="w-full p-1.5 border border-slate-200 rounded bg-white text-slate-800 text-sm"
                  />
                </td>
                <td className="py-3 px-2">
                  <select
                    value={user.role || 'staff'}
                    onChange={e => handleFieldChange(user.id, 'role', e.target.value)}
                    className="p-1.5 border border-slate-200 rounded bg-white text-slate-800 text-sm font-semibold"
                  >
                    <option value="master">Master</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                </td>
                <td className="py-3 px-2">
                  <select
                    value={user.employment_type || 'Employee'}
                    onChange={e => handleFieldChange(user.id, 'employment_type', e.target.value)}
                    className="p-1.5 border border-slate-200 rounded bg-white text-slate-800 text-sm"
                  >
                    <option value="Employee">Employee</option>
                    <option value="Contractor">Contractor</option>
                  </select>
                </td>
                <td className="py-3 px-2">
                  <input
                    type="number"
                    step="0.01"
                    value={user.hourly_rate ?? ''}
                    onChange={e => handleFieldChange(user.id, 'hourly_rate', e.target.value)}
                    className="w-24 p-1.5 border border-slate-200 rounded bg-white text-slate-800 text-sm"
                  />
                </td>
                <td className="py-3 px-2">
                  <input
                    type="number"
                    value={user.contracted_hours ?? ''}
                    onChange={e => handleFieldChange(user.id, 'contracted_hours', e.target.value)}
                    className="w-24 p-1.5 border border-slate-200 rounded bg-white text-slate-800 text-sm"
                  />
                </td>
                <td className="py-3 px-2 text-right space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => handleResendInvite(user)}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded font-medium text-xs hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    Resend Invite
                  </button>
                  <button
                    onClick={() => handleSaveRow(user)}
                    disabled={savingId === user.id}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded font-medium text-xs hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingId === user.id ? 'Saving...' : 'Save Changes'}
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-6">No staff members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}