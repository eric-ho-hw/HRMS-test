'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

type Claim = {
  id: string
  date: string
  type: 'meal' | 'overnight'
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
}

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function AllowancesPage() {
  const supabase = createClient()
  const [driverId, setDriverId] = useState<string | null>(null)
  const [rates, setRates] = useState<Record<string, number>>({})
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState<'meal' | 'overnight'>('meal')
  const [notes, setNotes] = useState('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: driver } = await supabase.from('drivers').select('id').eq('profile_id', user.id).single()
    if (!driver) return
    setDriverId(driver.id)

    const { data: rateRows } = await supabase.from('allowance_rates').select('type, amount')
    const rateMap: Record<string, number> = {}
    rateRows?.forEach(r => { rateMap[r.type] = r.amount })
    setRates(rateMap)

    const { data } = await supabase.from('allowance_claims').select('*').eq('driver_id', driver.id).order('date', { ascending: false })
    setClaims(data ?? [])
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    const amount = rates[type] ?? 0
    const { error } = await supabase.from('allowance_claims').insert({
      driver_id: driverId,
      date,
      type,
      amount,
      notes,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setSuccess('Claim submitted for approval!')
    setNotes('')
    await loadData()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Allowance Claims</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as 'meal' | 'overnight')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="meal">Meal</option>
              <option value="overnight">Overnight</option>
            </select>
          </div>
        </div>

        {rates[type] && (
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-800">
            Rate: <span className="font-bold">RM {Number(rates[type]).toFixed(2)}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. KL overnight trip"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <button type="submit" disabled={loading || !driverId}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          Submit Claim
        </button>
      </form>

      <h2 className="text-sm font-semibold text-gray-700">Previous Claims</h2>
      {claims.length === 0 && <p className="text-sm text-gray-400">No claims yet.</p>}
      <div className="space-y-2">
        {claims.map(c => (
          <div key={c.id} className="bg-white rounded-xl border p-3 flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-900 capitalize">{c.date} · {c.type}</p>
              <p className="text-xs text-gray-500 mt-0.5">RM {Number(c.amount).toFixed(2)}{c.notes ? ` · ${c.notes}` : ''}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_STYLE[c.status]}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
