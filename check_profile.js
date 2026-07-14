import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local manually
const env = fs.readFileSync('.env.local', 'utf-8');
const lines = env.split('\n');
let SUPABASE_URL = '';
let SUPABASE_SERVICE_ROLE_KEY = '';

lines.forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].trim();
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: users, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error('Auth fetch error:', authErr);
    return;
  }
  
  const adminUser = users.users.find(u => u.email === 'ayanmuhammad953@gmail.com');
  if (!adminUser) {
    console.log('Admin user not found in auth.users!');
    return;
  }
  
  console.log('Admin auth ID:', adminUser.id);
  
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .single();
    
  if (profErr) {
    console.error('Profile fetch error:', profErr);
  } else {
    console.log('Profile found:', profile);
  }
}

check();
