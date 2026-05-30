import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ouomjxvnaxptblpfmrtv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_yWXN9HE8HBLIa1zdp_wNbA_J2oH7UG-'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
