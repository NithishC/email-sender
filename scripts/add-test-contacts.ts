import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function main() {
  const testEmail1 = 'SENDER_EMAIL'; // For testing initial email

  console.log('Adding test contact for initial email...\n');

  // Add contact for INITIAL email test (no tracking record)
  const { error: error1 } = await supabase.from('contacts').upsert({
    email: testEmail1,
    name: 'Nithish Test',
    title: 'Software Engineer',
    company_name: 'Test Company',
    is_emails_enriched: true,
    initial_email_subject: 'Test Initial Email Subject',
    initial_email: 'Hi Nithish,\n\nThis is a test initial email to verify the signature and resume attachment work correctly.\n\nLooking forward to connecting!',
    follow_up_1_subject: 'Following up - Test',
    follow_up_1: 'Hi Nithish,\n\nJust wanted to follow up on my previous email.',
  });

  if (error1) {
    console.error('Error adding initial test contact:', error1);
  } else {
    console.log(`Added contact: ${testEmail1} (for INITIAL email test)`);
    console.log('   - No tracking record = will receive initial email');
    console.log('   - Will include P.S. signature and resume attachment');
  }

  // Delete any existing tracking record so it sends initial email
  const { error: deleteError } = await supabase
    .from('email_tracking')
    .delete()
    .eq('email', testEmail1);

  if (deleteError) {
    console.warn('Note: Could not delete tracking record:', deleteError.message);
  } else {
    console.log('   - Cleared tracking record = will receive INITIAL email');
    console.log('   - Will include P.S. signature and resume attachment');
  }

  console.log('\nRun the workflow to test!');
}

main().catch(console.error);
