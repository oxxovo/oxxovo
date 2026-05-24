import { formatFooterStatusLine } from '@/lib/ip-info'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white px-8 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-2">Privacy Policy</h1>
      <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>

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
          <p>You have the right to access, correct, or delete your personal data at any time. To exercise these rights, contact us at oxxovolabs@gmail.com.</p>
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
          <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
          <p>For privacy-related questions, contact us at <a href="mailto:oxxovolabs@gmail.com" className="text-[#8b22ff] hover:underline">oxxovolabs@gmail.com</a></p>
        </div>

      </section>

      <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/30 text-sm">
        OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
        <p className="text-xs text-white/30 mt-1">{formatFooterStatusLine()}</p>
      </div>
    </main>
  )
}