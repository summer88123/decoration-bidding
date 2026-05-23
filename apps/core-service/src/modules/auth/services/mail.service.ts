import nodemailer from 'nodemailer'
import { config } from '../../../config.js'

// 是否已配置 SMTP（HOST 非默认占位值且有账号密码）
const smtpConfigured = !!(
  config.SMTP_HOST &&
  config.SMTP_HOST !== 'smtp.mailtrap.io' &&
  config.SMTP_USER &&
  config.SMTP_PASS
)

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,  // 465 端口使用 SSL，其他端口使用 STARTTLS
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
})

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!smtpConfigured) {
    console.warn('[MailService] SMTP 未配置，跳过发送重置密码邮件')
    return
  }
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: '重置您的密码',
    html: `<p>请点击以下链接重置密码（30分钟内有效）：</p>
           <a href="${resetUrl}">${resetUrl}</a>`,
  })
}

export async function sendInviteEmail(email: string, name: string, tempPassword: string): Promise<void> {
  if (!smtpConfigured) {
    console.warn('[MailService] SMTP 未配置，跳过发送邀请邮件')
    return
  }
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: '您已被邀请加入装饰投标系统',
    html: `
      <h2>您好，${name}</h2>
      <p>您已被邀请加入装饰投标辅助系统。</p>
      <p>请使用以下临时密码登录，登录后请立即修改密码：</p>
      <p><strong>邮箱：</strong>${email}</p>
      <p><strong>临时密码：</strong>${tempPassword}</p>
      <p><a href="${frontendUrl}/login">立即登录</a></p>
    `,
  })
}
