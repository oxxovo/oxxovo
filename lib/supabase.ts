import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qrnkovokjmimagrwjebs.supabase.co'
const supabaseAnonKey = 'sb_publishable_jqaYD8CyZLZLK3mpCPjHMQ_f79qUrjl'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    }
  }
})