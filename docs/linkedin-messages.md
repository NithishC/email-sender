# LinkedIn Message Generation

Generate warm LinkedIn connection messages and follow-ups using the same AI-powered system as email generation.

## Features

- **300-character connection messages** (respects LinkedIn's limit)
- **3 follow-up messages** for after connection is accepted
- **Series B+ engineering targeting** with real metrics from resume
- **Web research** to personalize each message
- **Character count validation** to ensure LinkedIn compliance

---

## Quick Start

### Test with a Contact

```bash
# Edit temp/test-linkedin-generation.ts with your contact info
npx ts-node temp/test-linkedin-generation.ts
```

### Example Output

**Connection Message (248 chars):**
```
Hi Manoj,

Saw your work at Liberty Mutual. I scaled AI pipelines from 14h to 4h using ECS Fargate + SQS + Lambda at CharacterQuilt. Would love to connect and share notes on serverless infrastructure at scale.
```

**Follow-up 1 (After they accept):**
```
Thanks for connecting, Manoj!

Really impressed by Liberty Mutual's serverless-first approach and the work you're doing modernizing legacy systems at scale. I've dealt with similar challenges orchestrating multi-LLM systems with 200+ parallel executors at CharacterQuilt.

Happy to share notes on serverless patterns if that's useful. Worth a quick call if you're tackling distributed systems challenges this quarter?
```

**Follow-up 2 (3-4 days later):**
```
Hey Manoj,

Also built automated CI/CD for large-scale deployments at my last role, cut deploy cycles by 75% and reduced system downtime by 30%. Let me know if you want to chat about automation strategies.
```

**Follow-up 3 (7 days later - graceful close):**
```
No worries if timing isn't right! Happy to share how I approached infrastructure cost optimization (cut costs 40%) if you're ever tackling that.
```

---

## Message Structure

### Connection Message

**300 Character Limit Structure:**
1. `Hi [First Name],` - Greeting
2. **One-line hook** - Reference their work/initiative
3. **Quick credential** - ONE real metric from resume
4. **Soft close** - "Would love to connect"

**Key Rules:**
- Must be ≤ 300 characters (LinkedIn enforces this)
- Warm and professional, not salesy
- References their specific work
- Uses verifiable metrics only

### Follow-ups (After Connection)

**Follow-up 1** (within 24 hours):
- Thank them for connecting
- Reference their specific work
- Offer value or insight
- Optional soft ask for call
- 3-4 sentences

**Follow-up 2** (3-4 days later if no response):
- Add NEW value (different metric)
- 2-3 sentences
- Stay casual, not pushy

**Follow-up 3** (7 days later if no response):
- Graceful close
- Offer concrete resource
- 1-2 sentences
- No pressure

---

## Customizing for Your Use

### 1. Update Contact Info

Edit `temp/test-linkedin-generation.ts`:

```typescript
const contact: Contact = {
  email: 'their.email@company.com',
  name: 'Their Name',
  title: 'Their Title',
  company_name: 'Company Name',
  is_emails_enriched: true,
};
```

### 2. Update Your Background

The `senderInfo` is defined in:
- `src/campaign/generation-runner.ts` (lines 157-185) - Production
- `temp/test-linkedin-generation.ts` - Testing

Make sure all metrics are real and from your resume.

### 3. Adjust Message Tone

Edit prompt files in `data/prompts/`:
- `linkedin-connection.md` - Connection message guidelines
- `linkedin-followup.md` - Follow-up guidelines
- `research-guidelines.md` - Research focus (shared with emails)

---

## Implementation Details

### Files Created

| File | Purpose |
|------|---------|
| `data/prompts/linkedin-connection.md` | Connection message style guide |
| `data/prompts/linkedin-followup.md` | Follow-up message style guide |
| `src/ai/linkedin-parser.ts` | Parser for LinkedIn message output |
| `temp/test-linkedin-generation.ts` | Test script |

### Method Added to PromptBuilder

```typescript
buildLinkedInSequencePrompt(contact: Contact): string
```

This generates the full prompt for Claude CLI with:
- Research guidelines
- Connection message constraints (300 chars)
- Follow-up structure
- Real metrics from resume

### Character Count Validation

The `LinkedInParser` automatically:
- Counts characters in connection message
- Warns if over 300 characters
- Displays count in output

---

## LinkedIn vs Email Differences

| Aspect | LinkedIn | Email |
|--------|----------|-------|
| **Connection message** | 300 char limit | No limit |
| **Tone** | More casual | Professional but direct |
| **Greeting** | "Hi [Name]," | "Hi [First Name]," |
| **Links** | After connection | Not in initial email |
| **Signature** | LinkedIn handles it | Gmail handles it |
| **Follow-up timing** | 24h, 3-4d, 7d | 3d, 7d, 10d |

---

## Tips for LinkedIn Outreach

1. **Connection message is critical**: You have 300 characters to make an impression
2. **Reference specific work**: Generic messages get ignored
3. **One metric is enough**: Pick the most relevant from your resume
4. **Follow up fast**: Send Follow-up 1 within 24 hours of connection
5. **Add value**: Every message should offer something useful
6. **Know when to stop**: Follow-up 3 is the graceful exit

---

## Troubleshooting

### "Connection message is 350 characters"
- Edit the prompt output manually to shorten
- Remove filler words like "really", "just", "actually"
- Cut the metric details slightly
- Rerun generation with more explicit 300-char instruction

### "Messages sound too formal"
- Edit `data/prompts/linkedin-followup.md` to be more casual
- Add examples of your preferred tone
- Mention "conversational like a Slack DM"

### "Not using my resume metrics"
- Check that `senderInfo.background` has your real metrics
- Add explicit warning in prompt about not fabricating
- Review generated output and manually replace fabricated metrics

---

## Production Integration (Future)

To integrate LinkedIn messages into the main campaign system:

1. Add LinkedIn message fields to `contacts` table:
```sql
ALTER TABLE contacts ADD COLUMN linkedin_connection_message TEXT;
ALTER TABLE contacts ADD COLUMN linkedin_follow_up_1 TEXT;
ALTER TABLE contacts ADD COLUMN linkedin_follow_up_2 TEXT;
ALTER TABLE contacts ADD COLUMN linkedin_follow_up_3 TEXT;
```

2. Add `linkedin_tracking` table for status tracking

3. Create LinkedIn sender (using LinkedIn API or manual workflow)

4. Add `npm run generate:linkedin` command

5. Integrate with existing campaign workflow
