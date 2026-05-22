import nodemailer from 'nodemailer'
import { config } from '../../../config.js'

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
})

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: '重置您的密码',
    html: `<p>请点击以下链接重置密码（30分钟内有效）：</p>
           <a href="${resetUrl}">${resetUrl}</a>`,
  })
}

export async function sendInviteEmail(email: string, name: string, tempPassword: string): Promise<void> {
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
