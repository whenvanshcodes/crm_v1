import { db } from '@/lib/db'

export async function listAuditLogs(venueId?: string) {
  return db.auditLog.findMany({
    where: venueId ? { venueId } : {},
    include: {
      actor: {
        select: { id: true, name: true, role: true, email: true }
      },
      venue: {
        select: { id: true, name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
}
