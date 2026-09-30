import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST() { const db = await createClient(); await db.auth.signOut(); return NextResponse.json({ ok: true }) }
