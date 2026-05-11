import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const key = 'sb_publishable_jqaYD8CyZLZLK3mpCPjHMQ_f79qUrjl'

    const res = await fetch('https://qrnkovokjmimagrwjebs.supabase.co/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ email, password })
    })

    const text = await res.text()
    console.log('SIGNUP STATUS:', res.status)
    console.log('SIGNUP RESPONSE:', text)

    if (!res.ok) {
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const data = JSON.parse(text)
    return NextResponse.json({ success: true, access_token: data.access_token })
  } catch (e) {
    console.log('SIGNUP ERROR:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}