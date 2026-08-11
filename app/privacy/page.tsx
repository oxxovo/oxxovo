import { formatFooterStatusLine } from '@/lib/ip-info'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white px-8 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
      <p className="text-white/40 text-sm mb-12">Last updated: August 2026</p>

      <section className="space-y-8 text-white/70 leading-relaxed">

        <div>
          <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
          <p>OXXOVO Labs Inc. ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use the OXXOVO platform.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">2. Information We Collect</h2>
          <p>We collect information you provide directly, including your name, email address, and any content you submit to the Platform. We also collect usage data such as pages visited, tournament participation, and voting activity.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Information</h2>
          <p>We use your information to operate the Platform, send important updates, personalize your experience, and improve our services. We do not sell your personal data to third parties.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">4. Data Storage</h2>
          <p>Your data is stored securely using Supabase infrastructure. We implement industry-standard security measures to protect your personal information from unauthorized access.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">5. Cookies</h2>
          <p>We use cookies and similar technologies to enhance your experience on the Platform. You may disable cookies in your browser settings, though this may affect Platform functionality.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">6. Third-Party Services</h2>
          <p>We use trusted third-party services including Supabase (database), Vercel (hosting), and Cloudflare (security). These services have their own privacy policies governing data use.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">7. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data at any time. To exercise these rights, contact us at info@oxxovo.ai.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">8. Children's Privacy</h2>
          <p>OXXOVO is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify registered users of significant changes via email.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">10. SMS / Text Messaging</h2>
          <p>If you provide your mobile phone number and opt in, we use it solely to send you SMS text messages about OXXOVO tournaments (for example, round openings, deadlines, and results). When you opt in, we record the date and time, your IP address, and the consent text shown to you as proof of your opt-in.</p>
          <p className="mt-3"><span className="text-white/90 font-semibold">We do not sell, rent, or share your mobile number or SMS opt-in information with third parties or affiliates for their own marketing purposes.</span> SMS opt-in data is used only to deliver the messages you requested.</p>
          <p className="mt-3">Message frequency varies. Message and data rates may apply. You can opt out of SMS at any time by replying <span className="text-white/90 font-semibold">STOP</span>, or get help by replying <span className="text-white/90 font-semibold">HELP</span>. You can also manage your phone number and consent at any time on your <a href="/profile" className="text-[#8b22ff] hover:underline">profile page</a>. Providing your number is optional and is never required to use OXXOVO.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">11. Email Communications</h2>
          <p>When you create an OXXOVO account, we send you competition-related emails about the tournaments you can participate in — including round openings, submission deadlines, results, and announcements about future seasons. When you create your account, we record the date and time, your IP address, and the consent text shown to you as proof of your agreement.</p>
          <p className="mt-3"><span className="text-white/90 font-semibold">We do not sell, rent, or share your email address with third parties or affiliates for their own marketing purposes.</span> Your email is used only to send you the tournament updates described above and other service-related notices.</p>
          <p className="mt-3">You can opt out of season and tournament announcement emails at any time in your <a href="/profile" className="text-[#8b22ff] hover:underline">profile settings</a>, or by using the unsubscribe link included in those emails. Emails about your own application, account, or payment are sent regardless of this setting, since they are required to operate the service you asked for.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">12. Contact</h2>
          <p>For privacy-related questions, contact us at <a href="mailto:info@oxxovo.ai" className="text-[#8b22ff] hover:underline">info@oxxovo.ai</a></p>
        </div>

      </section>

      <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/30 text-sm">
        OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
        <p className="text-xs text-white/30 mt-1">{formatFooterStatusLine()}</p>
      </div>
    </main>
  )
}