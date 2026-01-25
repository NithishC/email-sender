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
| `FOLLOW_UP_INTERVALS` | Send | Days between follow-ups (default: 3,7,14) |

## Gotchas

- **Windows + Claude CLI**: Uses Git Bash for reliable piping
- **OAuth refresh tokens**: Expire in 7 days if Google Cloud project is in "Testing" mode
- **Gmail limits**: 500/day for personal accounts - stay well under
- **Follow-up timing**: Intervals are 3, 7, 14 days from initial send
