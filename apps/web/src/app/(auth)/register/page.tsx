'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import apiClient from '@/lib/api-client'

const schema = z.object({
  companyName: z.string().min(1, '公司名称不能为空'),
  email: z.string().email('请输入有效的电子邮件'),
  password: z.string().min(8, '密码至少 8 位'),
  passwordConfirm: z.string(),
}).refine(d => d.password === d.passwordConfirm, {
  message: '两次密码不一致',
  path: ['passwordConfirm'],
})
type RegisterForm = z.infer<typeof schema>

const inputCls = 'w-full px-3 py-[5px] text-sm border border-[#d0d7de] rounded-[6px] bg-white text-[#1f2328] outline-none transition-[border-color,box-shadow] duration-75 focus:border-[#0969da] focus:ring-[3px] focus:ring-[rgba(9,105,218,0.3)]'

function passwordStrength(pwd: string): { score: number; label: string } {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  const labels = ['', '弱', '一般', '中等', '强']
  return { score, label: labels[score] ?? '' }
}

const STRENGTH_COLOR = ['#eaeef2', '#cf222e', '#e3b341', '#0969da', '#1a7f37']

export default function RegisterPage() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [pwdValue, setPwdValue] = useState('')
  const [pwdConfirmValue, setPwdConfirmValue] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setError('')
    try {
      await apiClient.post('/api/auth/register', {
        companyName: data.companyName,
        email: data.email,
        password: data.password,
      })
      setRegisteredEmail(data.email)
      setSuccess(true)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } } }
      setError(err.response?.data?.error?.message || '注册失败，请重试')
    }
  }

  const { score, label } = passwordStrength(pwdValue)
  const pwdMatch = pwdConfirmValue ? pwdValue === pwdConfirmValue : null

  // Success screen
  if (success) {
    return (
      <>
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-[#24292f] rounded-[10px] inline-flex items-center justify-center mb-3">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="2" y="5" width="22" height="16" rx="3" stroke="white" strokeWidth="1.8"/>
              <path d="M7 10h12M7 14h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="bg-white border border-[#d0d7de] rounded-[6px] p-10 text-center mb-3">
          <div className="w-14 h-14 bg-[#dafbe1] rounded-full inline-flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 14l5.5 5.5L22 9" stroke="#1a7f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold text-[#1f2328] mb-2">验证邮件已发送</h2>
          <p className="text-sm text-[#656d76] leading-relaxed">
            我们已向 <strong className="text-[#1f2328]">{registeredEmail}</strong> 发送了验证邮件，<br/>
            请点击邮件中的链接激活账号后登录。
          </p>
          <p className="text-xs text-[#656d76] mt-3">
            未收到邮件？请检查垃圾邮件，或等待几分钟后{' '}
            <Link href="#" className="text-[#0969da] hover:underline">重新发送</Link>
          </p>
        </div>
        <div className="bg-white border border-[#d0d7de] rounded-[6px] px-6 py-3.5 text-center text-[13px] text-[#656d76]">
          <Link href="/login" className="text-[#0969da] hover:underline">前往登录</Link>
        </div>
      </>
    )
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
        <h1 className="text-xl font-semibold text-[#1f2328]">创建公司账号</h1>
      </div>

      {/* Form box */}
      <div className="bg-white border border-[#d0d7de] rounded-[6px] p-6 mb-3">
        {error && (
          <div className="bg-[#ffebe9] border border-[#ffcecb] rounded-[6px] px-3 py-2.5 mb-4 text-[13px] text-[#82071e]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Company section */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76] pb-2 border-b border-[#eaeef2]">
            公司信息
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#1f2328] block mb-1.5">
              公司名称 <span className="text-[#cf222e]">*</span>
            </label>
            <input
              {...register('companyName')}
              placeholder="例：ABC 装修工程有限公司"
              className={inputCls}
            />
            <p className="text-xs text-[#656d76] mt-1">注册后将成为该公司的管理员，公司名称可在设置中修改</p>
            {errors.companyName && <p className="text-xs text-[#cf222e] mt-1">{errors.companyName.message}</p>}
          </div>

          {/* Admin section */}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#656d76] pb-2 border-b border-[#eaeef2] mt-2">
            管理员信息
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#1f2328] block mb-1.5">
              电子邮件地址 <span className="text-[#cf222e]">*</span>
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="name@company.com"
              autoComplete="email"
              className={inputCls}
            />
            <p className="text-xs text-[#656d76] mt-1">将用于账号验证和登录，请使用公司邮箱</p>
            {errors.email && <p className="text-xs text-[#cf222e] mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#1f2328] block mb-1.5">
              密码 <span className="text-[#cf222e]">*</span>
            </label>
            <input
              type="password"
              {...register('password')}
              autoComplete="new-password"
              className={inputCls}
              onChange={e => setPwdValue(e.target.value)}
            />
            {/* Strength bar */}
            {pwdValue && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-1 flex-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-[3px] flex-1 rounded-sm transition-colors duration-200"
                      style={{ background: i <= score ? STRENGTH_COLOR[score] : '#eaeef2' }} />
                  ))}
                </div>
                <span className="text-[11px] text-[#656d76]">{label}</span>
              </div>
            )}
            {errors.password && <p className="text-xs text-[#cf222e] mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="text-[13px] font-semibold text-[#1f2328] block mb-1.5">
              确认密码 <span className="text-[#cf222e]">*</span>
            </label>
            <input
              type="password"
              {...register('passwordConfirm')}
              autoComplete="new-password"
              placeholder="再次输入密码"
              className={inputCls}
              onChange={e => setPwdConfirmValue(e.target.value)}
            />
            {pwdMatch === false && <p className="text-xs text-[#cf222e] mt-1">✗ 密码不一致</p>}
            {pwdMatch === true && <p className="text-xs text-[#1a7f37] mt-1">✓ 密码一致</p>}
            {errors.passwordConfirm && <p className="text-xs text-[#cf222e] mt-1">{errors.passwordConfirm.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-1.5 py-[5px] text-sm font-semibold bg-[#1f883d] hover:bg-[#1a7f37] text-white rounded-[6px] border border-[rgba(31,35,40,0.15)] shadow-[0_1px_0_rgba(31,35,40,0.1)] transition-colors disabled:opacity-60 mt-2"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            创建账号并发送验证邮件
          </button>
          <p className="text-xs text-[#656d76] text-center">
            注册即表示同意{' '}
            <Link href="#" className="text-[#0969da] hover:underline">服务条款</Link>
            {' '}与{' '}
            <Link href="#" className="text-[#0969da] hover:underline">隐私政策</Link>
          </p>
        </form>
      </div>

      {/* Login link */}
      <div className="bg-white border border-[#d0d7de] rounded-[6px] px-6 py-3.5 text-center text-[13px] text-[#656d76]">
        已有账号？<Link href="/login" className="text-[#0969da] hover:underline">立即登录</Link>
      </div>
    </>
  )
}
