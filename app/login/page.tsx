'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
export default function Login() { const [error,setError]=useState(''); async function login(formData: FormData) { const db=createClient(); const { error }=await db.auth.signInWithPassword({email:String(formData.get('email')),password:String(formData.get('password'))}); if(error){setError(error.message);return} window.location.assign('/dashboard') } return <main className="login"><form action={login}><p className="eyebrow">PARLOUR MANAGEMENT</p><h1>Welcome back.</h1><label>Email<input name="email" type="email" required /></label><label>Password<input name="password" type="password" required /></label>{error&&<p className="error">{error}</p>}<button>Sign in</button></form></main> }
