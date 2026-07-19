'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '../../lib/supabase' 

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // 1. Initialize Supabase client
  const supabase = createClient() 
  
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/')
          return
        }

        // ONLY SELECT data here
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_set_password, profile_completed, enforce_details, role')
          .eq('id', session.user.id)
          .single()

        console.log('Gatekeeper sees profile:', profile)

        if (profile) {
          const needsPassword = !profile.has_set_password

          // 1. Your exact 4-tier hierarchy. 
          // Developer, Master, and Manager only need a password.
          // 'staff' is intentionally excluded, meaning they MUST fill out the form if enforced.
          const exemptRoles = ['developer', 'master', 'manager'] 

          // 2. Check if the current user's role has VIP bypass privileges
          const isExemptFromSetup = exemptRoles.includes(profile.role)

          // 3. The Rule: Enforce details ONLY if they are NOT exempt
          const detailsEnforcedByAdmin = !isExemptFromSetup && profile.enforce_details && !profile.profile_completed

          console.log("Gatekeeper Debug:", { 
            role: profile.role, 
            isExempt: isExemptFromSetup, 
            detailsEnforced: detailsEnforcedByAdmin 
          })

          // 4. Block access if not set up (and not already on the setup page)
          if ((needsPassword || detailsEnforcedByAdmin) && pathname !== '/dashboard/profile-setup') {
            router.push('/dashboard/profile-setup')
            return
          }
        }
      } catch (err) {
        console.error('Error checking user status', err)
      } finally {
        setLoading(false)
      }
    }

    checkUserStatus()
  }, [pathname, router, supabase]) // Added supabase to the dependency array

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-600 animate-pulse">Verifying credentials...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}