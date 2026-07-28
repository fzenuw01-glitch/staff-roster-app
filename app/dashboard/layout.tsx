'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase' 

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('has_set_password, profile_completed, enforce_details, role')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          const needsPassword = !profile.has_set_password
          const exemptRoles = ['developer', 'master', 'manager'] 
          const isExemptFromSetup = exemptRoles.includes(profile.role)
          
          const detailsEnforcedByAdmin = !isExemptFromSetup && profile.enforce_details && !profile.profile_completed

          if ((needsPassword || detailsEnforcedByAdmin) && pathname !== '/dashboard/profile-setup') {
            // Check if they only need a password, or if full details are being enforced
            if (detailsEnforcedByAdmin) {
              router.push('/dashboard/profile-setup?enforced=true')
            } else {
              router.push('/dashboard/profile-setup')
            }
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
  }, [pathname, router, supabase]) 

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