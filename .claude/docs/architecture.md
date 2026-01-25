# System Architecture

Cold email campaign system with AI-powered email generation and automated sending.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL (Your Machine)                            │
│                                                                              │
│   ┌─────────────┐      ┌──────────────┐      ┌───────────────────────┐      │
│   │   Apollo    │ CSV  │   import-    │      │       Supabase        │      │
│   │  Contacts   │─────►│  contacts.ts │─────►│   contacts table      │      │
│   └─────────────┘      └──────────────┘      │ (is_emails_enriched   │      │
│                                              │   = false)            │      │
│                                              └───────────┬───────────┘      │
│                                                          │                   │
│   ┌─────────────────────────────────────────────────────▼──────────────┐    │
│   │                     npm run generate                                │    │
│   │  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │    │
│   │  │ PromptBuilder  │  │   ClaudeCLI    │  │    EmailParser        │ │    │
│   │  │ (builds prompt │─►│ (calls claude  │─►│ (extracts 4 emails    │ │    │
│   │  │  from contact) │  │  with search)  │  │  from response)       │ │    │
│   │  └────────────────┘  └────────────────┘  └───────────────────────┘ │    │
│   └─────────────────────────────────────────────────────┬──────────────┘    │
│                                                          │                   │
│                                              ┌───────────▼───────────┐      │
│                                              │       Supabase        │      │
│                                              │   contacts table      │      │
│                                              │ (is_emails_enriched   │      │
│                         Review/edit in UI ──►│   = true, emails      │      │
│                                              │   populated)          │      │
│                                              └───────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           GITHUB ACTIONS (Scheduled)                         │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                       npm run send                                    │  │
│   │  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐   │  │
│   │  │ TrackingMgr    │  │   SendRunner   │  │    GmailSender        │   │  │
│   │  │ (checks what   │─►│ (queues emails │─►│ (sends via Gmail      │   │  │
│   │  │  to send)      │  │  to send)      │  │  API)                 │   │  │
│   │  └────────────────┘  └────────────────┘  └───────────────────────┘   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                              │                               │
│                                              ▼                               │
│                                   ┌───────────────────────┐                 │
│                                   │       Supabase        │                 │
│                                   │  email_tracking table │                 │
│                                   │ (status, follow-up    │                 │
│                                   │  dates)               │                 │
│                                   └───────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Two Main Workflows

### 1. Generate Emails (Local)

**Command:** `npm run generate`

**Purpose:** Uses Claude CLI with web search to generate personalized emails.

**Flow:**
```
1. Load contacts where is_emails_enriched = false
2. For each contact:
   a. PromptBuilder creates prompt with:
      - Contact info (name, company, title)
      - Sender background
      - Style guidelines from data/prompts/*.md
   b. ClaudeCLI executes: claude -p "prompt" --allowedTools WebSearch
   c. EmailParser extracts 4 emails from response:
      - Initial email + subject
      - Follow-up 1 + subject
      - Follow-up 2 + subject
      - Follow-up 3 + subject
   d. Save to contacts table, set is_emails_enriched = true
3. Wait 5s between contacts (rate limiting)
```

**Key Files:**
| File | Purpose |
|------|---------|
| `src/campaign/generation-runner.ts` | Main orchestration |
| `src/ai/prompt-builder.ts` | Builds prompt from templates |
| `src/ai/claude-cli.ts` | Executes Claude CLI via Git Bash |
| `src/ai/email-parser.ts` | Parses response into 4 emails |
| `data/prompts/initial.md` | Initial email style guide |
| `data/prompts/followup.md` | Follow-up email style guide |
| `data/prompts/research-guidelines.md` | Research instructions |

---

### 2. Send Emails (GitHub Actions)

**Command:** `npm run send` (or `npm run send:dry-run`)

**Schedule:** Weekdays at 9 AM CST via GitHub Actions

