'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase' // adjust relative path if needed

export default function StaffManagementPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [advanceModalUser, setAdvanceModalUser] = useState<any | null>(null)
  const [advanceAmount, setAdvanceAmount] = useState<number>(50)
  const [advanceNotes, setAdvanceNotes] = useState<string>('')
  const [advanceDate, setAdvanceDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [managingAdvancesUser, setManagingAdvancesUser] = useState<any | null>(null)
const [userAdvances, setUserAdvances] = useState<any[]>([])
const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null)
const [editAmount, setEditAmount] = useState<number>(0)
const [editNotes, setEditNotes] = useState<string>('')
const [editDate, setEditDate] = useState<string>('')

  const currentMonth = new Date()

  // Add new staff form state
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffRate, setNewStaffRate] = useState(12.0)
  const [newStaffHours, setNewStaffHours] = useState(160)
  const [isInviting, setIsInviting] = useState(false)

  // Top-level hooks properly registered here
  useEffect(() => {
    fetchStaff()
  }, [])

  useEffect(() => {
    fetchAuditLogs()
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

  const fetchAuditLogs = async () => {
    const { data } = await supabase
      .from('payroll_audit_logs')
      .select(`
        *,
        manager:profiles!payroll_audit_logs_manager_id_fkey(full_name),
        target:profiles!payroll_audit_logs_target_user_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setAuditLogs(data)
  }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Format explicitly as YYYY-MM-DD to match the 'date' column type in Supabase
  const pad = (n: number) => String(n).padStart(2, '0')
  const startDate = `${year}-${pad(month + 1)}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`

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
          contracted_hours: Number(user.contracted_hours),
          payment_frequency: user.payment_frequency
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

const fetchUserAdvances = async (userId: string) => {
  const { data, error } = await supabase
    .from('staff_advances')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    alert('Error loading advances: ' + error.message)
    return
  }

  setUserAdvances(data || [])
}

const handleIssueAdvance = async (userId: string, amount: number, notes: string, date: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // 1. Insert into staff_advances with the chosen date
  const { error: advError } = await supabase.from('staff_advances').insert({
    user_id: userId,
    amount: amount,
    notes: notes,
    date: date,
    deducted: false
  });

  if (advError) {
    alert("Error saving advance: " + advError.message);
    return;
  }

  // 2. Insert record into payroll_audit_logs
  await supabase.from('payroll_audit_logs').insert({
    manager_id: session.user.id,
    target_user_id: userId,
    action_type: 'ADVANCE_ISSUED',
    details: `Issued £${amount.toFixed(2)} advance (${notes || 'Advance'}) for date ${date}`
  });

  fetchAuditLogs();
};  

const handleUpdateAdvance = async (advanceId: string, userId: string, newAmount: number, newNotes: string, newDate: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // 1. Update the staff_advance record
  const { error: updateError } = await supabase
    .from('staff_advances')
    .update({ amount: newAmount, notes: newNotes, date: newDate })
    .eq('id', advanceId);

  if (updateError) {
    alert("Error updating advance: " + updateError.message);
    return;
  }

  // 2. Record the edit action in your audit trail
  await supabase.from('payroll_audit_logs').insert({
    manager_id: session.user.id,
    target_user_id: userId,
    action_type: 'ADVANCE_EDITED',
    details: `Updated advance to £${newAmount.toFixed(2)} (${newNotes || 'No notes'}) for date ${newDate}`
  });

  fetchAuditLogs();
};

const handleDeleteAdvance = async (advanceId: string, userId: string, advanceAmount: number) => {
  if (!confirm("Are you sure you want to delete this advance?")) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // 1. Record the deletion in the audit trail first
  await supabase.from('payroll_audit_logs').insert({
    manager_id: session.user.id,
    target_user_id: userId,
    action_type: 'ADVANCE_DELETED',
    details: `Deleted advance of £${advanceAmount.toFixed(2)}`
  });

  // 2. Delete the record from staff_advances
  const { error: deleteError } = await supabase
    .from('staff_advances')
    .delete()
    .eq('id', advanceId);

  if (deleteError) {
    alert("Error deleting advance: " + deleteError.message);
    return;
  }

  fetchAuditLogs();
};

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
      fetchStaff()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsInviting(false)
    }
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

  const onViewPayslip = (userId: string) => {
    router.push(`/dashboard/payslip/${userId}`)
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

    <div className="space-y-10">
      {/* Audit Trail Section for Managers */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Payroll & Advance Audit Trail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
                <th className="pb-3 px-2">Date / Time</th>
                <th className="pb-3 px-2">Manager</th>
                <th className="pb-3 px-2">Staff Member</th>
                <th className="pb-3 px-2">Action</th>
                <th className="pb-3 px-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-2 text-slate-500 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {log.manager?.full_name || 'System'}
                    </td>
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {log.target?.full_name || '-'}
                    </td>
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-slate-600">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
    </div>

    {/* Editable Existing Team Directory Table */}
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
  <div className="flex justify-between items-center mb-4 border-b pb-3">
    <h2 className="text-lg font-bold text-slate-800">Existing Team Directory</h2>
    <span className="text-xs text-slate-400 font-medium">Showing {staff.length} staff members</span>
  </div>
  <table className="w-full text-left border-collapse min-w-250">
    <thead>
      <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
        <th className="pb-3 px-3">Name & Email</th>
        <th className="pb-3 px-3">System Role</th>
        <th className="pb-3 px-3">Employment</th>
        <th className="pb-3 px-3">Frequency</th>
        <th className="pb-3 px-3">Rate (£)</th>
        <th className="pb-3 px-3">Hours</th>
        <th className="pb-3 px-3 text-right">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 text-sm">
      {staff.map(user => (
        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
          {/* Combined Name & Email to save horizontal space */}
          <td className="py-4 px-3 space-y-1">
            <input
              type="text"
              value={user.full_name || ''}
              onChange={e => handleFieldChange(user.id, 'full_name', e.target.value)}
              className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              placeholder="Full Name"
            />
            <input
              type="email"
              value={user.email || ''}
              onChange={e => handleFieldChange(user.id, 'email', e.target.value)}
              className="w-full p-1.5 border border-slate-200 rounded-lg bg-white text-slate-500 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              placeholder="email@example.com"
            />
          </td>

          {/* System Role */}
          <td className="py-4 px-3 align-top">
            <select
              value={user.role || 'staff'}
              onChange={e => handleFieldChange(user.id, 'role', e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="master">Master</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </td>

          {/* Employment Type */}
          <td className="py-4 px-3 align-top">
            <select
              value={user.employment_type || 'Employee'}
              onChange={e => handleFieldChange(user.id, 'employment_type', e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="Employee">Employee</option>
              <option value="Contractor">Contractor</option>
            </select>
          </td>

          {/* Payment Frequency */}
          <td className="py-4 px-3 align-top">
            <select
              value={user.payment_frequency || 'Monthly'}
              onChange={e => handleFieldChange(user.id, 'payment_frequency', e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            >
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
              <option value="Hourly">Hourly</option>
            </select>
          </td>

          {/* Hourly Rate */}
          <td className="py-4 px-3 align-top">
            <input
              type="number"
              step="0.01"
              value={user.hourly_rate ?? ''}
              onChange={e => handleFieldChange(user.id, 'hourly_rate', e.target.value)}
              className="w-24 p-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              placeholder="0.00"
            />
          </td>

          {/* Contracted Hours */}
          <td className="py-4 px-3 align-top">
            <input
              type="number"
              step="0.01"
              value={user.contracted_hours ?? ''}
              onChange={e => handleFieldChange(user.id, 'contracted_hours', e.target.value)}
              className="w-24 p-2 border border-slate-200 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              placeholder="0.00"
            />
          </td>

          {/* Actions Column */}
          <td className="py-4 px-3 text-right align-top">
            <div className="flex flex-wrap justify-end gap-1.5 max-w-60 ml-auto">
              <button
                onClick={() => setAdvanceModalUser(user)}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-sm transition"
                title="Issue Advance"
              >
                + Advance
              </button>

              <button
                onClick={() => {
                  setManagingAdvancesUser(user)
                  fetchUserAdvances(user.id)
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-700 rounded-md hover:bg-slate-800 shadow-sm transition"
                title="Manage Existing Advances"
              >
                Manage
              </button>

              <button
                onClick={() => onViewPayslip(user.id)}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition"
              >
                Payslip
              </button>

              <button
                onClick={() => handleResendInvite(user)}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-amber-500 rounded-md hover:bg-amber-600 shadow-sm transition"
              >
                Invite
              </button>

              <button
                onClick={() => handleSaveRow(user)}
                disabled={savingId === user.id}
                className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-700 rounded-md hover:bg-indigo-800 disabled:opacity-50 shadow-sm transition w-full mt-1"
              >
                {savingId === user.id ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </td>
        </tr>
      ))}
      {staff.length === 0 && (
        <tr>
          <td colSpan={7} className="text-center text-slate-400 py-8 text-sm">No staff members found.</td>
        </tr>
      )}
    </tbody>
  </table>
</div>

    {/* Issue Advance Modal */}
    {advanceModalUser && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full space-y-4">
          <h3 className="text-lg font-bold text-slate-900">
            Issue Advance to {advanceModalUser.full_name}
          </h3>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (£)</label>
            <input
              type="number"
              step="0.01"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(Number(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes / Reason</label>
            <input
              type="text"
              placeholder="e.g. Emergency grocery advance"
              value={advanceNotes}
              onChange={(e) => setAdvanceNotes(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
            <input
              type="date"
              value={advanceDate}
              onChange={(e) => setAdvanceDate(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAdvanceModalUser(null)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await handleIssueAdvance(advanceModalUser.id, advanceAmount, advanceNotes, advanceDate)
                setAdvanceModalUser(null)
                setAdvanceNotes('')
              }}
              className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Confirm & Save Advance
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Manage Advances Modal */}
    {managingAdvancesUser && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-lg font-bold text-slate-900">
              Manage Advances for {managingAdvancesUser.full_name}
            </h3>
            <button 
              onClick={() => setManagingAdvancesUser(null)}
              className="text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              &times;
            </button>
          </div>

          <div className="space-y-3">
            {userAdvances.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No advance records found for this user.</p>
            ) : (
userAdvances.map((adv) => (
  <div key={adv.id} className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition-all">
    {editingAdvanceId === adv.id ? (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (£)</label>
          <input
            type="number"
            step="0.01"
            value={editAmount}
            onChange={(e) => setEditAmount(Number(e.target.value))}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</label>
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
          />
        </div>
      </div>
    ) : (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-base">£{Number(adv.amount).toFixed(2)}</span>
          <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{adv.date}</span>
        </div>
        <p className="text-xs text-slate-600 font-medium">{adv.notes || 'No notes provided'}</p>
        <div>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
            adv.deducted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {adv.deducted ? 'Deducted' : 'Pending Deduction'}
          </span>
        </div>
      </div>
    )}

    <div className="flex items-center gap-2 self-end md:self-center">
      {editingAdvanceId === adv.id ? (
        <>
          <button
            onClick={async () => {
              await handleUpdateAdvance(adv.id, managingAdvancesUser.id, editAmount, editNotes, editDate)
              setEditingAdvanceId(null)
              fetchUserAdvances(managingAdvancesUser.id)
            }}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
          >
            Save
          </button>
          <button
            onClick={() => setEditingAdvanceId(null)}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => {
              setEditingAdvanceId(adv.id)
              setEditAmount(adv.amount)
              setEditNotes(adv.notes || '')
              setEditDate(adv.date)
            }}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              await handleDeleteAdvance(adv.id, managingAdvancesUser.id, adv.amount)
              fetchUserAdvances(managingAdvancesUser.id)
            }}
            className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors"
          >
            Delete
          </button>
        </>
      )}
    </div>
  </div>
))
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setManagingAdvancesUser(null)}
              className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
)

}