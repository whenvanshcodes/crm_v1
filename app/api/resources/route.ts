import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireContext } from '@/lib/auth/context'
import { apiError } from '@/lib/http'
const input=z.object({name:z.string().trim().min(2).max(120),categoryId:z.string().uuid(),description:z.string().max(1000).optional()})
export async function GET(){try{const c=await requireContext();const db=await createClient();const {data,error}=await db.from('resources').select('*,resource_categories(name),pricing_rules(*)').eq('venue_id',c.venueId!).order('name');if(error)throw error;return NextResponse.json(data)}catch(error){return apiError(error)}}
export async function POST(request:Request){try{const c=await requireContext(['OWNER','MANAGER']);const body=input.parse(await request.json());const db=await createClient();const {data,error}=await db.from('resources').insert({venue_id:c.venueId!,name:body.name,category_id:body.categoryId,description:body.description}).select().single();if(error)throw error;return NextResponse.json(data,{status:201})}catch(error){return apiError(error)}}
