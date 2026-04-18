'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Loader2 } from 'lucide-react'

type OtRow = {
  id: string
  date: string
  hours: number
  day_type: string
  reason: string | null
  status: string
  drivers: { employee_no: string; base_salary: number; shift_start: string; shift_end: string; profiles: { full_name: string } | null } | null
}

type ClaimRow = {
  id: string
  date: string
  type: string
  amount: number
  notes: string | null
  status: string
  drivers: { employee_no: string; profiles: { full_name: string } | null } | null
}

const MULTIPLIER: Record<string, number> = { weekday: 1.5, rest: 2.0, public_holiday: 3.0 }

export default function ApprovalsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'ot' | 'allowance'>('ot')
  const [otRows, setOtRows] = useState<OtRow[]>([])
  const [claimRows, setClaimRows] = useState<ClaimRow[]>([])
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: ots }, { data: claims }] = await Promise.all([
      supabase.from('ot_requests').select('id,date,hours,day_type,reason,status,drivers(employee_no,base_salary,shift_start,shift_end,profiles(full_name))').eq('status', 'pending').order('date'),
      supabase.from('allowance_claims').select('id,date,type,amount,notes,status,drivers(employee_no,profiles(full_name))').eq('status', 'pending').order('date'),
    ])
    setOtRows((ots ?? []) as unknown as OtRow[])
    setClaimRows((claims ?? []) as unknown as ClaimRow[])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleOt(id: string, approve: boolean, row: OtRow) {
    setActionId(id)
    const { data: { user } } = await supabase.auth.getUser()

    let otAmount: number | null = null
    if (approve && row.drivers) {
      const d = row.drivers
      const [sh, sm] = d.shift_start.split(':').map(Number)
      const [eh, em] = d.shift_end.split(':').map(Number)
      const shiftHours = (eh * 60 + em - sh * 60 - sm) / 60
      const hourlyRate = Number(d.base_salary) / (26 * shiftHours)
      otAmount = parseFloat((hourlyRate * row.hours * MULTIPLIER[row.day_type]).toFixed(2))
    }

    await supabase.from('ot_requests').update({
      status: approve ? 'approved' : 'rejected',
      ot_amount: otAmount,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    setActionId(null)
    await load()
  }

  async function handleClaim(id: string, approve: boolean) {
    setActionId(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('allowance_claims').update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    setActionId(null)
    await load()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>

      <div className="flex border-b gap-6">
        <TabBtn label={`OT Requests (${otRows.length})`} active={tab === 'ot'} onClick={() => setTab('ot')} />
        <TabBtn label={`Allowances (${claimRows.length})`} active={tab === 'allowance'} onClick={() => setTab('allowance')} />
      </div>

      {tab === 'ot' && (
        <div className="space-y-3">
          {otRows.length === 0 && <p className="text-sm text-gray-400">No pending OT requests.</p>}
          {otRows.map(r => {
            const name = r.drivers?.profiles?.full_name ?? r.drivers?.employee_no ?? '—'
            const d = r.drivers
            let est = 0
            if (d) {
              const [sh, sm] = d.shift_start.split(':').map(Number)
              const [eh, em] = d.shift_end.split(':').map(Number)
              const shiftHours = (eh * 60 + em - sh * 60 - sm) / 60
              est = parseFloat(((Number(d.base_salary) / (26 * shiftHours)) * r.hours * MULTIPLIER[r.day_type]).toFixed(2))
            }
            return (
              <div key={r.id} className="bg-white rounded-xl border p-4 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">{r.date} · {r.hours}h · <span className="capitalize">{r.day_type.replace('_', ' ')}</span></p>
                  {r.reason && <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>}
                  <p className="text-xs text-blue-700 mt-1">Est. RM {est.toFixed(2)}</p>
                </div>
                <ActionButtons id={r.id} loading={actionId === r.id}
                  onApprove={() => handleOt(r.id, true, r)}
                  onReject={() => handleOt(r.id, false, r)} />
              </div>
            )
          })}
        </div>
      )}

      {tab === 'allowance' && (
        <div className="space-y-3">
          {claimRows.length === 0 && <p className="text-sm text-gray-400">No pending allowance claims.</p>}
          {claimRows.map(r => {
            const name = r.drivers?.profiles?.full_name ?? r.drivers?.employee_no ?? '—'
            return (
              <div key={r.id} className="bg-white rounded-xl border p-4 flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500 capitalize">{r.date} · {r.type} · RM {Number(r.amount).toFixed(2)}</p>
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                </div>
                <ActionButtons id={r.id} loading={actionId === r.id}
                  onApprove={() => handleClaim(r.id, true)}
                  onReject={() => handleClaim(r.id, false)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`pb-3 text-sm font-medium border-b-2 -mb-px transition ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
      {label}
    </button>
  )
}

function ActionButtons({ id, loading, onApprove, onReject }: { id: string; loading: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex gap-2 shrink-0">
      <button onClick={onApprove} disabled={loading}
        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
      </button>
      <button onClick={onReject} disabled={loading}
        className="flex items-center gap-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg">
        <X size={12} /> Reject
      </button>
    </div>
  )
}
