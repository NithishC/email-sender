import * as fs from 'fs';
import { parse } from 'csv-parse';
import { Contact } from '../types';

export async function parseContacts(filePath: string): Promise<Contact[]> {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Contacts file not found: ${filePath}`));
      return;
    }

    const contacts: Contact[] = [];

    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true, // Use first row as headers
          skip_empty_lines: true,
          trim: true,
          bom: true, // Handle BOM from Excel
          relax_column_count: true,
        })
      )
      .on('data', (row: Record<string, string>) => {
        // Validate required fields
        if (!row.email || !row.name) {
          console.warn(`Skipping row with missing email or name: ${JSON.stringify(row)}`);
          return;
        }

        // Normalize email to lowercase
        row.email = row.email.toLowerCase().trim();

        // Basic email validation
        if (!isValidEmail(row.email)) {
          console.warn(`Skipping invalid email: ${row.email}`);
          return;
        }

        contacts.push(row as Contact);
      })
      .on('error', (error) => {
        reject(new Error(`Error parsing contacts CSV: ${error.message}`));
      })
      .on('end', () => {
        console.log(`Loaded ${contacts.length} contacts from ${filePath}`);
        resolve(contacts);
      });
  });
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
