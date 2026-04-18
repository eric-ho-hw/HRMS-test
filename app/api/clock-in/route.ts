import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { haversineMeters } from '@/lib/haversine'

export async function POST(req: NextRequest) {
  const { lat, lng, driverId } = await req.json()
  if (!lat || !lng || !driverId) {
    return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify driver belongs to this user
  const { data: driver } = await supabase
    .from('drivers')
    .select('id')
    .eq('id', driverId)
    .eq('profile_id', user.id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found.' }, { status: 403 })

  // Geofence check — any active location within radius
  const { data: locations } = await supabase
    .from('locations')
    .select('name, lat, lng, radius_m')
    .eq('is_active', true)

  if (!locations?.length) {
    return NextResponse.json({ error: 'No depot locations configured. Contact your manager.' }, { status: 400 })
  }

  type NearestLoc = { dist: number; name: string; lat: number; lng: number; radius_m: number }
  const nearest = locations.reduce<NearestLoc>((best, loc) => {
    const dist = haversineMeters(lat, lng, Number(loc.lat), Number(loc.lng))
    return dist < best.dist ? { name: loc.name, lat: Number(loc.lat), lng: Number(loc.lng), radius_m: loc.radius_m, dist } : best
  }, { dist: Infinity, name: '', lat: 0, lng: 0, radius_m: 100 })

  if (nearest.dist > nearest.radius_m) {
    const distM = Math.round(nearest.dist)
    return NextResponse.json({
      error: `You are ${distM} m from "${nearest.name}" (limit: ${nearest.radius_m} m). Move closer to clock in.`,
    }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('clockings').upsert({
    driver_id: driverId,
    date: today,
    clock_in: new Date().toISOString(),
    clock_in_lat: lat,
    clock_in_lng: lng,
    status: 'open',
  }, { onConflict: 'driver_id,date', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
