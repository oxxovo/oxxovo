import Link from 'next/link'
import { formatFooterStatusLine } from '@/lib/ip-info'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white px-8 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-2">Terms of Service</h1>
      <p className="text-white/40 text-sm mb-12">Last updated: August 2026</p>

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
          <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account at info@oxxovo.ai.</p>
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
          <h2 className="text-xl font-bold text-white mb-3">8. Creator Membership, Billing &amp; Refunds</h2>
          <p>OXXOVO offers an optional paid Creator Membership that grants tournament participation rights. The following terms apply to all memberships:</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li><span className="text-white/90 font-semibold">Recurring subscription.</span> Creator Membership is a subscription that bills automatically each billing period (monthly unless otherwise stated at checkout) at the rate shown at checkout, until you cancel.</li>
            <li><span className="text-white/90 font-semibold">Founding Creators.</span> A limited number of Founding Creator memberships are granted free for an introductory term. After the free term, the membership renews automatically at the then-current rate unless cancelled. We will notify you before the first paid renewal.</li>
            <li><span className="text-white/90 font-semibold">Automatic renewal.</span> Your membership renews automatically at the end of each period. By subscribing you authorize OXXOVO Labs Inc. to charge your payment method for each renewal until you cancel.</li>
            <li><span className="text-white/90 font-semibold">Cancellation.</span> You may cancel at any time from your profile page. Cancellation stops future renewals and takes effect at the end of your current paid period — you keep creator access until then, after which your account reverts to a free member.</li>
            <li><span className="text-white/90 font-semibold">No refunds.</span> All payments are non-refundable. Cancelling stops future charges but does not entitle you to a refund of the current or any prior billing period, and we do not provide partial or pro-rated refunds, except where a refund is required by applicable law.</li>
            <li><span className="text-white/90 font-semibold">Price changes.</span> We may change membership pricing. Any change applies to renewals after we notify you, and you may cancel before the change takes effect.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">9. Termination</h2>
          <p>We reserve the right to suspend or terminate any account that violates these Terms at our sole discretion.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">10. Limitation of Liability</h2>
          <p>OXXOVO Labs Inc. is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">11. SMS / Text Messaging Program</h2>
          <p>OXXOVO offers an optional SMS text messaging program operated by OXXOVO Labs Inc. ("OXXOVO"). The following terms govern that program:</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li><span className="text-white/90 font-semibold">Program & message types.</span> By providing your mobile number and opting in on your profile page, you consent to receive SMS text messages from OXXOVO about tournaments — such as round openings, submission deadlines, and results notifications.</li>
            <li><span className="text-white/90 font-semibold">Message frequency.</span> Message frequency varies depending on tournament activity.</li>
            <li><span className="text-white/90 font-semibold">Cost.</span> Message and data rates may apply. OXXOVO does not charge for the messages, but your mobile carrier&apos;s standard rates apply.</li>
            <li>
              <span className="text-white/90 font-semibold">Opt-out and help.</span> You can cancel the SMS program at any time by texting{' '}
              <span className="text-white font-bold">STOP</span>. After you send <span className="text-white font-bold">STOP</span>, we will send a confirmation message and then stop sending SMS messages. For help, text{' '}
              <span className="text-white font-bold">HELP</span> or contact us at <a href="mailto:info@oxxovo.ai" className="text-[#8b22ff] hover:underline">info@oxxovo.ai</a>. You can also remove your number and withdraw consent at any time on your <a href="/profile" className="text-[#8b22ff] hover:underline">profile page</a>.
            </li>
            <li><span className="text-white/90 font-semibold">Optional.</span> Participation is optional and is not a condition of using OXXOVO or of any purchase.</li>
            <li><span className="text-white/90 font-semibold">Carriers.</span> Mobile carriers are not liable for delayed or undelivered messages.</li>
            <li><span className="text-white/90 font-semibold">Privacy.</span> Your mobile number and opt-in are handled per our <a href="/privacy" className="text-[#8b22ff] hover:underline">Privacy Policy</a>. We do not sell or share SMS opt-in data with third parties for their marketing.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">12. Email Notifications</h2>
          <p>OXXOVO sends account holders email notifications about tournaments. The following terms govern that program:</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li><span className="text-white/90 font-semibold">Program & message types.</span> By creating an OXXOVO account, you agree to receive competition updates and announcements about future seasons by email — such as round openings, submission deadlines, results, and season announcements.</li>
            <li><span className="text-white/90 font-semibold">Message frequency.</span> Message frequency varies depending on tournament and season activity.</li>
            <li>
              <span className="text-white/90 font-semibold">Opt-out.</span> You can opt out of these announcement emails at any time in your <a href="/profile" className="text-[#8b22ff] hover:underline">profile settings</a>, or by using the unsubscribe link included in the email. Opting out does not affect your ability to use OXXOVO or participate in tournaments — only emails required for your own account or an active application/submission will continue.
            </li>
            <li><span className="text-white/90 font-semibold">Privacy.</span> Your email address and consent are handled per our <a href="/privacy" className="text-[#8b22ff] hover:underline">Privacy Policy</a>. We do not sell or share it with third parties for their marketing.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">13. Contact</h2>
          <p>For questions regarding these Terms, contact us at <a href="mailto:info@oxxovo.ai" className="text-[#8b22ff] hover:underline">info@oxxovo.ai</a></p>
        </div>

      </section>

      <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/30 text-sm">
        {/* This page had no way back to the site on any viewport. The link and its
            styling are the ones /tournament, /about, /faq and /guidelines already
            use, so there is no new wording here to keep in sync. Terms reachability
            is also what a payment review looks for. */}
        <Link href="/" className="mb-4 inline-block text-xs tracking-[0.2em] text-white/40 transition hover:text-white">
          &larr; OXXOVO
        </Link>
        <p>OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.</p>
        <p className="text-xs text-white/30 mt-1">{formatFooterStatusLine()}</p>
      </div>
    </main>
  )
}