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
