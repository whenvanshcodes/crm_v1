import { db } from '@/lib/db'
import { hash } from 'bcryptjs'
import type { LocalContext, Role } from '@/lib/auth/local'

const ALLOWED_STAFF_ROLES: Role[] = ['MANAGER', 'RECEPTIONIST', 'STAFF']

export async function listStaff(venueId: string) {
  return db.user.findMany({
    where: { venueId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  })
}

export async function createStaffMember(
  ctx: LocalContext,
  input: {
    name: string
    email: string
    phone?: string
    role: Role
    password?: string
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  if (!['OWNER', 'MANAGER'].includes(ctx.role)) throw new Error('FORBIDDEN')

  if (!ALLOWED_STAFF_ROLES.includes(input.role)) {
    throw new Error('VALIDATION_ERROR')
  }

  // Managers cannot create other managers or owners
  if (ctx.role === 'MANAGER' && input.role === 'MANAGER') {
    throw new Error('FORBIDDEN')
  }

  const email = input.email.toLowerCase().trim()
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) throw new Error('CONFLICT')

  const defaultPassword = input.password || 'demo1234'
  const passwordHash = await hash(defaultPassword, 12)

  const user = await db.user.create({
    data: {
      venueId: ctx.venueId,
      name: input.name.trim(),
      email,
      phone: input.phone?.trim(),
      role: input.role,
      status: 'ACTIVE',
      passwordHash
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true
    }
  })

  await db.auditLog.create({
    data: {
      venueId: ctx.venueId,
      actorId: ctx.userId,
      action: 'CREATE',
      entity: 'USER',
      entityId: user.id,
      newValue: JSON.stringify({ email: user.email, role: user.role })
    }
  })

  return user
}

export async function updateStaffMember(
  ctx: LocalContext,
  id: string,
  input: {
    name?: string
    role?: Role
    status?: 'ACTIVE' | 'INACTIVE'
  }
) {
  if (!ctx.venueId) throw new Error('FORBIDDEN')
  if (!['OWNER', 'MANAGER'].includes(ctx.role)) throw new Error('FORBIDDEN')

  const target = await db.user.findFirst({
    where: { id, venueId: ctx.venueId }
  })
  if (!target) throw new Error('NOT_FOUND')

  // Cannot modify owners unless you are an owner
  if (target.role === 'OWNER' && ctx.role !== 'OWNER') {
    throw new Error('FORBIDDEN')
  }

  if (input.role && !ALLOWED_STAFF_ROLES.includes(input.role)) {
    throw new Error('VALIDATION_ERROR')
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {})
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true
    }
  })

  await db.auditLog.create({
    data: {
      venueId: ctx.venueId,
      actorId: ctx.userId,
      action: 'UPDATE',
      entity: 'USER',
      entityId: id,
      newValue: JSON.stringify(input)
    }
  })

  return updated
}
