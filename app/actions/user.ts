'use server'

import { createClient } from '@/lib/supabase-server' 
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers' // Add this import

export async function updateStaffProfile(formData: FormData) {
  // Debugging: Check if cookies exist at all
  const cookieStore = await cookies()
  console.log("Cookies found in Action:", cookieStore.getAll().map(c => c.name))

  const supabase = await createClient() 
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    console.error("Auth Error Object:", error); // Log the full error object
    return { error: 'Auth session missing! ' + (error?.message || 'No user found') }
  }
  
  // ... rest of your code
  
  // ... rest of your code stays the same

  const password = formData.get('password') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string
  const bank = formData.get('bank_account') as string
  const sortCode = formData.get('sort_code') as string

  // Update Password
  if (password && password.length >= 6) {
    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) return { error: authError.message }
  }

  // Update Profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone_number: phone,
      address: address,
      bank_account: bank,
      sort_code: sortCode,
      profile_completed: true
    })
    .eq('id', user.id)

  if (profileError) return { error: profileError.message }

  revalidatePath('/dashboard')
  return { success: true }
}