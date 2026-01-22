import { getSupabaseClient } from './supabase';
import { Contact } from '../types';

interface SupabaseContact {
  id: string;
  email: string;
  name: string;
  company: string | null;
  title: string | null;
  industry: string | null;
  custom_fields: Record<string, string> | null;
  active: boolean;
  created_at: string;
}

export async function getContacts(): Promise<Contact[]> {
  const supabase = getSupabaseClient();

  console.log('Querying contacts table...');

  const { data, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .order('created_at', { ascending: true });

  console.log('Query result - data:', data?.length ?? 0, 'rows, error:', error?.message ?? 'none');

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('No active contacts found in database');
    console.log('Tip: If RLS is enabled, ensure a SELECT policy exists for the anon role');
    return [];
  }

  // Transform to Contact interface
  const contacts: Contact[] = data.map((row: SupabaseContact) => {
    const contact: Contact = {
      email: row.email.toLowerCase(),
      name: row.name,
      company: row.company || '',
    };

    // Add optional fields if present
    if (row.title) contact.title = row.title;
    if (row.industry) contact.industry = row.industry;

    // Merge custom fields
    if (row.custom_fields) {
      Object.assign(contact, row.custom_fields);
    }

    return contact;
  });

  console.log(`Loaded ${contacts.length} contacts from Supabase`);
  return contacts;
}

export async function getContactByEmail(email: string): Promise<Contact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch contact: ${error.message}`);
  }

  if (!data) return null;

  const row = data as SupabaseContact;
  const contact: Contact = {
    email: row.email.toLowerCase(),
    name: row.name,
    company: row.company || '',
  };

  if (row.title) contact.title = row.title;
  if (row.industry) contact.industry = row.industry;
  if (row.custom_fields) {
    Object.assign(contact, row.custom_fields);
  }

  return contact;
}
