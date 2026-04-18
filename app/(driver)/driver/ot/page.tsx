'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcOtAmount } from '@/lib/ot'
import { Loader2 } from 'lucide-react'

type OtRequest = {
  id: string
  date: string
  hours: number
  day_type: string
  reason: string
  ot_amount: number | null
  status: 'pending' | 'approved' | 'rejected'
}

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function OtPage() {
  const supabase = createClient()
  const [driver, setDriver] = useState<{ id: string; base_salary: number; shift_start: string; shift_end: string } | null>(null)
  const [requests, setRequests] = useState<OtRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [hours, setHours] = useState(1)
  const [dayType, setDayType] = useState<'weekday' | 'rest' | 'public_holiday'>('weekday')
  const [reason, setReason] = useState('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: d } = await supabase.from('drivers').select('id,base_salary,shift_start,shift_end').eq('profile_id', user.id).single()
    if (!d) return
    setDriver(d)
    const { data } = await supabase.from('ot_requests').select('*').eq('driver_id', d.id).order('date', { ascending: false })
    setRequests(data ?? [])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  function shiftHours() {
    if (!driver) return 8
    const [sh, sm] = driver.shift_start.split(':').map(Number)
    const [eh, em] = driver.shift_end.split(':').map(Number)
    return (eh * 60 + em - (sh * 60 + sm)) / 60
  }

  const preview = driver ? calcOtAmount(driver.base_salary, shiftHours(), 26, hours, dayType) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    const { error } = await supabase.from('ot_requests').insert({
      driver_id: driver!.id,
      date,
      hours,
      day_type: dayType,
      reason,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setSuccess('OT request submitted!')
    setReason('')
    await loadData()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">OT Request</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
            <input type="number" min={0.5} max={12} step={0.5} value={hours} onChange={e => setHours(Number(e.target.value))} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Day Type</label>
          <select value={dayType} onChange={e => setDayType(e.target.value as typeof dayType)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="weekday">Weekday (1.5×)</option>
            <option value="rest">Rest Day (2×)</option>
            <option value="public_holiday">Public Holiday (3×)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {driver && (
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-800">
            Estimated OT: <span className="font-bold">RM {preview.toFixed(2)}</span>
            <span className="text-xs text-blue-500 ml-1">(subject to approval)</span>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <button type="submit" disabled={loading || !driver}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          Submit Request
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-700">Previous Requests</h2>
      {requests.length === 0 && <p className="text-sm text-gray-400">No requests yet.</p>}
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="bg-white rounded-xl border p-3 flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-900">{r.date} · {r.hours}h · {r.day_type.replace('_', ' ')}</p>
              {r.reason && <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>}
              {r.ot_amount && <p className="text-xs text-green-700 mt-0.5">RM {r.ot_amount.toFixed(2)}</p>}
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
