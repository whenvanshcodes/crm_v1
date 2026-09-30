'use client'

import React, { useState } from 'react'
import { Command, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('owner.a@parlour.local')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        return
      }

      window.location.assign(data.role === 'SUPER_ADMIN' ? '/super-admin' : '/dashboard')
    } catch {
      setError('Connection failed. Please verify local server is running.')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('demo1234')
    setError('')
  }

  return (
    <main className="login">
      <div className="login-card">
        <div className="brandmark">
          <Command size={22} />
        </div>
        <div className="eyebrow">PARLOUR CRM · LOCAL MVP</div>
        <h1>Welcome back.</h1>
        <p>Sign in to access your local venue management workspace.</p>

        {error && <div className="toast" style={{ position: 'relative', bottom: 'auto', right: 'auto', background: '#e53e3e', marginBottom: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="owner@venue.local"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="primary full" disabled={loading}>
            <span>{loading ? 'Signing in...' : 'Sign in to Venue'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="demo-hint" style={{ marginTop: '22px' }}>
          <div>
            <span className="live-dot" />
            <b>Quick Demo Accounts (Password: demo1234):</b>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              onClick={() => fillDemo('owner.a@parlour.local')}
            >
              Owner A (Café A)
            </button>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              onClick={() => fillDemo('owner.b@parlour.local')}
            >
              Owner B (Café B)
            </button>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              onClick={() => fillDemo('admin@parlour.local')}
            >
              Super Admin
            </button>
          </div>
        </div>
      </div>

      <div className="login-foot">
        LOCAL SQLITE MVP · TENANT ISOLATED <span>PARLOUR CRM 0.2.0</span>
      </div>
    </main>
  )
}
