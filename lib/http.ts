import { NextResponse } from 'next/server'
export function apiError(error: unknown) { const message = error instanceof Error ? error.message : 'INTERNAL_ERROR'; const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500; return NextResponse.json({ error: status === 500 ? 'Request could not be completed.' : message }, { status }) }
