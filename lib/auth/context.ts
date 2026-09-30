import { createClient } from '@/lib/supabase/server'

export type AppRole = 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'STAFF'
export type AuthContext = { userId: string; venueId: string | null; role: AppRole }
export async function requireContext(allowed?: AppRole[]): Promise<AuthContext> {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHORIZED')
  const { data: profile } = await supabase.from('profiles').select('venue_id,role,status').eq('id', user.id).single()
  if (!profile || profile.status !== 'ACTIVE') throw new Error('FORBIDDEN')
  const context = { userId: user.id, venueId: profile.venue_id, role: profile.role as AppRole }
  if (allowed && !allowed.includes(context.role)) throw new Error('FORBIDDEN')
  if (context.role !== 'SUPER_ADMIN' && !context.venueId) throw new Error('FORBIDDEN')
  return context
}
