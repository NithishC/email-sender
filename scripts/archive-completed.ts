import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Find all completed contacts from email_tracking
  const { data: completedTracking, error: trackingError } = await supabase
    .from('email_tracking')
    .select('email')
    .eq('status', 'completed');

  if (trackingError) throw new Error(`Failed to query tracking: ${trackingError.message}`);

  if (!completedTracking?.length) {
    console.log('No completed contacts to archive.');
    return;
  }

  const emails = completedTracking.map((r) => r.email);
  console.log(`Found ${emails.length} completed contacts to archive.`);

  // Fetch full contact data
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .in('email', emails);

  if (contactsError) throw new Error(`Failed to fetch contacts: ${contactsError.message}`);

  if (!contacts?.length) {
    console.log('No matching contacts found in contacts table (already archived?).');
    return;
  }

  // Insert into archived_contacts
  const now = new Date().toISOString();
  const archivedContacts = contacts.map((c) => ({ ...c, archived_at: now }));

  const { error: insertError } = await supabase
    .from('archived_contacts')
    .upsert(archivedContacts);

  if (insertError) throw new Error(`Failed to insert into archive: ${insertError.message}`);

  // Delete from contacts (tracking records stay in email_tracking)
  const { error: deleteError } = await supabase
    .from('contacts')
    .delete()
    .in('email', emails);

  if (deleteError) throw new Error(`Failed to delete from contacts: ${deleteError.message}`);

  console.log(`\nArchived ${contacts.length} contacts:`);
  contacts.forEach((c) => console.log(`  - ${c.email} (${c.company_name ?? 'unknown company'})`));
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
