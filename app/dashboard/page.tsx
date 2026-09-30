import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireContext } from '@/lib/auth/context'

export default async function Dashboard() {
  try { const context=await requireContext(); if(context.role==='SUPER_ADMIN') redirect('/super-admin'); const db=await createClient(); const [{count: customers},{count: activeSessions},{count: availableResources},{count: upcomingBookings}] = await Promise.all([db.from('customers').select('*',{count:'exact',head:true}).eq('venue_id',context.venueId!),db.from('sessions').select('*',{count:'exact',head:true}).eq('venue_id',context.venueId!).eq('status','ACTIVE'),db.from('resources').select('*',{count:'exact',head:true}).eq('venue_id',context.venueId!).eq('status','AVAILABLE'),db.from('bookings').select('*',{count:'exact',head:true}).eq('venue_id',context.venueId!).gte('start_time',new Date().toISOString()).in('status',['SCHEDULED','CONFIRMED'])]); return <main className="dashboard"><p className="eyebrow">VENUE OVERVIEW</p><h1>Dashboard</h1><p className="subtle">Your venue’s current activity.</p><section className="metrics"><Metric label="Customers" value={customers ?? 0}/><Metric label="Active sessions" value={activeSessions ?? 0}/><Metric label="Available resources" value={availableResources ?? 0}/><Metric label="Upcoming bookings" value={upcomingBookings ?? 0}/></section></main> } catch { redirect('/login') }
}
function Metric({label,value}:{label:string;value:number}) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article> }
