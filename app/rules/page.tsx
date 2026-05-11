export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white px-8 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-2">Tournament Rules</h1>
      <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>

      <section className="space-y-8 text-white/70 leading-relaxed">

        <div>
          <h2 className="text-xl font-bold text-white mb-3">1. Overview</h2>
          <p>OXXOVO tournaments are real-time AI creative competitions where participants submit AI-generated content based on a given prompt. All participants compete under the same conditions — same prompt, same time limit, no excuses.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">2. Eligibility</h2>
          <p>Any registered OXXOVO member may participate in open tournaments. Some tournaments may have specific eligibility requirements which will be clearly stated in the tournament details.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">3. Submission Rules</h2>
          <p>All submissions must be created using AI tools during the tournament time window. Pre-made or plagiarized content is strictly prohibited. Submissions must not contain harmful, offensive, or illegal content.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">4. Voting</h2>
          <p>Registered members may vote once per submission per tournament. Vote manipulation or use of bots is strictly prohibited and will result in disqualification and account termination.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">5. Judging & Results</h2>
          <p>Winners are determined by a combination of community votes and judge scores where applicable. All judging decisions are final. Results are announced immediately after the voting period ends.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">6. Prizes</h2>
          <p>Prize details are specified for each tournament. Prizes are awarded to winners within 14 business days of results announcement. OXXOVO Labs Inc. reserves the right to withhold prizes if rule violations are discovered.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">7. Disqualification</h2>
          <p>Participants may be disqualified for: submitting pre-made content, vote manipulation, abusive behavior, or any violation of these rules. Disqualification decisions are made at OXXOVO's sole discretion.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">8. Code of Conduct</h2>
          <p>All participants must treat fellow creators with respect. Harassment, discrimination, or toxic behavior of any kind will not be tolerated and may result in permanent account ban.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">9. Content Rights</h2>
          <p>Participants retain ownership of their submitted content. By submitting, you grant OXXOVO Labs Inc. the right to feature your work on the Platform and promotional materials.</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
          <p>For rules-related questions, contact us at <a href="mailto:oxxovolabs@gmail.com" className="text-[#8b22ff] hover:underline">oxxovolabs@gmail.com</a></p>
        </div>

      </section>

      <div className="mt-16 pt-8 border-t border-white/10 text-center text-white/30 text-sm">
        © 2026 OXXOVO Labs Inc. All Rights Reserved.
      </div>
    </main>
  )
}