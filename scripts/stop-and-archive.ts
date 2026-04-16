import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const email = process.argv[2];

if (!email || !email.includes('@')) {
  console.error('Usage: npx ts-node scripts/stop-and-archive.ts <email>');
  process.exit(1);
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // 1. Stop follow-ups
  const { error: trackingError } = await supabase
    .from('email_tracking')
    .update({ status: 'completed', next_follow_up_date: null })
    .eq('email', email);

  if (trackingError) throw new Error(`Failed to update tracking: ${trackingError.message}`);
  console.log(`[OK] Follow-ups stopped for ${email}`);

  // 2. Fetch contact
  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('*')
    .eq('email', email)
    .single();

  if (fetchError || !contact) {
    console.log(`[SKIP] Contact not found in contacts table (already archived?)`);
    return;
  }

  // 3. Archive
  const { error: insertError } = await supabase
    .from('archived_contacts')
    .upsert({ ...contact, archived_at: new Date().toISOString() });

  if (insertError) throw new Error(`Failed to archive contact: ${insertError.message}`);

  // 4. Delete from contacts
  const { error: deleteError } = await supabase
    .from('contacts')
    .delete()
    .eq('email', email);

  if (deleteError) throw new Error(`Failed to delete from contacts: ${deleteError.message}`);

  console.log(`[OK] Archived ${contact.name} (${contact.company_name ?? 'unknown company'})`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
