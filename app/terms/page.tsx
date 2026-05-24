import { formatFooterStatusLine } from '@/lib/ip-info'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white px-8 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
      <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>

      <section className="space-y-8 text-white/70 leading-relaxed">

        <div>
          <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using OXXOVO ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">2. About OXXOVO</h2>
          <p>OXXOVO is an AI creative competition platform operated by OXXOVO Labs Inc., a C-Corporation incorporated in Las Vegas, Nevada, USA. The Platform allows users to participate in real-time AI creative tournaments, vote on submissions, and engage with the global AI creator community.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">3. Eligibility</h2>
          <p>You must be at least 13 years old to use the Platform. By using OXXOVO, you represent that you meet this requirement. Users under 18 must have parental consent.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">4. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account at oxxovolabs@gmail.com.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">5. Content & Submissions</h2>
          <p>By submitting content to OXXOVO tournaments, you grant OXXOVO Labs Inc. a non-exclusive, worldwide license to display, promote, and distribute your submissions within the Platform. You retain ownership of your original creative work.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">6. Prohibited Conduct</h2>
          <p>Users may not submit harmful, illegal, or plagiarized content. Cheating, vote manipulation, or abuse of the Platform will result in immediate account termination.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">7. Prizes & Rewards</h2>
          <p>Prize details are specified per tournament. OXXOVO Labs Inc. reserves the right to modify prize structures at any time. All prize decisions are final.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">8. Termination</h2>
          <p>We reserve the right to suspend or terminate any account that violates these Terms at our sole discretion.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">9. Limitation of Liability</h2>
          <p>OXXOVO Labs Inc. is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
          <p>For questions regarding these Terms, contact us at <a href="mailto:oxxovolabs@gmail.com" className="text-[#8b22ff] hover:underline">oxxovolabs@gmail.com</a></p>
        </div>

      </section>

      <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/30 text-sm">
        OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
        <p className="text-xs text-white/30 mt-1">{formatFooterStatusLine()}</p>
      </div>
    </main>
  )
}