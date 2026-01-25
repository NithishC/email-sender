import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx ts-node scripts/reset-contact.ts <email>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function resetContact(email: string) {
  console.log(`Resetting contact: ${email}`);

  const { data, error } = await supabase
    .from('contacts')
    .update({
      is_emails_enriched: false,
      initial_email_subject: null,
      initial_email: null,
      follow_up_1_subject: null,
      follow_up_1: null,
      follow_up_2_subject: null,
      follow_up_2: null,
      follow_up_3_subject: null,
      follow_up_3: null,
      research_summary: null,
    })
    .eq('email', email.toLowerCase())
    .select('email, is_emails_enriched');

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error('Contact not found');
    process.exit(1);
  }

  console.log('Reset complete:', data[0]);
}

resetContact(email);
