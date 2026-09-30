import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { customerInput } from '@/lib/validation/customers'
import { apiError } from '@/lib/http'

export async function GET(request: Request) { try { const context = await requireContext(); const q = new URL(request.url).searchParams.get('phone'); const db = await createClient(); let query = db.from('customers').select('*').eq('venue_id', context.venueId!).order('created_at', { ascending: false }); if (q) query = query.eq('phone', q.replace(/\D/g, '')); const { data, error } = await query; if (error) throw error; return NextResponse.json(data) } catch (error) { return apiError(error) } }
export async function POST(request: Request) { try { const context = await requireContext(['OWNER','MANAGER','RECEPTIONIST','STAFF']); const input = customerInput.parse(await request.json()); const db = await createClient(); const { data, error } = await db.from('customers').insert({ venue_id: context.venueId!, name: input.name, phone: input.phone.replace(/\D/g, '') }).select().single(); if (error) return NextResponse.json({ error: error.code === '23505' ? 'Customer already exists.' : 'Unable to create customer.' }, { status: error.code === '23505' ? 409 : 400 }); return NextResponse.json(data, { status: 201 }) } catch (error) { return apiError(error) } }
