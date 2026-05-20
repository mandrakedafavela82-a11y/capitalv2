import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yxxcxkvnuorjnsmjytxd.supabase.co'
const SUPABASE_KEY = 'sb_publishable_rYrRYYu_AlWEwmsarx9bxw_PHCC4VjQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
