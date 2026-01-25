import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function addContact() {
  const email = process.argv[2];
  const name = process.argv[3] || 'Test Contact';
  const title = process.argv[4] || null;
  const company = process.argv[5] || null;

  if (!email) {
    console.error('Usage: npx ts-node scripts/add-contact.ts <email> [name] [title] [company]');
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('contacts')
    .upsert({
      email: email.toLowerCase(),
      name,
      title,
      company_name: company,
      is_emails_enriched: false,
    }, { onConflict: 'email' })
    .select('email, name, title, company_name, is_emails_enriched');

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('Added:', JSON.stringify(data?.[0], null, 2));
}

addContact();
