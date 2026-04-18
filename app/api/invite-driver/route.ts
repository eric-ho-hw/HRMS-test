import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Verify the caller is a boss
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'boss') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, phone, employee_no, base_salary, shift_start, shift_end } = await req.json()

  if (!email || !full_name || !employee_no || !base_salary) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Service role key never leaves the server
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Invite by email — driver receives a link to set their own password
  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name, phone },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin}/login`,
  })

  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })

  const profileId = inviteData.user.id

  // Set role in app_metadata
  await adminClient.auth.admin.updateUserById(profileId, {
    app_metadata: { role: 'driver' },
    user_metadata: { full_name, phone },
  })

  // Insert driver record (profile row is created by the DB trigger on auth.users insert)
  const { error: driverErr } = await supabase.from('drivers').insert({
    profile_id: profileId,
    employee_no,
    base_salary: Number(base_salary),
    shift_start,
    shift_end,
  })

  if (driverErr) return NextResponse.json({ error: driverErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
