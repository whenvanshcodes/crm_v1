import { NextResponse } from 'next/server'
import { requireContext } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/http'
export async function GET(){try{const c=await requireContext(['OWNER','MANAGER','RECEPTIONIST']);const db=await createClient();const start=new Date();start.setHours(0,0,0,0);const [{data:transactions,error},{count:sessions},{count:customers}]=await Promise.all([db.from('transactions').select('total,created_at').eq('venue_id',c.venueId!).gte('created_at',start.toISOString()),db.from('sessions').select('*',{count:'exact',head:true}).eq('venue_id',c.venueId!),db.from('customers').select('*',{count:'exact',head:true}).eq('venue_id',c.venueId!)]);if(error)throw error;const todayRevenue=(transactions??[]).reduce((sum,row)=>sum+Number(row.total),0);return NextResponse.json({todayRevenue,sessions:sessions??0,customers:customers??0})}catch(error){return apiError(error)}}
