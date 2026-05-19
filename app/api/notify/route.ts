import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      creator_name,
      email,
      country,
      channel_url,
      free_entry_url,
      status,
    } = body;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const isWaitlist = status === 'waitlist';
    const subject = isWaitlist
      ? `[OXXOVO] New GENESIS waitlist signup — ${creator_name}`
      : `[OXXOVO] New GENESIS application — ${creator_name}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
        <h2 style="color: #8B22FF;">
          ${isWaitlist ? 'New GENESIS Waitlist Signup' : 'New GENESIS Application'}
        </h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 6px 0;"><strong>Creator</strong></td><td>${creator_name}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Email</strong></td><td>${email}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Country</strong></td><td>${country || '-'}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Channel</strong></td><td><a href="${channel_url}">${channel_url}</a></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Free Entry</strong></td><td><a href="${free_entry_url}">${free_entry_url}</a></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Status</strong></td><td>${status}</td></tr>
        </table>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OXXOVO GENESIS <genesis@oxxovo.com>',
        to: ['info@oxxovo.com'],
        reply_to: email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
