import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const key = 'sb_publishable_jqaYD8CyZLZLK3mpCPjHMQ_f79qUrjl'
    const res = await fetch('https://qrnkovokjmimagrwjebs.supabase.co/rest/v1/waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ email })
    })
    const text = await res.text()
    console.log('STATUS:', res.status)
    console.log('RESPONSE:', text)
    if (res.ok) return NextResponse.json({ success: true })
    return NextResponse.json({ error: text }, { status: 500 })
  } catch (e) {
    console.log('ERROR:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}