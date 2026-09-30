import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkCredentials, createLocalSession, sessionCookie } from '@/lib/auth/local'
export async function POST(request:Request){const parsed=z.object({email:z.string().email(),password:z.string().min(1)}).safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Invalid credentials.'},{status:422});const user=await checkCredentials(parsed.data.email,parsed.data.password);if(!user)return NextResponse.json({error:'Invalid email or password.'},{status:401});const session=await createLocalSession(user.id);const response=NextResponse.json({role:user.role});response.cookies.set(sessionCookie.name,session.id,sessionCookie.options);return response}
