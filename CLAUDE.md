# CLAUDE.md

This file provides context for Claude Code and other AI assistants working on this project.

## Project Overview

Cold email campaign automation system built with Node.js/TypeScript. Sends personalized emails via Gmail API with automatic follow-ups, scheduled through GitHub Actions.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Email**: Gmail API with OAuth 2.0
- **Scheduling**: GitHub Actions (cron)
- **Data**: CSV files for contacts and tracking

## Key Files

| File | Purpose |
|------|---------|
| `src/campaign/campaign-runner.ts` | Main orchestration - ties everything together |
| `src/campaign/scheduler.ts` | Determines what emails to send each day |
| `src/auth/gmail-auth.ts` | Gmail OAuth 2.0 client with refresh token |
| `src/csv/tracking-manager.ts` | State persistence for email tracking |
| `src/email/template-engine.ts` | Variable substitution in templates |
| `src/email/gmail-sender.ts` | Sends emails via Gmail API |
| `.github/workflows/send-emails.yml` | GitHub Actions workflow |

## Architecture

```
contacts.csv → Scheduler → Gmail API → tracking.csv
                  ↑
            Template Engine
                  ↑
          data/templates/*.md
```

### Data Flow

1. `contact-parser.ts` reads `data/contacts.csv`
2. `tracking-manager.ts` loads `data/tracking.csv` to check state
3. `scheduler.ts` decides what to send (follow-ups first, then new contacts)
4. `template-engine.ts` renders email with contact variables
5. `gmail-sender.ts` sends via Gmail API
6. `tracking-manager.ts` updates and saves tracking state

## Common Tasks

### Adding a new template variable

1. Add the column to `data/contacts.csv`
2. Use `{{column_name}}` in templates - it works automatically

### Changing follow-up intervals

Edit `FOLLOW_UP_INTERVALS` in `.env` (comma-separated days):
```env
FOLLOW_UP_INTERVALS=3,7,14  # Follow up at 3, 7, and 14 days
MAX_FOLLOW_UPS=3            # Allow 3 follow-ups
```

### Adding a new email template

1. Create `data/templates/your-template.md` with frontmatter:
```markdown
---
subject: "Your Subject {{name}}"
---
Email body here
```

2. The scheduler uses templates named:
   - `initial` - first email
   - `followup-1`, `followup-2`, etc. - follow-ups

### Running locally

```bash
npm run campaign:dry-run  # Preview without sending
npm run campaign          # Send emails
```

## Environment Variables

Required in `.env` or GitHub Secrets:

| Variable | Description |
|----------|-------------|
| `GMAIL_CLIENT_ID` | OAuth client ID from Google Cloud |
| `GMAIL_CLIENT_SECRET` | OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Obtained via `npm run auth-setup` |
| `SENDER_EMAIL` | Gmail address to send from |
| `DAILY_LIMIT` | Max emails per run (default: 50) |
| `FOLLOW_UP_INTERVALS` | Days between follow-ups (default: 3,7) |
| `MAX_FOLLOW_UPS` | Max follow-up count (default: 2) |

## Code Patterns

### Error Handling

Errors are caught per-email and logged to `tracking.csv`:
```typescript
try {
  await sender.sendEmail(...);
  trackingManager.updateRecord(email, { status: 'sent' });
} catch (error) {
  trackingManager.updateRecord(email, { status: 'error', error_message: error.message });
}
```

### Rate Limiting

`RateLimiter` class enforces daily limits with delays between sends:
- 2-3 second delay between emails
- Hard stop at `DAILY_LIMIT`

### Template Variables

Use `{{variableName}}` syntax. Variables come from CSV columns:
```markdown
Hi {{name}}, I noticed {{company}} is in the {{industry}} space.
```

## Testing

```bash
# Type check
npx tsc --noEmit

# Dry run (doesn't send)
npm run campaign:dry-run
```

## Deployment

GitHub Actions runs daily at 9 AM UTC. Secrets must be configured in repo settings.

The workflow:
1. Checks out code
2. Installs dependencies
3. Runs campaign
4. Commits tracking.csv updates

## Gotchas

- **OAuth refresh tokens** expire in 7 days if Google Cloud project is in "Testing" mode. Set to "In Production" for persistent tokens.
- **YAML frontmatter** requires quotes around subjects with colons: `subject: "Re: Something"`
- **CSV encoding** must be UTF-8. The parser handles BOM from Excel.
- **Gmail limits** are 500/day for personal accounts. Stay well under to avoid issues.
