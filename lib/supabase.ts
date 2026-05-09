import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qrnkovokjmimagrwjebs.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybmtvdm9ram1pbWFncndqZWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTc1NzQsImV4cCI6MjA5MzgzMzU3NH0.9Hsq-_6DD9zwrYqj7Fqu5Ji48B1YzIEk2M3J9T6wHWQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)