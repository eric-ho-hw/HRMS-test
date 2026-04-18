'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, Save, X } from 'lucide-react'

type Driver = {
  id: string
  employee_no: string
  base_salary: number
  shift_start: string
  shift_end: string
  is_active: boolean
  profiles: { full_name: string; phone: string | null } | null
}

const EMPTY_FORM = { full_name: '', employee_no: '', base_salary: '', shift_start: '08:00', shift_end: '17:00', phone: '' }

export default function DriversPage() {
  const supabase = createClient()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM, email: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('drivers')
      .select('id, employee_no, base_salary, shift_start, shift_end, is_active, profiles(full_name, phone)')
      .order('employee_no')
    setDrivers((data ?? []) as unknown as Driver[])
  }, [supabase])

  useEffect(() => { load() }, [load])

  function startEdit(d: Driver) {
    setEditing(d.id)
    setEditForm({
      full_name: d.profiles?.full_name ?? '',
      employee_no: d.employee_no,
      base_salary: String(d.base_salary),
      shift_start: d.shift_start,
      shift_end: d.shift_end,
      phone: d.profiles?.phone ?? '',
    })
  }

  async function saveEdit(d: Driver) {
    setSaving(true); setError('')
    const { error: e1 } = await supabase.from('drivers').update({
      employee_no: editForm.employee_no,
      base_salary: Number(editForm.base_salary),
      shift_start: editForm.shift_start,
      shift_end: editForm.shift_end,
    }).eq('id', d.id)

    if (e1) { setError(e1.message); setSaving(false); return }
    setEditing(null)
    await load()
    setSaving(false)
  }

  async function toggleActive(d: Driver) {
    await supabase.from('drivers').update({ is_active: !d.is_active }).eq('id', d.id)
    await load()
  }

  async function addDriver() {
    setSaving(true); setError(''); setSuccess('')

    const res = await fetch('/api/invite-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: addForm.email,
        full_name: addForm.full_name,
        phone: addForm.phone,
        employee_no: addForm.employee_no,
        base_salary: addForm.base_salary,
        shift_start: addForm.shift_start,
        shift_end: addForm.shift_end,
      }),
    })

    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }

    setSuccess(`Invite sent to ${addForm.email}. The driver will receive an email to set their password.`)
    setShowAdd(false)
    setAddForm({ ...EMPTY_FORM, email: '' })
    await load()
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <button onClick={() => { setShowAdd(true); setError(''); setSuccess('') }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plus size={16} />Add Driver
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2">{success}</p>}

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Emp No</th>
              <th className="px-4 py-3">Base Salary</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {drivers.map(d => editing === d.id ? (
              <tr key={d.id} className="bg-blue-50">
                <td className="px-4 py-2">
                  <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm" placeholder="Full name" />
                </td>
                <td className="px-4 py-2">
                  <input value={editForm.employee_no} onChange={e => setEditForm(f => ({ ...f, employee_no: e.target.value }))}
                    className="w-28 border rounded px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-2">
                  <input type="number" value={editForm.base_salary} onChange={e => setEditForm(f => ({ ...f, base_salary: e.target.value }))}
                    className="w-28 border rounded px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-2 flex gap-1">
                  <input type="time" value={editForm.shift_start} onChange={e => setEditForm(f => ({ ...f, shift_start: e.target.value }))}
                    className="border rounded px-2 py-1 text-xs" />
                  <input type="time" value={editForm.shift_end} onChange={e => setEditForm(f => ({ ...f, shift_end: e.target.value }))}
                    className="border rounded px-2 py-1 text-xs" />
                </td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(d)} disabled={saving}
                      className="flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Save
                    </button>
                    <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-gray-500 text-xs px-2 py-1 rounded border">
                      <X size={12} />Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{d.profiles?.full_name ?? '—'}</p>
                  {d.profiles?.phone && <p className="text-xs text-gray-400">{d.profiles.phone}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{d.employee_no}</td>
                <td className="px-4 py-3 text-gray-700">RM {Number(d.base_salary).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{d.shift_start.slice(0, 5)} – {d.shift_end.slice(0, 5)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(d)}
                    className={`text-xs font-medium px-2 py-1 rounded-full ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => startEdit(d)} className="text-xs text-blue-600 hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add driver modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Driver</h2>
            <p className="text-xs text-gray-500">An invite email will be sent so the driver sets their own password.</p>
            {[
              { label: 'Full Name', key: 'full_name', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Employee No', key: 'employee_no', type: 'text' },
              { label: 'Phone', key: 'phone', type: 'tel' },
              { label: 'Base Salary (RM)', key: 'base_salary', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input type={f.type} value={(addForm as Record<string, string>)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {[{ label: 'Shift Start', key: 'shift_start' }, { label: 'Shift End', key: 'shift_end' }].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type="time" value={(addForm as Record<string, string>)[f.key]}
                    onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={addDriver} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2 text-sm flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}Send Invite
              </button>
              <button onClick={() => { setShowAdd(false); setError('') }}
                className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
