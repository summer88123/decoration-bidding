'use client'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api-client'
import { useState } from 'react'

interface RegisterForm {
  email: string
  password: string
  companyName: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<RegisterForm>()

  const onSubmit = async (data: RegisterForm) => {
    setError('')
    try {
      await apiClient.post('/api/auth/register', data)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } }
      setError(err.response?.data?.error?.message || '注册失败，请重试')
    }
  }

  if (success) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <p className="text-green-600 font-medium">注册成功！正在跳转到登录页...</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">创建账号</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">公司名称</label>
          <input
            {...register('companyName', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="香港装饰工程有限公司"
          />
        </div>
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
          <label className="block text-sm font-medium mb-1">密码（至少 8 位）</label>
          <input
            type="password"
            {...register('password', { required: true, minLength: 8 })}
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
          {isSubmitting ? '注册中...' : '注册'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        <a href="/login" className="text-blue-600 hover:underline">已有账号？登录</a>
      </div>
    </div>
  )
}
