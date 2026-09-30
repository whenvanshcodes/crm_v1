import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/http'
const venueInput=z.object({name:z.string().trim().min(2).max(160),phone:z.string().trim().min(6).max(32),email:z.string().email(),address:z.string().max(500).optional(),timezone:z.string().min(1).default('Asia/Kolkata')})
export async function GET(){try{await requireContext(['SUPER_ADMIN']);const db=await createClient();const {data,error}=await db.from('venues').select('id,name,phone,email,status,created_at').order('created_at',{ascending:false});if(error)throw error;return NextResponse.json(data)}catch(error){return apiError(error)}}
export async function POST(request:Request){try{await requireContext(['SUPER_ADMIN']);const body=venueInput.parse(await request.json());const db=await createClient();const {data,error}=await db.from('venues').insert(body).select().single();if(error)throw error;return NextResponse.json(data,{status:201})}catch(error){return apiError(error)}}
