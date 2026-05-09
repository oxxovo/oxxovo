import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybmtvdm9ram1pbWFncndqZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTc1NzQsImV4cCI6MjA5MzgzMzU3NH0.9Hsq-_6DD9zwrYqj7Fqu5Ji48B1YzIEk2M3J9T6wHWQ'
    const res = await fetch('https://qrnkovokjmimagrwjebs.supabase.co/rest/v1/waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
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