// Post-deploy verification of resolveEmailLang (HQ 2026-08-31). Uses a
// pre-existing synthetic e2e test account (e2e-studio@oxxovo-e2e.test) --
// never TK's or 배우자's. Reverts the row to its original state at the end.
import { createClient } from '@supabase/supabase-js'
import { resolveEmailLang } from '../lib/email/lang.ts'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const EMAIL = 'e2e-studio@oxxovo-e2e.test'

async function readRow() {
  const { data } = await supabase.from('profiles').select('id, email, locale').eq('email', EMAIL).maybeSingle()
  return data
}

const before = await readRow()
console.log('BEFORE:', JSON.stringify(before))

console.log('locale=null, country=null  ->', await resolveEmailLang(EMAIL, null))
console.log('locale=null, country=Korea ->', await resolveEmailLang(EMAIL, 'Korea'))

await supabase.from('profiles').update({ locale: 'ko' }).eq('email', EMAIL)
console.log('SET locale=ko')

console.log('locale=ko,   country=USA   ->', await resolveEmailLang(EMAIL, 'USA'))

await supabase.from('profiles').update({ locale: before.locale }).eq('email', EMAIL)
const after = await readRow()
console.log('REVERTED TO:', JSON.stringify(after))
console.log(after.locale === before.locale ? 'REVERT OK' : 'REVERT MISMATCH')
