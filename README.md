# Cold Email Campaign System

Automated cold email outreach system using Gmail API with scheduled follow-ups via GitHub Actions.

## Features

- **Gmail API Integration** - Send emails using OAuth 2.0 (secure, no password storage)
- **Automated Scheduling** - GitHub Actions runs daily at 9 AM UTC (free)
- **Smart Follow-ups** - Automatic follow-up emails at configurable intervals (e.g., 3 and 7 days)
- **Template System** - Multiple email templates with `{{variable}}` personalization
- **Progress Tracking** - CSV-based tracking of all sent emails, statuses, and errors
- **Rate Limiting** - Configurable daily limits (default 50-100) to avoid spam filters
- **Dry Run Mode** - Preview emails without sending

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Gmail OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the **Gmail API**
4. Configure OAuth consent screen:
   - Choose "External" user type
   - Set publishing status to "In Production" (for persistent refresh tokens)
   - Add your email as a test user
5. Create OAuth 2.0 Client ID (Desktop app type)
6. Download the credentials JSON

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=    # Get this in step 4
SENDER_EMAIL=your-email@gmail.com
DAILY_LIMIT=50
FOLLOW_UP_INTERVALS=3,7,10
MAX_FOLLOW_UPS=3
```

### 4. Get Refresh Token

```bash
npm run auth-setup
```

Follow the prompts to authorize and get your refresh token. Add it to `.env`.

### 5. Add Your Contacts

Edit `data/contacts.csv`:

```csv
email,name,company,title,industry
john@example.com,John Doe,Acme Corp,CEO,Technology
jane@startup.io,Jane Smith,StartupXYZ,CTO,SaaS
```

### 6. Customize Email Templates

Edit templates in `data/templates/`:

- `initial.md` - First email
- `followup-1.md` - First follow-up (after 3 days)
- `followup-2.md` - Second follow-up (after 7 days)

Template format:

```markdown
---
subject: "Your Subject Line for {{company}}"
---
Hi {{name}},

Your email body here. Use {{variable}} for personalization.

Best regards
```

### 7. Test Locally

```bash
# Preview without sending
npm run campaign:dry-run

# Actually send emails
npm run campaign
```

## GitHub Actions Setup (Automated Daily Runs)

1. Push your repo to GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Add these secrets:
   - `GMAIL_CLIENT_ID`
   - `GMAIL_CLIENT_SECRET`
   - `GMAIL_REFRESH_TOKEN`
   - `SENDER_EMAIL`

The workflow runs daily at 9 AM UTC. You can also trigger it manually from the Actions tab.

## Project Structure

```
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment configuration
│   ├── auth/
│   │   └── gmail-auth.ts     # Gmail OAuth client
│   ├── csv/
│   │   ├── contact-parser.ts # Parse contacts.csv
│   │   └── tracking-manager.ts # Read/write tracking.csv
│   ├── email/
│   │   ├── gmail-sender.ts   # Send via Gmail API
│   │   ├── template-engine.ts # Variable substitution
│   │   └── rate-limiter.ts   # Daily limit enforcement
│   └── campaign/
│       ├── scheduler.ts      # Decide what to send
│       └── campaign-runner.ts # Main orchestration
├── data/
│   ├── contacts.csv          # Your contact list
│   ├── tracking.csv          # Progress tracking (auto-managed)
│   └── templates/            # Email templates
├── scripts/
│   └── auth-setup.ts         # One-time OAuth setup
└── .github/workflows/
    └── send-emails.yml       # GitHub Actions workflow
```

## How It Works

1. **Load contacts** from `contacts.csv`
2. **Check tracking** to see who's already been emailed
3. **Schedule emails**:
   - Priority 1: Follow-ups that are due
   - Priority 2: New contacts not yet emailed
4. **Send emails** up to daily limit with rate limiting
5. **Update tracking** with results
6. **Commit tracking** changes (in GitHub Actions)

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `DAILY_LIMIT` | 50 | Max emails per run |
| `FOLLOW_UP_INTERVALS` | 3,7,10 | Days after initial email to send follow-ups |
| `MAX_FOLLOW_UPS` | 3 | Maximum follow-up emails per contact |

## Commands

```bash
npm run campaign          # Run campaign (send emails)
npm run campaign:dry-run  # Preview without sending
npm run auth-setup        # Set up Gmail OAuth
npm run build             # Compile TypeScript
```

## Tracking CSV Columns

| Column | Description |
|--------|-------------|
| `email` | Contact email address |
| `status` | pending, sent, follow_up_1, follow_up_2, completed, error |
| `initial_sent_date` | When first email was sent |
| `follow_up_count` | Number of follow-ups sent |
| `next_follow_up_date` | When next follow-up is due |
| `error_message` | Error details if failed |

## Gmail API Limits

- Personal Gmail: 500 emails/day
- Google Workspace: 2,000 emails/day

Keep `DAILY_LIMIT` well below these to avoid issues.

## License

MIT
