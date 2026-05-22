'use client'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import type { User } from '@decoration-bidding/shared-types'
import { useState } from 'react'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setError('')
    try {
      const res = await apiClient.post<{ data: { accessToken: string; user: User } }>(
        '/api/auth/login',
        data,
      )
      setAuth(res.data.data.accessToken, res.data.data.user)
      const redirect = searchParams.get('redirect') || '/dashboard'
      router.push(redirect)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } }
      setError(err.response?.data?.error?.message || '登录失败，请检查邮箱和密码')
    }
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">登录</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">邮箱</label>
          <input
            type="email"
            {...register('email', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">密码</label>
          <input
            type="password"
            {...register('password', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? '登录中...' : '登录'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm space-y-1">
        <a href="/forgot-password" className="text-blue-600 hover:underline block">
          忘记密码？
        </a>
        <a href="/register" className="text-blue-600 hover:underline block">
          没有账号？立即注册
        </a>
      </div>
    </div>
  )
}
