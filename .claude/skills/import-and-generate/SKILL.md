---
name: import-and-generate
description: Import Apollo contacts from a CSV file into Supabase and generate personalized cold emails using Claude CLI with web search. Use this skill whenever the user wants to add new contacts, import a CSV, run email generation, enrich contacts, or do the full import-to-email workflow. Even if they just say "I have new contacts" or "got a new CSV" — trigger this skill.
---

# Import and Generate Cold Emails

This skill handles the full workflow of importing Apollo contacts and generating personalized cold emails for them.

## Why this matters

Each step is distinct and consequential:
- Import adds contacts to Supabase with `is_emails_enriched = false`
- Generation calls Claude CLI with live web search — it takes 2-3 min per contact, so always confirm before running
- Generation runs 5 contacts in parallel; if it fails with rate limit errors, wait a few minutes and retry

## Steps

### Step 1: Get the CSV path

If the user provided a file path (as an argument or in their message), use it. Otherwise ask:
> "What's the path to your Apollo CSV export?"

Common locations: `C:\Users\<name>\Downloads\apollo-contacts-export*.csv`

### Step 2: Import contacts

Run:
```bash
npx ts-node scripts/import-contacts.ts "<csv_path>"
```

Show the user the list of imported contacts from the output (name, email, title, company).

If the import fails, check:
- File path is correct and quoted (spaces in path)
- `.env` has `SUPABASE_URL` and `SUPABASE_ANON_KEY` set

### Step 3: Confirm before generating

Ask the user:
> "Ready to generate emails for these [N] contacts? Claude will research each company and write 4 emails per contact (~2-3 min each, running 5 in parallel)."

Wait for confirmation before proceeding.

### Step 4: Generate emails

Run:
```bash
npm run generate
```

Let the user know this will take a few minutes. The output shows progress per contact in real time.

**If it fails with rate limit errors**: tell the user to wait 5-10 minutes and run `npm run generate` again — it will pick up where it left off (only processes contacts where `is_emails_enriched = false`).

### Step 5: Show summary

Display the final summary:
- How many contacts were successfully generated
- How many failed (and why, if shown)
- Remind them to review/edit emails in Supabase UI before sending
