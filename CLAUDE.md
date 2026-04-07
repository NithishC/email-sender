# CLAUDE.md

@.claude/docs/architecture.md
@.claude/docs/database.md

This file provides context for Claude Code and other AI assistants working on this project.

## Project Overview

Cold email campaign system with AI-powered email generation. Uses Claude CLI to generate personalized emails with web research, stores in Supabase, and sends via Gmail API on a schedule through GitHub Actions.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **AI**: Claude CLI with web search for email generation
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API with OAuth 2.0
- **Scheduling**: GitHub Actions (cron - weekdays 9 AM CST)

## Two Workflows

### 1. Generate Emails (Local)
```bash
npm run generate
```
- Runs locally on your machine
- Uses Claude CLI with `--allowedTools WebSearch`
- Generates 4 emails per contact (initial + 3 follow-ups)
- Stores in Supabase contacts table

### 2. Send Emails (GitHub Actions)
```bash
npm run send          # Live
npm run send:dry-run  # Preview
```
- Runs via GitHub Actions on schedule
- Reads generated emails from Supabase
- Sends via Gmail API
- Tracks status in email_tracking table

## Key Files

| File | Purpose |
|------|---------|
| `src/campaign/generation-runner.ts` | Orchestrates email generation with Claude CLI |
| `src/campaign/send-runner.ts` | Orchestrates email sending via Gmail |
| `src/ai/claude-cli.ts` | Wrapper for Claude CLI (uses Git Bash on Windows) |
| `src/ai/prompt-builder.ts` | Builds prompts from templates and contact data |
| `src/ai/email-parser.ts` | Parses 4 emails from Claude output |
| `src/db/contacts.ts` | Supabase contact queries |
| `src/db/tracking-manager.ts` | Email tracking status management |
| `src/email/gmail-sender.ts` | Gmail API integration |
| `data/prompts/*.md` | Email style guidelines |

## Utility Scripts

```bash
# Import contacts from Apollo CSV
npx ts-node scripts/import-contacts.ts file.csv

# Add single contact
npx ts-node scripts/add-contact.ts email name title company

# Reset contact to regenerate emails
npx ts-node scripts/reset-contact.ts email

# View generated emails
npx ts-node scripts/view-emails.ts email

# Refresh Gmail OAuth token (run every ~7 days, auto-updates GitHub secret)
npx ts-node scripts/auth-setup.ts
```

## Data Flow

```
Apollo CSV → import-contacts.ts → Supabase (is_emails_enriched=false)
                                         ↓
                              npm run generate (local)
                                         ↓
                              Supabase (is_emails_enriched=true)
                                         ↓
                              Review/edit in Supabase UI
                                         ↓
                              npm run send (GitHub Actions)
                                         ↓
                              Gmail → email_tracking updated
```

## Email Style Guidelines

Located in `data/prompts/`:

| File | Purpose |
|------|---------|
| `initial.md` | Initial email writing style - direct, confident, brief |
| `followup.md` | Follow-up progressions - shorter, new angles |
| `research-guidelines.md` | What to research about company/person |

Key style points:
- Direct and confident ("perfect fit" not "might be relevant")
- Brief (3-4 sentences for initial)
- No em-dashes, no philosophical language
- No signatures (Gmail adds automatically)
- Start with "Hi [First Name],"

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | Both | Supabase project URL |
| `SUPABASE_ANON_KEY` | Both | Supabase anon key |
| `GMAIL_CLIENT_ID` | Send | OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Send | OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Send | OAuth refresh token |
| `SENDER_EMAIL` | Send | Gmail address |
| `DAILY_LIMIT` | Send | Max emails per run (default: 50) |
| `FOLLOW_UP_INTERVALS` | Send | Days between follow-ups (default: 3,7,10) |

## Gotchas

- **Windows + Claude CLI**: Uses Git Bash for reliable piping
- **OAuth refresh tokens**: Expire in 7 days — Google Cloud project must stay in **Testing mode** (Gmail sensitive scopes require full Google verification to work in Production mode, which is overkill for a personal tool). Run `npx ts-node scripts/auth-setup.ts` to refresh; it auto-updates the GitHub `email-sender` environment secret via `gh`.
- **OAuth flow**: Uses localhost redirect (`http://localhost:3000/oauth2callback`) — OOB flow (`urn:ietf:wg:oauth:2.0:oob`) is fully deprecated by Google since Jan 2023.
- **Gmail limits**: 500/day for personal accounts - stay well under
- **Follow-up timing**: Intervals are 3, 7, 10 days from initial send
- **`pending` status does NOT trigger sends** — initial emails only send when there is NO tracking record. If a contact has a `pending` record (e.g. from a failed run), delete it so the send runner picks it up.
- **Batch generation**: Contacts are grouped by company — one Claude CLI call per company, not per contact. Much faster for multiple contacts at the same company.
- **Generation output cleanup**: After generation, check for `**` and trailing `---` artifacts with the node cleanup script. These can leak from Claude's markdown formatting.

## Common Maintenance Actions

### Stop follow-ups for a contact (replied/unsubscribed)
```bash
# Set status to completed so no more follow-ups are sent
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
supabase.from('email_tracking').update({ status: 'completed', next_follow_up_date: null }).eq('email', 'contact@example.com').then(console.log);
"
```

### Fix failed send run (OAuth expired)
```bash
# 1. Refresh the token
npx ts-node scripts/auth-setup.ts

# 2. Delete error/pending tracking records so initial emails resend
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
supabase.from('email_tracking').delete().in('status', ['error', 'pending']).select('email').then(({data}) => console.log('Deleted:', data.map(r=>r.email)));
"

# 3. Trigger the workflow
gh workflow run send-campaign.yml
```

### Check and clean email artifacts (** and ---)
```bash
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const fields = ['initial_email_subject','initial_email','follow_up_1_subject','follow_up_1','follow_up_2_subject','follow_up_2','follow_up_3_subject','follow_up_3'];
function clean(s) { return s ? s.replace(/\*\*/g, '').replace(/\n*---+\s*$/g, '').trim() : s; }
async function main() {
  const { data } = await supabase.from('contacts').select('email,' + fields.join(',')).eq('is_emails_enriched', true);
  for (const row of data) {
    const update = {};
    fields.forEach(k => { const c = clean(row[k]); if (c !== row[k]) update[k] = c; });
    if (Object.keys(update).length) {
      await supabase.from('contacts').update(update).eq('email', row.email);
      console.log('Fixed:', row.email);
    }
  }
  console.log('Done.');
}
main();
"
```

### Trigger GitHub Actions workflow manually
```bash
gh workflow run send-campaign.yml

# Check recent runs
gh run list --workflow=send-campaign.yml --limit=5

# View logs of a failed run
gh run view <run-id> --log-failed
```
