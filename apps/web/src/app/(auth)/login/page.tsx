'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import type { User } from '@decoration-bidding/shared-types'
import { Loader2, AlertCircle } from 'lucide-react'

interface LoginForm {
  email: string
  password: string
}

const inputCls = 'w-full px-3 py-[5px] text-sm font-normal border border-[#d0d7de] rounded-[6px] bg-white text-[#1f2328] outline-none transition-[border-color,box-shadow] duration-75 focus:border-[#0969da] focus:ring-[3px] focus:ring-[rgba(9,105,218,0.3)]'

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
        '/api/auth/login', data,
      )
      setAuth(res.data.data.accessToken, res.data.data.user)
      const redirect = searchParams.get('redirect') || '/dashboard'
      router.push(redirect)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } }
      setError(err.response?.data?.error?.message || '邮箱或密码不正确，请重新输入。')
    }
  }

  return (
    <>
      {/* Logo area */}
      <div className="text-center mb-5">
        <div className="w-12 h-12 bg-[#24292f] rounded-[10px] inline-flex items-center justify-center mb-3">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <rect x="2" y="5" width="22" height="16" rx="3" stroke="white" strokeWidth="1.8"/>
            <path d="M7 10h12M7 14h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[#1f2328]">登录账号</h1>
      </div>

      {/* Form box */}
      <div className="bg-white border border-[#d0d7de] rounded-[6px] p-6 mb-3">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 bg-[#ffebe9] border border-[#ffcecb] rounded-[6px] px-3 py-2.5 mb-4 text-[13px] text-[#82071e]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="flex items-center justify-between text-[13px] font-semibold text-[#1f2328] mb-1.5">
              电子邮件地址
            </label>
            <input
              type="email"
              {...register('email', { required: true })}
              placeholder="name@company.com"
              autoComplete="email"
              className={inputCls}
            />
          </div>
          <div>
            <label className="flex items-center justify-between text-[13px] font-semibold text-[#1f2328] mb-1.5">
              密码
              <Link href="/forgot-password" className="text-xs font-normal text-[#0969da] hover:underline">
                忘记密码？
              </Link>
            </label>
            <input
              type="password"
              {...register('password', { required: true })}
              placeholder="输入密码"
              autoComplete="current-password"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-1.5 py-[5px] text-sm font-semibold bg-[#1f883d] hover:bg-[#1a7f37] text-white rounded-[6px] border border-[rgba(31,35,40,0.15)] shadow-[0_1px_0_rgba(31,35,40,0.1)] transition-colors disabled:opacity-60 mt-1"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            登录
          </button>
        </form>
      </div>

      {/* Register link */}
      <div className="bg-white border border-[#d0d7de] rounded-[6px] px-6 py-3.5 text-center text-[13px] text-[#656d76]">
        没有账号？<Link href="/register" className="text-[#0969da] hover:underline">注册并创建公司</Link>
      </div>
    </>
  )
}
