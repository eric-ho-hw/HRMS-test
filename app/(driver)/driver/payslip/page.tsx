'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Entry = {
  base_salary: number
  ot_total: number
  allowance_total: number
  pay_periods: { year: number; month: number; status: string }
}

export default function PayslipPage() {
  const supabase = createClient()
  const [driverId, setDriverId] = useState<string | null>(null)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [liveOt, setLiveOt] = useState(0)
  const [liveAllowances, setLiveAllowances] = useState(0)
  const [baseSalary, setBaseSalary] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: driver } = await supabase.from('drivers').select('id,base_salary').eq('profile_id', user.id).single()
    if (!driver) return
    setDriverId(driver.id)
    setBaseSalary(Number(driver.base_salary))

    const [year, month] = selectedMonth.split('-').map(Number)

    // Check for a locked payroll entry
    const { data: e } = await supabase
      .from('payroll_entries')
      .select('base_salary, ot_total, allowance_total, pay_periods(year, month, status)')
      .eq('driver_id', driver.id)
      .eq('pay_periods.year', year)
      .eq('pay_periods.month', month)
      .single()

    if (e) {
      setEntry(e as unknown as Entry)
    } else {
      setEntry(null)
      // Live running totals for open month
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const end = `${year}-${String(month).padStart(2, '0')}-31`

      const { data: ots } = await supabase.from('ot_requests')
        .select('ot_amount').eq('driver_id', driver.id).eq('status', 'approved').gte('date', start).lte('date', end)
      setLiveOt((ots ?? []).reduce((s, r) => s + Number(r.ot_amount ?? 0), 0))

      const { data: claims } = await supabase.from('allowance_claims')
        .select('amount').eq('driver_id', driver.id).eq('status', 'approved').gte('date', start).lte('date', end)
      setLiveAllowances((claims ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0))
    }
  }, [supabase, selectedMonth])

  useEffect(() => { loadData() }, [loadData])

  const ot = entry ? Number(entry.ot_total) : liveOt
  const allowances = entry ? Number(entry.allowance_total) : liveAllowances
  const base = entry ? Number(entry.base_salary) : baseSalary
  const gross = base + ot + allowances
  const isLocked = entry?.pay_periods?.status === 'locked'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Payslip</h1>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {!driverId && <p className="text-sm text-gray-400">Loading…</p>}

      {driverId && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          {isLocked && (
            <div className="bg-green-50 border-b border-green-100 px-4 py-2 text-xs text-green-700 font-medium">
              Finalised payslip — month locked
            </div>
          )}
          {!isLocked && (
            <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2 text-xs text-yellow-700">
              Running total — month not yet finalised
            </div>
          )}

          <div className="divide-y">
            <Row label="Base Salary" amount={base} />
            <Row label="Overtime" amount={ot} />
            <Row label="Allowances" amount={allowances} />
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
              <span className="font-bold text-gray-900">Gross Pay</span>
              <span className="font-bold text-lg text-gray-900">RM {gross.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">RM {amount.toFixed(2)}</span>
    </div>
  )
}
