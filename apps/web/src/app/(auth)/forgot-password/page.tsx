'use client'
import { useForm } from 'react-hook-form'
import apiClient from '@/lib/api-client'
import { useState } from 'react'

interface ForgotForm {
  email: string
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ForgotForm>()

  const onSubmit = async (data: ForgotForm) => {
    setError('')
    try {
      await apiClient.post('/api/auth/forgot-password', data)
      setSent(true)
    } catch {
      setError('发送失败，请稍后重试')
    }
  }

  if (sent) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <p className="text-green-600 mb-4">
          如果该邮箱已注册，重置链接已发送，请查收邮件。
        </p>
        <a href="/login" className="text-blue-600 hover:underline text-sm">
          返回登录
        </a>
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">找回密码</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">注册邮箱</label>
          <input
            type="email"
            {...register('email', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? '发送中...' : '发送重置链接'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        <a href="/login" className="text-blue-600 hover:underline">返回登录</a>
      </div>
    </div>
  )
}
