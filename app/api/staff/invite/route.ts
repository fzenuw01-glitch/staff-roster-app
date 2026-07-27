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
    const { name, email, rate, action } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    let userId: string | undefined

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const foundUser = existingUsers?.users.find(u => u.email === email)

    if (foundUser) {
      userId = foundUser.id
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      userId = authData.user?.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to retrieve or create user ID.' }, { status: 500 })
    }

    // Generate a recovery/invite magic link that works whether the user is new or already exists
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/profile-setup`,
      },
    })

    if (linkError || !linkData) {
      return NextResponse.json({ error: 'Failed to generate link: ' + linkError?.message }, { status: 500 })
    }

    const inviteUrl = linkData.properties.action_link

    const subjectLine = action === 'resend' ? 'Your Resent Staff Roster Invitation' : 'Your Staff Roster Account Invitation'
    
    await resend.emails.send({
      from: 'Staff Roster <onboarding@hawanipms.com>',
      to: email,
      subject: subjectLine,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${name},</h2>
          <p>You have been invited to join the Staff Roster & Wages Dashboard.</p>
          <p>Please click the button below to access your account, set your password, and complete your profile setup:</p>
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation & Setup Profile</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #64748b; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
        </div>
      `
    })

    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: name,
        email: email,
        hourly_rate: rate,
        role: 'staff',
        is_profile_complete: false,
      }, { onConflict: 'id' })

    if (dbError) {
      return NextResponse.json({ error: 'Profile creation failed: ' + dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Staff account processed and invite email sent successfully.' })

  } catch (err: any) {
    console.error("Server Error:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}