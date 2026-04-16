---
name: stop-and-archive
description: Stop follow-ups for a contact and move them to the archived_contacts table. Use this skill whenever a prospect replies to an email, says they're not interested, unsubscribes, or the user wants to stop emailing someone. Also trigger when the user mentions "they replied", "got a response", "stop following up", "archive this contact", "mark as done", or "remove from campaign". Always do both steps together — stop follow-ups AND archive.
---

# Stop Follow-ups and Archive Contact

Use this when a prospect has replied, unsubscribed, or the user wants to stop sending emails to them.

## What this does
1. Sets `email_tracking.status = 'completed'` and clears `next_follow_up_date` — no more emails will be sent
2. Moves the contact from `contacts` to `archived_contacts` (with `archived_at` timestamp)
3. Deletes the contact from `contacts`

The tracking record in `email_tracking` is preserved for history.

## Steps

### Step 1: Get the email address

Extract it from the conversation — the user will usually have just mentioned it or shown the reply. If it's ambiguous, ask once.

### Step 2: Run the script

```bash
npx ts-node scripts/stop-and-archive.ts <email>
```

### Step 3: Confirm to the user

Tell them:
- Follow-ups stopped
- Contact archived
- No more emails will be sent to that address
