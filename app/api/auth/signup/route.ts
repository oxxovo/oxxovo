import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const key = 'sb_publishable_jqaYD8CyZLZLK3mpCPjHMQ_f79qUrjl'
    
    const res = await fetch('https://qrnkovokjmimagrwjebs.supabase.co/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.message || 'Login failed' }, { status: 400 })
    }

    return NextResponse.json({ success: true, access_token: data.access_token })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}