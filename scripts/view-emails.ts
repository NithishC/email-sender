import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx ts-node scripts/view-emails.ts <email>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function viewEmails(email: string) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!data) {
    console.error('Contact not found');
    process.exit(1);
  }

  console.log('=== CONTACT ===');
  console.log(`Name: ${data.name}`);
  console.log(`Company: ${data.company_name}`);
  console.log(`Title: ${data.title}`);
  console.log(`Enriched: ${data.is_emails_enriched}`);

  console.log('\n=== RESEARCH ===');
  console.log(data.research_summary || '(none)');

  console.log('\n=== INITIAL EMAIL ===');
  console.log(`Subject: ${data.initial_email_subject || '(none)'}`);
  console.log(`Body:\n${data.initial_email || '(none)'}`);

  console.log('\n=== FOLLOW-UP 1 ===');
  console.log(`Subject: ${data.follow_up_1_subject || '(none)'}`);
  console.log(`Body:\n${data.follow_up_1 || '(none)'}`);

  console.log('\n=== FOLLOW-UP 2 ===');
  console.log(`Subject: ${data.follow_up_2_subject || '(none)'}`);
  console.log(`Body:\n${data.follow_up_2 || '(none)'}`);

  console.log('\n=== FOLLOW-UP 3 ===');
  console.log(`Subject: ${data.follow_up_3_subject || '(none)'}`);
  console.log(`Body:\n${data.follow_up_3 || '(none)'}`);
}

viewEmails(email);
