import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, rate } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 })
    }

    // 1. Attempt to invite the user
    let { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

    // Handle "User already exists" scenario
    if (authError && authError.message.includes('already registered')) {
        // If they already exist, we need to find their ID so we can still update their profile
        const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        const foundUser = existingUser?.users.find(u => u.email === email)
        
        if (foundUser) {
            authData = { user: foundUser }
            authError = null // Clear the error, we have the user
        }
    }

    if (authError) {
      console.error("Auth Error:", authError.message)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Failed to retrieve user ID.' }, { status: 500 })
    }

    // 2. Upsert profile
    // IMPORTANT: Ensure these keys match your 'profiles' table columns exactly
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
      console.error("Database Error details:", dbError)
      return NextResponse.json({ error: 'Profile creation failed: ' + dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: authData.user })

  } catch (err: any) {
    console.error("Server Error:", err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}