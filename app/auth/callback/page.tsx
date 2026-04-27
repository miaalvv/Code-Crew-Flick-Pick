'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../_lib/supabaseClient'

export default function AuthCallback() {
    const router = useRouter()

    useEffect(() => {
        const handleAuth = async () => {
            const { error } = await supabase.auth.getSession()

            if (!error) {
                router.replace('/dashboard')
            } else {
                router.replace('/login')
            }
        }

        handleAuth()
    }, [router])

    return (
        <div className="flex items-center justify-center h-screen text-sm text-slate-400">
            Confirming your account...
        </div>
    )
}