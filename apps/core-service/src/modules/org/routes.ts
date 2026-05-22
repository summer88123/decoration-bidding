// apps/core-service/src/modules/org/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import { ZodError } from 'zod'
import { OrgError } from './services/org.service.js'
import { getCompanyHandler, updateCompanyHandler } from './handlers/company.handler.js'
import {
  listMembersHandler,
  inviteMemberHandler,
  updateMemberHandler,
  deleteMemberHandler,
} from './handlers/member.handler.js'
import {
  listMaterialsHandler,
  createMaterialHandler,
  updateMaterialHandler,
  deleteMaterialHandler,
  importMaterialsHandler,
} from './handlers/material.handler.js'
import { requireAuth, requireRole } from '../../shared/middleware/auth.js'

export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof OrgError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      })
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message ?? '输入验证失败' },
      })
    }
    app.log.error(error)
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
    })
  })

  // Company
  app.get('/org/company', { preHandler: [requireAuth] }, getCompanyHandler)
  app.put('/org/company', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN'])] }, updateCompanyHandler)

  // Members
  app.get('/org/members', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, listMembersHandler)
  app.post('/org/members/invite', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN'])] }, inviteMemberHandler)
  app.put('/org/members/:userId', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN'])] }, updateMemberHandler as any)
  app.delete('/org/members/:userId', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN'])] }, deleteMemberHandler as any)

  // Materials
  app.get('/org/materials', { preHandler: [requireAuth] }, listMaterialsHandler)
  app.post('/org/materials', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, createMaterialHandler)
  app.put('/org/materials/:id', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, updateMaterialHandler as any)
  app.delete('/org/materials/:id', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN'])] }, deleteMaterialHandler as any)
  app.post('/org/materials/import', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, importMaterialsHandler)
}
