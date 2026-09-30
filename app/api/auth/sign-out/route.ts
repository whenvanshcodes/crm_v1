import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeLocalSession, sessionCookie } from '@/lib/auth/local'
export async function POST() { await revokeLocalSession((await cookies()).get(sessionCookie.name)?.value); const response=NextResponse.json({ok:true}); response.cookies.set(sessionCookie.name,'',{...sessionCookie.options,maxAge:0}); return response }
