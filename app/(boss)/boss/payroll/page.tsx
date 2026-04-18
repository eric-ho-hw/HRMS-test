'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, Download, Loader2 } from 'lucide-react'

type DriverRow = {
  id: string
  employee_no: string
  base_salary: number
  profiles: { full_name: string } | null
  ot: number
  allowances: number
  entryId: string | null
}

export default function PayrollPage() {
  const supabase = createClient()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<DriverRow[]>([])
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [periodStatus, setPeriodStatus] = useState<'open' | 'locked'>('open')
  const [locking, setLocking] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-31`

    // Get or create pay period
    let { data: period } = await supabase.from('pay_periods').select('id, status').eq('year', year).eq('month', month).single()
    if (!period) {
      const { data: newPeriod } = await supabase.from('pay_periods').insert({ year, month }).select().single()
      period = newPeriod
    }
    setPeriodId(period?.id ?? null)
    setPeriodStatus(period?.status ?? 'open')

    const { data: drivers } = await supabase.from('drivers')
      .select('id, employee_no, base_salary, profiles(full_name)')
      .eq('is_active', true)
      .order('employee_no')

    const { data: payrollEntries } = await supabase.from('payroll_entries')
      .select('driver_id, ot_total, allowance_total, id')
      .eq('pay_period_id', period?.id ?? '')

    const entryMap = new Map(payrollEntries?.map(e => [e.driver_id, e]) ?? [])

    // For open months, compute live totals
    const [{ data: ots }, { data: claims }] = await Promise.all([
      supabase.from('ot_requests').select('driver_id, ot_amount').eq('status', 'approved').gte('date', start).lte('date', end),
      supabase.from('allowance_claims').select('driver_id, amount').eq('status', 'approved').gte('date', start).lte('date', end),
    ])

    const otMap = new Map<string, number>()
    ots?.forEach(r => otMap.set(r.driver_id, (otMap.get(r.driver_id) ?? 0) + Number(r.ot_amount ?? 0)))
    const claimMap = new Map<string, number>()
    claims?.forEach(r => claimMap.set(r.driver_id, (claimMap.get(r.driver_id) ?? 0) + Number(r.amount ?? 0)))

    const built: DriverRow[] = (drivers ?? []).map(d => {
      const entry = entryMap.get(d.id)
      return {
        id: d.id,
        employee_no: d.employee_no,
        base_salary: Number(d.base_salary),
        profiles: d.profiles as unknown as { full_name: string } | null,
        ot: entry ? Number(entry.ot_total) : (otMap.get(d.id) ?? 0),
        allowances: entry ? Number(entry.allowance_total) : (claimMap.get(d.id) ?? 0),
        entryId: entry?.id ?? null,
      }
    })

    setRows(built)
    setLoading(false)
  }, [supabase, selectedMonth])

  useEffect(() => { load() }, [load])

  async function lockMonth() {
    if (!periodId) return
    setLocking(true)
    const [year, month] = selectedMonth.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-31`

    // Upsert payroll entries for all drivers
    const { data: ots } = await supabase.from('ot_requests').select('driver_id, ot_amount').eq('status', 'approved').gte('date', start).lte('date', end)
    const { data: claims } = await supabase.from('allowance_claims').select('driver_id, amount').eq('status', 'approved').gte('date', start).lte('date', end)

    const otMap = new Map<string, number>()
    ots?.forEach(r => otMap.set(r.driver_id, (otMap.get(r.driver_id) ?? 0) + Number(r.ot_amount ?? 0)))
    const claimMap = new Map<string, number>()
    claims?.forEach(r => claimMap.set(r.driver_id, (claimMap.get(r.driver_id) ?? 0) + Number(r.amount ?? 0)))

    const entries = rows.map(d => ({
      driver_id: d.id,
      pay_period_id: periodId,
      base_salary: d.base_salary,
      ot_total: otMap.get(d.id) ?? 0,
      allowance_total: claimMap.get(d.id) ?? 0,
    }))

    await supabase.from('payroll_entries').upsert(entries, { onConflict: 'driver_id,pay_period_id' })
    await supabase.from('pay_periods').update({ status: 'locked', locked_at: new Date().toISOString() }).eq('id', periodId)

    setLocking(false)
    await load()
  }

  function exportCsv() {
    const [year, month] = selectedMonth.split('-').map(Number)
    const header = 'Employee No,Name,Base Salary,OT,Allowances,Gross Pay\n'
    const body = rows.map(r => {
      const gross = r.base_salary + r.ot + r.allowances
      const name = r.profiles?.full_name ?? ''
      return `${r.employee_no},"${name}",${r.base_salary.toFixed(2)},${r.ot.toFixed(2)},${r.allowances.toFixed(2)},${gross.toFixed(2)}`
    }).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
  }

  const totals = rows.reduce((acc, r) => ({
    base: acc.base + r.base_salary,
    ot: acc.ot + r.ot,
    allowances: acc.allowances + r.allowances,
  }), { base: 0, ot: 0, allowances: 0 })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <div className="flex items-center gap-3">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {periodStatus === 'open' && (
            <button onClick={lockMonth} disabled={locking}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {locking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Lock Month
            </button>
          )}
          <button onClick={exportCsv}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <Download size={14} />Export CSV
          </button>
        </div>
      </div>

      {periodStatus === 'locked' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700 font-medium">
          This month is locked and finalised.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3 text-right">Base</th>
                <th className="px-4 py-3 text-right">OT</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Gross Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => {
                const gross = r.base_salary + r.ot + r.allowances
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.profiles?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.employee_no}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">RM {r.base_salary.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">RM {r.ot.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">RM {r.allowances.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">RM {gross.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50 font-semibold text-gray-700">
                <td className="px-4 py-3 text-xs uppercase tracking-wide">Total ({rows.length} drivers)</td>
                <td className="px-4 py-3 text-right">RM {totals.base.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">RM {totals.ot.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">RM {totals.allowances.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-900">RM {(totals.base + totals.ot + totals.allowances).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
