import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/** Generate a random 10-char password: letters + digits */
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  // Verify the caller is a boss
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'boss') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, phone, employee_no, base_salary, shift_start, shift_end } = await req.json()

  if (!full_name || !employee_no || !base_salary) {
    return NextResponse.json({ error: 'Full name, employee number, and base salary are required.' }, { status: 400 })
  }

  // Service role key never leaves the server
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // If no email provided, generate a placeholder so Supabase Auth is happy.
  // The driver will log in with this placeholder — share it with them.
  const loginEmail = email?.trim()
    ? email.trim().toLowerCase()
    : `${employee_no.trim().toLowerCase().replace(/\s+/g, '-')}@no-email.fourbeans`

  const tempPassword = generatePassword()

  // Create the user directly (no invite email)
  const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
    email: loginEmail,
    password: tempPassword,
    email_confirm: true,        // skip email confirmation step
    user_metadata: { full_name, phone: phone ?? '' },
    app_metadata: { role: 'driver' },
  })

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  const profileId = createData.user.id

  // Insert driver record (profile row is created by the DB trigger on auth.users insert)
  const { error: driverErr } = await supabase.from('drivers').insert({
    profile_id: profileId,
    employee_no,
    base_salary: Number(base_salary),
    shift_start: shift_start || '08:00',
    shift_end: shift_end || '17:00',
  })

  if (driverErr) {
    // Roll back the auth user so we don't leave orphaned accounts
    await adminClient.auth.admin.deleteUser(profileId)
    return NextResponse.json({ error: driverErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, loginEmail, tempPassword })
}
