import { prisma } from '@decoration-bidding/database'

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { role: true },
  })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true },
  })
}

export async function createUser(data: {
  email: string
  passwordHash: string
  companyId: string
  roleId: string
  name?: string
  phone?: string
}) {
  return prisma.user.create({ data, include: { role: true } })
}

export async function saveRefreshToken(data: {
  jti: string
  userId: string
  expiresAt: Date
}) {
  return prisma.refreshToken.create({ data })
}

export async function findRefreshToken(jti: string) {
  return prisma.refreshToken.findUnique({ where: { jti } })
}

export async function deleteRefreshToken(jti: string) {
  return prisma.refreshToken.delete({ where: { jti } })
}

export async function savePasswordResetToken(data: {
  token: string
  userId: string
  expiresAt: Date
}) {
  return prisma.passwordResetToken.create({ data })
}

export async function findPasswordResetToken(token: string) {
  return prisma.passwordResetToken.findUnique({ where: { token } })
}

export async function markPasswordResetTokenUsed(id: string) {
  return prisma.passwordResetToken.update({ where: { id }, data: { used: true } })
}

export async function updateUserPassword(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } })
}
