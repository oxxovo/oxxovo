import { NextResponse } from 'next/server';
import {
  getCurrentSeason,
  formatAiProviderList,
  formatPanelLabel,
} from '@/lib/seasons';

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

    const season = await getCurrentSeason();
    const seasonName = season?.name ?? 'GENESIS';
    const capacity = season ? season.max_applicants.toLocaleString() : '500';
    const topN = season?.top_n_advance ?? 50;
    const panelLabel = season ? formatPanelLabel(season.ai_models) : 'multi-AI';
    const providerList = season ? formatAiProviderList(season.ai_models) : 'multiple AI providers';

    const isWaitlist = status === 'waitlist';
    // FROM email address is DNS-bound infra (Cloudflare Email Routing + Resend
    // domain verification, configured in 옥소보 5). Display name reflects current season.
    const FROM = `OXXOVO ${seasonName} <info@oxxovo.com>`;

    const sendEmail = (
      to: string,
      subject: string,
      html: string,
      replyTo?: string
    ) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          subject,
          html,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
      });

    // ── ① 운영자(TK)에게 보내는 신청 알림 ──
    const adminSubject = isWaitlist
      ? `[OXXOVO] New ${seasonName} waitlist signup — ${creator_name}`
      : `[OXXOVO] New ${seasonName} application — ${creator_name}`;

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
        <h2 style="color: #8B22FF;">
          ${isWaitlist ? `New ${seasonName} Waitlist Signup` : `New ${seasonName} Application`}
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

    // ── ② 신청자 본인에게 보내는 접수 확인 ──
    const applicantSubject = isWaitlist
      ? `OXXOVO ${seasonName} — You're on the waitlist`
      : `OXXOVO ${seasonName} — Application received`;

    const applicantHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a; line-height: 1.6;">
        <div style="font-size: 22px; font-weight: 800; color: #8B22FF; letter-spacing: 1px;">
          OXXOVO
        </div>
        <div style="height: 2px; background: #8B22FF; margin: 14px 0 24px;"></div>
        <h2 style="font-size: 20px; margin: 0 0 16px;">
          ${isWaitlist ? "You're on the waitlist" : 'Application received'}
        </h2>
        <p style="margin: 0 0 14px;">Hi ${creator_name},</p>
        ${
          isWaitlist
            ? `<p style="margin: 0 0 14px;">${seasonName} has reached its ${capacity}-applicant capacity, so you've been added to the waitlist.</p>
               <p style="margin: 0 0 14px;">If a spot opens or a new round is added, waitlisted creators are first in line — and we'll reach out at this email address.</p>`
            : `<p style="margin: 0 0 14px;">Thanks for entering OXXOVO ${seasonName} — a verified AI creation tournament.</p>
               <p style="margin: 0 0 14px;">Your entry has been received. Our ${panelLabel} system (${providerList}) reviews every submission, and the top ${topN} creators advance as Founding Creators.</p>
               <p style="margin: 0 0 14px;">We'll reach out at this email address with the results.</p>`
        }
        <p style="margin: 24px 0 0; color: #666;">— The OXXOVO Team</p>
        <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
          OXXOVO Labs Inc. · Las Vegas, Nevada, USA · oxxovo.com
        </div>
      </div>
    `;

    // 둘 다 발송 — 하나가 실패해도 다른 하나는 진행
    await Promise.allSettled([
      sendEmail('info@oxxovo.com', adminSubject, adminHtml, email),
      sendEmail(email, applicantSubject, applicantHtml),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
