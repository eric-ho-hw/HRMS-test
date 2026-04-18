'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Clock, LogIn, LogOut, Loader2 } from 'lucide-react'

type Clocking = {
  id: string
  clock_in: string | null
  clock_out: string | null
  status: 'open' | 'closed'
}

export default function ClockPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [clocking, setClocking] = useState<Clocking | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [driverId, setDriverId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const loadDriverAndClocking = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (!driver) return
    setDriverId(driver.id)

    const { data: existing } = await supabase
      .from('clockings')
      .select('id, clock_in, clock_out, status')
      .eq('driver_id', driver.id)
      .eq('date', today)
      .single()

    setClocking(existing ?? null)
  }, [supabase, today])

  useEffect(() => { loadDriverAndClocking() }, [loadDriverAndClocking])

  // Update elapsed time every minute while clocked in
  useEffect(() => {
    if (!clocking?.clock_in || clocking.status === 'closed') {
      setElapsed('')
      return
    }
    const update = () => {
      const diff = Date.now() - new Date(clocking.clock_in!).getTime()
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      setElapsed(`${h}h ${m}m`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [clocking])

  async function getPosition(): Promise<GeolocationCoordinates> {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(p => resolve(p.coords), reject, {
        enableHighAccuracy: true,
        timeout: 10_000,
      })
    )
  }

  async function handleClockIn() {
    setError(''); setSuccess(''); setLocating(true)
    let coords: GeolocationCoordinates
    try { coords = await getPosition() }
    catch { setError('Could not get your location. Enable GPS and try again.'); setLocating(false); return }
    setLocating(false); setLoading(true)

    const res = await fetch('/api/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude, driverId }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setLoading(false); return }

    setSuccess('Clocked in successfully!')
    await loadDriverAndClocking()
    setLoading(false)
  }

  async function handleClockOut() {
    setError(''); setSuccess(''); setLocating(true)
    let coords: GeolocationCoordinates
    try { coords = await getPosition() }
    catch { setError('Could not get your location.'); setLocating(false); return }
    setLocating(false); setLoading(true)

    const { error } = await supabase
      .from('clockings')
      .update({
        clock_out: new Date().toISOString(),
        clock_out_lat: coords.latitude,
        clock_out_lng: coords.longitude,
        status: 'closed',
      })
      .eq('id', clocking!.id)

    if (error) { setError(error.message); setLoading(false); return }
    setSuccess('Clocked out. Have a good rest!')
    await loadDriverAndClocking()
    setLoading(false)
  }

  const isClockedIn = clocking?.status === 'open' && clocking.clock_in
  const isDone = clocking?.status === 'closed'

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Attendance</h1>

      {/* Status card */}
      <div className={`rounded-2xl p-6 text-center space-y-1 ${isClockedIn ? 'bg-green-50 border border-green-200' : isDone ? 'bg-gray-100' : 'bg-blue-50 border border-blue-200'}`}>
        <div className={`inline-flex items-center gap-2 text-sm font-medium ${isClockedIn ? 'text-green-700' : isDone ? 'text-gray-500' : 'text-blue-700'}`}>
          <Clock size={16} />
          {isClockedIn ? 'Clocked In' : isDone ? 'Shift Complete' : 'Not Clocked In'}
        </div>
        {isClockedIn && clocking?.clock_in && (
          <p className="text-2xl font-bold text-green-800">
            {new Date(clocking.clock_in).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {isClockedIn && elapsed && <p className="text-sm text-green-600">{elapsed} elapsed</p>}
        {isDone && clocking?.clock_in && clocking?.clock_out && (
          <p className="text-sm text-gray-600">
            {new Date(clocking.clock_in).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {new Date(clocking.clock_out).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Action button */}
      {!isDone && (
        <button
          onClick={isClockedIn ? handleClockOut : handleClockIn}
          disabled={loading || locating || !driverId}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-lg transition disabled:opacity-50 ${isClockedIn ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {(loading || locating) ? (
            <><Loader2 size={20} className="animate-spin" />{locating ? 'Getting location…' : 'Processing…'}</>
          ) : isClockedIn ? (
            <><LogOut size={20} />Clock Out</>
          ) : (
            <><LogIn size={20} />Clock In</>
          )}
        </button>
      )}

      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <MapPin size={12} />
        <span>GPS location is required to clock in/out (100 m from depot)</span>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2">{success}</p>}
    </div>
  )
}