**Flow:**
```
1. Load contacts where is_emails_enriched = true
2. Load email_tracking for each contact
3. Determine what to send:
   - No tracking record → send initial email
   - status = 'sent' + next_follow_up_date <= today → send follow_up_1
   - status = 'follow_up_1' + next_follow_up_date <= today → send follow_up_2
   - status = 'follow_up_2' + next_follow_up_date <= today → send follow_up_3
4. For each email to send:
   a. Send via Gmail API
   b. Update email_tracking (status, dates)
5. Rate limit: 2-3s between emails, max 50/day
```

**Status Progression:**
```
pending → sent → follow_up_1 → follow_up_2 → follow_up_3 → completed
```

**Key Files:**
| File | Purpose |
|------|---------|
| `src/campaign/send-runner.ts` | Main orchestration |
| `src/db/tracking-manager.ts` | Manages email_tracking table |
| `src/email/gmail-sender.ts` | Sends via Gmail API |
| `src/email/rate-limiter.ts` | Enforces daily limits |
| `src/auth/gmail-auth.ts` | OAuth 2.0 authentication |

---

## Utility Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/import-contacts.ts` | Import from Apollo CSV | `npx ts-node scripts/import-contacts.ts file.csv` |
| `scripts/add-contact.ts` | Add single contact | `npx ts-node scripts/add-contact.ts email name title company` |
| `scripts/reset-contact.ts` | Reset to unenriched | `npx ts-node scripts/reset-contact.ts email` |
| `scripts/view-emails.ts` | View generated emails | `npx ts-node scripts/view-emails.ts email` |

---

## Directory Structure

```
cold-email-campaign/
├── .claude/agents/          # AI agent documentation
│   ├── architecture.md      # This file
│   └── database.md          # Database schema guide
├── .github/workflows/
│   └── send-emails.yml      # GitHub Actions workflow
├── data/prompts/            # Email generation prompts
│   ├── initial.md           # Initial email guidelines
│   ├── followup.md          # Follow-up guidelines
│   └── research-guidelines.md
├── scripts/                 # Utility scripts
├── src/
│   ├── ai/                  # AI/Claude integration
│   │   ├── claude-cli.ts    # Claude CLI wrapper
│   │   ├── email-parser.ts  # Parse Claude output
│   │   └── prompt-builder.ts
│   ├── auth/
│   │   └── gmail-auth.ts    # Gmail OAuth
│   ├── campaign/
│   │   ├── generation-runner.ts  # npm run generate
│   │   └── send-runner.ts        # npm run send
│   ├── db/
│   │   ├── contacts.ts      # Contact queries
│   │   ├── supabase.ts      # Supabase client
│   │   └── tracking-manager.ts
│   ├── email/
│   │   ├── gmail-sender.ts
│   │   ├── rate-limiter.ts
│   │   └── template-engine.ts
│   └── types/
│       └── index.ts
└── supabase/migrations/     # Database migrations
```

---

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | Both | Supabase project URL |
| `SUPABASE_ANON_KEY` | Both | Supabase anon/public key |
| `GMAIL_CLIENT_ID` | Send | OAuth client ID |
| `GMAIL_CLIENT_SECRET` | Send | OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Send | OAuth refresh token |
| `SENDER_EMAIL` | Send | Gmail address to send from |
| `DAILY_LIMIT` | Send | Max emails per run (default: 50) |
| `FOLLOW_UP_INTERVALS` | Send | Days between follow-ups (default: 3,7,14) |
| `GENERATION_DAILY_LIMIT` | Generate | Max contacts per run (default: 20) |
| `CLAUDE_TIMEOUT_MS` | Generate | Claude CLI timeout (default: 120000) |

---

## Key Design Decisions

1. **Separate Generate vs Send**: Generation runs locally (uses Claude CLI), sending runs in GitHub Actions (no secrets exposure)

2. **Email as Primary Key**: contacts.email is PK - no UUIDs, simpler queries

3. **Emails in Contacts Table**: All 4 emails stored directly in contacts - no separate drafts table

4. **is_emails_enriched Flag**: Simple boolean to track generation state

5. **Git Bash for Windows**: Claude CLI piping works reliably with Git Bash shell

6. **Web Search in Prompts**: Claude researches each contact's company before writing emails