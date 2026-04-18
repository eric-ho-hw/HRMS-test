'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Save, Trash2, Loader2 } from 'lucide-react'

type Location = { id: string; name: string; lat: number; lng: number; radius_m: number; is_active: boolean }
type Rate = { id: string; type: string; amount: number }

export default function SettingsPage() {
  const supabase = createClient()
  const [rates, setRates] = useState<Rate[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [savingRate, setSavingRate] = useState<string | null>(null)
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({})

  const [newLoc, setNewLoc] = useState({ name: '', lat: '', lng: '', radius_m: '100' })
  const [addingLoc, setAddingLoc] = useState(false)
  const [locError, setLocError] = useState('')

  const load = useCallback(async () => {
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from('allowance_rates').select('*'),
      supabase.from('locations').select('*').order('name'),
    ])
    setRates(r ?? [])
    const edits: Record<string, string> = {}
    r?.forEach(rt => { edits[rt.id] = String(rt.amount) })
    setRateEdits(edits)
    setLocations(l ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function saveRate(id: string) {
    setSavingRate(id)
    await supabase.from('allowance_rates').update({ amount: Number(rateEdits[id]) }).eq('id', id)
    setSavingRate(null)
    await load()
  }

  async function addLocation() {
    setLocError(''); setAddingLoc(true)
    if (!newLoc.name || !newLoc.lat || !newLoc.lng) { setLocError('Name, latitude, and longitude are required.'); setAddingLoc(false); return }
    const { error } = await supabase.from('locations').insert({
      name: newLoc.name,
      lat: Number(newLoc.lat),
      lng: Number(newLoc.lng),
      radius_m: Number(newLoc.radius_m),
    })
    if (error) setLocError(error.message)
    else { setNewLoc({ name: '', lat: '', lng: '', radius_m: '100' }); await load() }
    setAddingLoc(false)
  }

  async function toggleLocation(loc: Location) {
    await supabase.from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    await load()
  }

  async function deleteLocation(id: string) {
    await supabase.from('locations').delete().eq('id', id)
    await load()
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Allowance Rates */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Allowance Rates</h2>
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          {rates.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <span className="text-sm font-medium text-gray-800 capitalize w-28">{r.type}</span>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-gray-500">RM</span>
                <input type="number" value={rateEdits[r.id] ?? ''} min={0} step={0.5}
                  onChange={e => setRateEdits(p => ({ ...p, [r.id]: e.target.value }))}
                  className="w-28 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-sm text-gray-400">per day / night</span>
              </div>
              <button onClick={() => saveRate(r.id)} disabled={savingRate === r.id}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                {savingRate === r.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Geofence Locations */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Depot / Job Site Locations</h2>
        <p className="text-xs text-gray-500">Drivers must be within the radius to clock in.</p>

        <div className="space-y-2">
          {locations.map(loc => (
            <div key={loc.id} className={`bg-white rounded-xl border p-3 flex items-center justify-between gap-3 ${!loc.is_active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                <p className="text-xs text-gray-400">{loc.lat}, {loc.lng} · {loc.radius_m} m</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleLocation(loc)}
                  className={`text-xs font-medium px-2 py-1 rounded-full ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {loc.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => deleteLocation(loc.id)}
                  className="text-red-400 hover:text-red-600 p-1 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add new location */}
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Add Location</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input value={newLoc.name} onChange={e => setNewLoc(p => ({ ...p, name: e.target.value }))} placeholder="Main Depot"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
              <input type="number" step="any" value={newLoc.lat} onChange={e => setNewLoc(p => ({ ...p, lat: e.target.value }))} placeholder="3.1390"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
              <input type="number" step="any" value={newLoc.lng} onChange={e => setNewLoc(p => ({ ...p, lng: e.target.value }))} placeholder="101.6869"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Radius (m)</label>
              <input type="number" value={newLoc.radius_m} onChange={e => setNewLoc(p => ({ ...p, radius_m: e.target.value }))} min={50}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {locError && <p className="text-sm text-red-600">{locError}</p>}
          <button onClick={addLocation} disabled={addingLoc}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {addingLoc ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Location
          </button>
        </div>
      </section>
    </div>
  )
}
