import { createClient } from '@/lib/supabase/server'

type Driver = {
  id: string
  employee_no: string
  profiles: { full_name: string } | null
}

type Clocking = {
  driver_id: string
  clock_in: string
  status: string
}

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: driversRaw }, { data: clockingsRaw }] = await Promise.all([
    supabase.from('drivers').select('id, employee_no, profiles(full_name)').eq('is_active', true).order('employee_no'),
    supabase.from('clockings').select('driver_id, clock_in, status').eq('date', today),
  ])

  const drivers = (driversRaw ?? []) as unknown as Driver[]
  const clockings = (clockingsRaw ?? []) as Clocking[]

  const clockMap = new Map<string, Clocking>()
  clockings.forEach(c => clockMap.set(c.driver_id, c))

  const clocked = drivers.filter(d => clockMap.has(d.id))
  const notClocked = drivers.filter(d => !clockMap.has(d.id))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Today&apos;s Attendance</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Drivers" value={(drivers ?? []).length} color="bg-blue-50 text-blue-700" />
        <StatCard label="Clocked In" value={clocked.length} color="bg-green-50 text-green-700" />
        <StatCard label="Not Yet In" value={notClocked.length} color="bg-red-50 text-red-700" />
      </div>

      {/* Clocked-in grid */}
      {clocked.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Clocked In</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {clocked.map(d => {
              const c = clockMap.get(d.id)!
              return (
                <DriverCard
                  key={d.id}
                  name={d.profiles?.full_name ?? d.employee_no}
                  empNo={d.employee_no}
                  clockIn={c.clock_in}
                  status={c.status}
                  active
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Not clocked in */}
      {notClocked.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Not Yet Clocked In</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {notClocked.map(d => (
              <DriverCard
                key={d.id}
                name={d.profiles?.full_name ?? d.employee_no}
                empNo={d.employee_no}
                active={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  )
}

function DriverCard({ name, empNo, clockIn, status, active }: {
  name: string; empNo: string; clockIn?: string; status?: string; active: boolean
}) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
      <p className="text-xs text-gray-400">{empNo}</p>
      {active && clockIn && (
        <p className="text-xs font-medium text-green-700">
          In {new Date(clockIn).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
          {status === 'closed' && ' · Done'}
        </p>
      )}
      {!active && <p className="text-xs text-gray-400">—</p>}
    </div>
  )
}
