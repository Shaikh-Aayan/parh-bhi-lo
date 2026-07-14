import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rgvfngxbrsafvuscggcw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndmZuZ3hicnNhZnZ1c2NnZ2N3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkzODQ5MywiZXhwIjoyMDk5NTE0NDkzfQ.rzQSZviUfQSbHBN1aM3aqDI3UBwAwBL-v_vmbS3qhqM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedAdmin() {
  console.log('Creating Admin User...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'ayanmuhammad953@gmail.com',
    password: 'TemporaryPassword123!',
    email_confirm: true,
  });

  if (error) {
    console.error('Error creating user:', error);
    return;
  }

  const userId = data.user.id;
  console.log('Admin user created in auth.users with ID:', userId);

  console.log('Inserting into profiles table...');
  const { error: profileError } = await supabase
    .from('profiles')
    .insert([
      {
        id: userId,
        display_name: 'Aayan Shaikh',
        role: 'admin'
      }
    ]);

  if (profileError) {
    console.error('Error inserting into profiles (Make sure you ran the SQL schema first!):', profileError);
  } else {
    console.log('Admin profile created successfully!');
  }
}

seedAdmin();
