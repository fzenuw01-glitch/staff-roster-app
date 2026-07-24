import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, rate } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    let userId: string | undefined
    const tempPassword = 'TempPassword123!'

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const foundUser = existingUsers?.users.find(u => u.email === email)

    if (foundUser) {
      userId = foundUser.id
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      userId = authData.user?.id

      // Send the email automatically using Resend
      await resend.emails.send({
        from: 'Staff Roster <onboarding@resend.dev>', // Update with your verified domain later
        to: email,
        subject: 'Your Staff Roster Account Details',
        html: `<p>Hi ${name},</p><p>Your account has been created. You can log in using your email and this temporary password: <strong>${tempPassword}</strong></p><p>Please change your password after logging in.</p>`
      })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to retrieve or create user ID.' }, { status: 500 })
    }

    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: name,
        email: email,
        hourly_rate: rate,
        role: 'staff',
      })

    if (dbError) {
      return NextResponse.json({ error: 'Profile creation failed: ' + dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Staff account created and email sent.' })

  } catch (err: any) {
    console.error("Server Error:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}