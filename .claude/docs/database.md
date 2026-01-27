# Database Schema Guide

This document describes the Supabase PostgreSQL database schema used in the Cold Email Campaign system.

## Overview

The project uses Supabase as its database backend with 2 main tables:
- `contacts` - Contact information and generated emails (email as PK)
- `email_tracking` - Status and history of sent emails (FK to contacts)

---

## Tables

### 1. `contacts`

Stores contact information and all generated email content.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `email` | TEXT | No | - | **Primary key** - Contact email |
| `name` | TEXT | No | - | Contact name |
| `title` | TEXT | Yes | null | Job title |
| `company_name` | TEXT | Yes | null | Company name |
| `is_emails_enriched` | BOOLEAN | No | false | Whether emails have been generated |
| `initial_email_subject` | TEXT | Yes | null | Subject for initial email |
| `initial_email` | TEXT | Yes | null | Body of initial email |
| `follow_up_1_subject` | TEXT | Yes | null | Subject for first follow-up |
| `follow_up_1` | TEXT | Yes | null | Body of first follow-up |
| `follow_up_2_subject` | TEXT | Yes | null | Subject for second follow-up |
| `follow_up_2` | TEXT | Yes | null | Body of second follow-up |
| `follow_up_3_subject` | TEXT | Yes | null | Subject for third follow-up |
| `follow_up_3` | TEXT | Yes | null | Body of third follow-up |
| `research_summary` | TEXT | Yes | null | AI-generated research context |
| `created_at` | TIMESTAMPTZ | No | now() | Record creation time |
| `updated_at` | TIMESTAMPTZ | No | now() | Last update time |

**Common Queries:**
```sql
-- Get contacts needing email generation
SELECT * FROM contacts
WHERE is_emails_enriched = false
ORDER BY created_at ASC;

-- Get contacts with generated emails (ready to send)
SELECT * FROM contacts
WHERE is_emails_enriched = true
ORDER BY created_at ASC;

-- Find contact by email
SELECT * FROM contacts WHERE email = 'user@example.com';
```

---

### 2. `email_tracking`

Tracks status and history of emails sent to each contact.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `email` | TEXT | No | - | **Primary key** - FK to contacts(email) |
| `campaign_id` | TEXT | No | 'default' | Campaign identifier |
| `status` | TEXT | No | 'pending' | Current status (see values below) |
| `initial_sent_date` | TIMESTAMPTZ | Yes | null | When first email was sent |
| `last_sent_date` | TIMESTAMPTZ | Yes | null | Most recent send time |
| `follow_up_count` | INTEGER | No | 0 | Number of follow-ups sent |
| `next_follow_up_date` | DATE | Yes | null | When next follow-up is due |
| `error_message` | TEXT | Yes | null | Error details if failed |
| `created_at` | TIMESTAMPTZ | No | now() | Record creation time |
| `updated_at` | TIMESTAMPTZ | No | now() | Last update time |

**Status Values:**
- `pending` - Not yet sent
- `sent` - Initial email sent
- `follow_up_1` - First follow-up sent
- `follow_up_2` - Second follow-up sent
- `follow_up_3` - Third follow-up sent
- `completed` - All follow-ups sent
- `replied` - Contact replied (auto-detected)
- `error` - Send failed
- `bounced` - Email bounced

**Status Workflow:**
```
pending → sent → follow_up_1 → follow_up_2 → follow_up_3 → completed
                     ↓              ↓              ↓
                  replied       replied        replied    (auto-detected, stops follow-ups)
                                                          ↓
                                                     error/bounced
```

---

## Relationships

**Foreign key constraint** from `email_tracking` to `contacts`:

```sql
email_tracking.email REFERENCES contacts(email) ON DELETE CASCADE
```

```
┌─────────────────────────────────────┐       ┌─────────────────────────┐
│            contacts                 │       │      email_tracking     │
│                                     │       │                         │
│  email (PK) ◄───────────────────────│───────│  email (PK, FK)         │
│  name                               │       │  campaign_id            │
│  title                              │       │  status                 │
│  company_name                       │       │  follow_up_count        │
│  is_emails_enriched                 │       │  next_follow_up_date    │
│  initial_email_subject              │       │  ...                    │
│  initial_email                      │       └─────────────────────────┘
│  follow_up_1_subject                │
│  follow_up_1                        │
│  follow_up_2_subject                │
│  follow_up_2                        │
│  follow_up_3_subject                │
│  follow_up_3                        │
│  research_summary                   │
│  created_at                         │
│  updated_at                         │
└─────────────────────────────────────┘
```

---

## Data Flow

```
┌─────────────────────────────────────┐
│            contacts                 │
│   (is_emails_enriched = false)      │  1. Contacts needing emails
└────────────────┬────────────────────┘
                 │
                 ├──→ GenerationRunner (Claude CLI - LOCAL)
                 │    ├──→ Build prompt with contact data
                 │    ├──→ Run claude -p "prompt" --allowedTools WebSearch
                 │    ├──→ Parse 4 emails from output
                 │    └──→ Update contacts (set is_emails_enriched = true)
                 │
                 ▼
┌─────────────────────────────────────┐
│            contacts                 │
│   (is_emails_enriched = true)       │  2. Review/edit emails in Supabase
│   initial_email, follow_up_1, ...   │
└────────────────┬────────────────────┘
                 │
                 ├──→ SendRunner (GitHub Actions)
                 │    ├──→ Load enriched contacts
                 │    ├──→ Check email_tracking for status
                 │    ├──→ Send appropriate email via Gmail
                 │    └──→ Update email_tracking
                 │
                 ▼
┌─────────────────────────────────────┐
│         email_tracking              │  3. Final state persisted
│   status, follow_up_count, etc.     │
└─────────────────────────────────────┘
```

---

## Design Notes

1. **Email as Primary Key**: contacts.email is the PK - no UUID needed
2. **Foreign Key Constraint**: email_tracking.email references contacts.email with CASCADE delete
3. **Emails in Contacts**: All 4 emails stored directly in contacts table
4. **is_emails_enriched Flag**: Boolean indicates whether emails have been generated
5. **No Soft Deletes**: Delete contacts directly when not needed (bounced/unsubscribed tracked via email_tracking.status)
6. **Local Generation**: Claude CLI runs locally, GitHub Actions only sends
7. **Review in Supabase**: Edit emails directly in contacts table before sending

---

## Workflow Commands

```bash
# Generate emails locally (runs Claude CLI)
npm run generate

# Preview what would be sent (dry run)
npm run send:dry-run

# Send emails (usually via GitHub Actions)
npm run send

# Check inbox for replies (marks contacts as 'replied')
npm run check-replies

# Preview reply detection (dry run)
npm run check-replies:dry-run
```