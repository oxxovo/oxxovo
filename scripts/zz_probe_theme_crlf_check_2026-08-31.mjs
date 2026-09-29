import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const r = await supabase.from('seasons').select('main_round_theme, main_round_theme_label, main_round_twist').eq('id', 'season_test').maybeSingle()
const t = r.data.main_round_theme
console.log('theme has \r\n:', t.includes('\r\n'))
console.log('theme has bare \r (no \n):', /\r(?!\n)/.test(t))
console.log('theme has blank-line runs:', /\n\n/.test(t) || /\r\n\r\n/.test(t))
console.log('label:', JSON.stringify(r.data.main_round_theme_label))
console.log('twist has \r\n:', r.data.main_round_twist.includes('\r\n'))
console.log('--- theme char codes around first \r ---')
const i = t.indexOf('\r')
console.log(JSON.stringify(t.slice(Math.max(0,i-5), i+10)))
