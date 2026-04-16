import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const csvFile = process.argv[2];

if (!csvFile) {
  console.error('Usage: npx ts-node scripts/import-contacts.ts <csv-file>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface Contact {
  email: string;
  name: string;
  title: string | null;
  company_name: string | null;
  is_emails_enriched: boolean;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function importContacts(filePath: string) {
  console.log(`Reading ${filePath}...`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} rows in CSV`);

  const contacts: Contact[] = rows
    .filter(row => row['Email'] && row['Email'].includes('@'))
    .map(row => ({
      email: row['Email'].toLowerCase(),
      name: `${row['First Name']} ${row['Last Name']}`.trim(),
      title: row['Title'] || null,
      company_name: row['Company Name'] || null,
      is_emails_enriched: false,
    }));

  console.log(`Prepared ${contacts.length} valid contacts`);

  if (contacts.length === 0) {
    console.log('No contacts to import');
    return;
  }

  // Show contacts to be imported
  console.log('\nContacts to import:');
  contacts.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.email}) - ${c.title} @ ${c.company_name}`);
  });

  // Insert new contacts only — skip if email already exists
  const { data, error } = await supabase
    .from('contacts')
    .upsert(contacts, { onConflict: 'email', ignoreDuplicates: true })
    .select('email');

  if (error) {
    console.error('\nError importing:', error.message);
    process.exit(1);
  }

  console.log(`\nSuccessfully imported ${data?.length || 0} contacts`);
}

importContacts(csvFile);
