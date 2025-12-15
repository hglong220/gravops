'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import AuthForms from '../components/AuthForms'
import TechBackground from '../components/TechBackground'

type AuthView = 'login' | 'register' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<AuthView>('login')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) router.replace('/dashboard')
  }, [router])

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-x-hidden bg-white">
      <TechBackground />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-xl p-6">
          <AuthForms initialView={view} onViewChange={setView} />
        </div>

        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full mt-4 text-sm text-gray-500 hover:text-black hover:underline"
        >
          返回首页
        </button>
      </div>
    </main>
  )
}

