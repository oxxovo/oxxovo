'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FormState = {
  creator_name: string;
  email: string;
  country: string;
  channel_url: string;
  free_entry_url: string;
  agreed_to_rules: boolean;
};

export default function ApplyPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    creator_name: '',
    email: '',
    country: '',
    channel_url: '',
    free_entry_url: '',
    agreed_to_rules: false,
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setError(null);

    if (!form.creator_name.trim() || !form.email.trim()) {
      setError('Creator name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!form.channel_url.trim()) {
      setError('Please provide your public creator channel URL.');
      return;
    }
    if (!form.free_entry_url.trim()) {
      setError('Please provide your Free Entry video URL.');
      return;
    }
    if (!form.agreed_to_rules) {
      setError('You must agree to the Official Rulebook to apply.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: dbError } = await supabase
        .from('genesis_applications')
        .insert({
          creator_name: form.creator_name.trim(),
          email: form.email.trim().toLowerCase(),
          country: form.country.trim() || null,
          channel_url: form.channel_url.trim(),
          free_entry_url: form.free_entry_url.trim(),
          agreed_to_rules: form.agreed_to_rules,
        });

      if (dbError) {
        if (dbError.code === '23505') {
          throw new Error('This email has already submitted an application.');
        }
        throw new Error(dbError.message);
      }
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            APPLICATION RECEIVED
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
            You&apos;ve entered.
          </h1>
          <p className="text-white/60 leading-relaxed mb-8">
            Your Free Entry is now part of the OXXOVO GENESIS archive.
            Our Triple-AI system will review your submission, and we&apos;ll
            be in touch through the email you provided.
          </p>
          <p className="text-white/40 text-sm italic">
            The arena reveals winners.
          </p>
          <Link
            href="/"
            className="inline-block mt-12 text-xs tracking-[0.2em] text-[#8B22FF] hover:text-white transition"
          >
            ← BACK TO OXXOVO
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-16 md:pt-32 md:pb-20 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">
            SEASON 0 — GENESIS — FREE LAUNCH TOURNAMENT
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.95]">
            ENTER THE<br />ARENA.
          </h1>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
            GENESIS is OXXOVO&apos;s first verified AI creation tournament —
            and entry is free. This is a one-time founding privilege.
          </p>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl mt-5">
            This is not a contest.<br />
            It is the birth of a new creative arena.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-white/40 mb-8">
            HOW GENESIS WORKS
          </div>
          <div className="space-y-5">
            {[
              ['01', 'Submit your Free Entry', 'Enter any AI-generated video you created. No theme limits.'],
              ['02', 'Triple-AI scoring', 'Claude, GPT, and Gemini score every entry. Top 50 advance.'],
              ['03', 'The Main Round', 'The 50 finalists create a 30-second video on the OXXOVO theme.'],
              ['04', 'Champions revealed', 'Community vote + Triple-AI decide 1st, 2nd, and 3rd place.'],
            ].map(([num, title, desc]) => (
              <div key={num} className="flex gap-5 border border-white/10 p-5 hover:border-[#8B22FF]/50 transition">
                <div className="text-[#8B22FF] font-black text-lg shrink-0">{num}</div>
                <div>
                  <div className="font-bold mb-1">{title}</div>
                  <div className="text-sm text-white/60">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              ['1ST', '$1,200'],
              ['2ND', '$500'],
              ['3RD', '$300'],
            ].map(([rank, amt]) => (
              <div key={rank} className="border border-white/10 p-5 text-center">
                <div className="text-xs tracking-[0.2em] text-white/40 mb-2">{rank}</div>
                <div className="text-2xl font-black">{amt}</div>
              </div>
            ))}
          </div>

          <p className="text-sm text-white/50 mt-6 leading-relaxed">
            Every applicant becomes a permanent <span className="text-white">Founding Creator</span> —
            with lifetime free entry to all Season 1 tournaments.
          </p>

          <Link
            href="/rules"
            className="inline-block mt-6 text-xs tracking-[0.2em] text-[#8B22FF] hover:text-white transition"
          >
            READ THE FULL RULEBOOK →
          </Link>
        </div>
      </section>

      <section className="px-6 py-16 md:py-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-4">
            APPLICATION
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">
            Enter GENESIS.
          </h2>
          <p className="text-white/60 mb-12 leading-relaxed">
            Free to enter. Open to creators worldwide.
          </p>

          <div className="space-y-8">
            <Field label="Creator Name *" hint="Your name or creator alias.">
              <Input
                value={form.creator_name}
                onChange={(v) => update('creator_name', v)}
                placeholder="The name you create under"
              />
            </Field>

            <Field label="Email *">
              <Input
                type="email"
                value={form.email}
                onChange={(v) => update('email', v)}
                placeholder="you@email.com"
              />
            </Field>

            <Field label="Country">
              <Input
                value={form.country}
                onChange={(v) => update('country', v)}
                placeholder="e.g. Korea, USA, Japan"
              />
            </Field>

            <Field
              label="Public Creator Channel *"
              hint="YouTube, X, Instagram, TikTok, or Vimeo."
            >
              <Input
                value={form.channel_url}
                onChange={(v) => update('channel_url', v)}
                placeholder="https://youtube.com/@yourchannel"
              />
            </Field>

            <Field
              label="Free Entry — Your AI Video *"
              hint="A public URL to one AI-generated video you created. 15-60 sec."
            >
              <Input
                value={form.free_entry_url}
                onChange={(v) => update('free_entry_url', v)}
                placeholder="https://... (YouTube / Vimeo / Drive link)"
              />
            </Field>

            <div className="border border-white/10 p-5">
              <label className="flex gap-3 cursor-pointer items-start">
                <input
                  type="checkbox"
                  checked={form.agreed_to_rules}
                  onChange={(e) => update('agreed_to_rules', e.target.checked)}
                  className="mt-1 w-4 h-4 accent-[#8B22FF] shrink-0"
                />
                <span className="text-sm text-white/70 leading-relaxed">
                  I have read and agree to the{' '}
                  <Link href="/rules" className="text-[#8B22FF] hover:text-white underline">
                    OXXOVO Official Rulebook
                  </Link>
                  , and I confirm my Free Entry is an AI-generated video I created myself.
                </span>
              </label>
            </div>

            {error && (
              <div className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-[#8B22FF] hover:bg-[#9B32FF] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold tracking-[0.2em] py-5 transition"
            >
              {submitting ? 'SUBMITTING...' : 'SUBMIT APPLICATION'}
            </button>

            <p className="text-xs text-white/40 text-center leading-relaxed">
              Free entry. By submitting, you join the OXXOVO GENESIS archive
              as a Founding Creator.
            </p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-3xl mx-auto flex justify-between items-center text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">
            ← OXXOVO
          </Link>
          <div>SEASON 0 / GENESIS</div>
        </div>
      </footer>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-3 gap-4">
        <label className="text-xs tracking-[0.2em] text-white/60 uppercase">
          {label}
        </label>
        {hint && <span className="text-xs text-white/40 text-right">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent border border-white/15 px-4 py-3 text-white placeholder-white/30 focus:border-[#8B22FF] focus:outline-none transition"
    />
  );
}
