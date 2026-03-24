import * as fs from 'fs';
import * as path from 'path';
import { Contact } from '../types';

export interface SenderInfo {
  name: string;
  email: string;
  linkedin: string;
  github: string;
  currentRole: string;
  background: string;
}

export class PromptBuilder {
  private promptsDir: string;
  private senderInfo: SenderInfo;

  constructor(promptsDir: string, senderInfo: SenderInfo) {
    this.promptsDir = promptsDir;
    this.senderInfo = senderInfo;
  }

  // Build prompt to generate all 4 emails at once
  buildFullSequencePrompt(contact: Contact): string {
    const researchGuidelines = this.loadPromptTemplate('research-guidelines.md');
    const initialGuidelines = this.loadPromptTemplate('initial.md');
    const followupGuidelines = this.loadPromptTemplate('followup.md');

    return `
# Task: Generate a cold email sequence to connect with someone whose work interests me (4 emails)

The goal is to start a genuine conversation, NOT to ask for a job. I want to connect with people doing interesting work in tech/AI.

## About Me
- Name: ${this.senderInfo.name}
- Current Role: ${this.senderInfo.currentRole}
- LinkedIn: ${this.senderInfo.linkedin}
- GitHub: ${this.senderInfo.github}

### My Background - ONLY USE THESE REAL METRICS (pick ONE most relevant, don't make up anything):
${this.senderInfo.background}

**CRITICAL**: Only use achievements and metrics listed above. These are real, verifiable accomplishments. Do NOT invent or exaggerate metrics.

## Target Contact
- Name: ${contact.name}
${contact.company_name ? `- Company: ${contact.company_name}` : ''}
${contact.title ? `- Title: ${contact.title}` : ''}

## Step 1: Research the Contact and Company

${researchGuidelines}

Use web search to find:
1. What ${contact.company_name || 'their company'} builds and why it's interesting
2. Recent news, product launches, or tech they use
3. The contact's role and anything they've written/spoken about
4. **${contact.name}'s recent LinkedIn posts** (search: "${contact.name} ${contact.company_name} LinkedIn" or "site:linkedin.com ${contact.name}")
5. **Recent job postings at ${contact.company_name}** (search: "${contact.company_name} software engineer jobs 2026" or "site:linkedin.com/jobs ${contact.company_name}")
6. Something genuinely interesting I could ask about or discuss

Summarize research in 4-5 bullet points including:
- What the company does and recent news
- Any LinkedIn activity from the contact
- Any relevant job openings (mention team/role if found)
- Connection points for the email

## Step 2: Write the Initial Email

${initialGuidelines}

## Step 3: Write 3 Follow-up Emails

${followupGuidelines}

Follow-up timing context:
- Follow-up 1: Sent 3 days after initial (if no reply)
- Follow-up 2: Sent 7 days after initial (if no reply)
- Follow-up 3: Sent 14 days after initial (final attempt)

Each follow-up should:
- Add new value or a different angle
- Be progressively shorter
- Follow-up 3 should gracefully close the loop

## Important Style Notes - THIS IS CRITICAL
- Write like a quick Slack message, NOT a formal email
- NEVER use em-dashes (—). Use commas or periods instead.
- Be direct: "I'll keep this brief" not "I hope this email finds you well"
- Be confident: "My background is a perfect fit" not "I think I might be relevant"
- Can use casual emoji like :) at the end
- NO signature or sign-off at all (Gmail signature is pre-configured and will be added automatically)
- NO "Best," "Nithish," "Thanks," etc. - just end with the content
- NO buzzwords like "synergy," "leverage," or "cutting-edge"
- NO philosophical statements like "I've been thinking about..."
- NO passive language like "got curious about" or "came across"

## Output Format

Provide your response in EXACTLY this format:

---RESEARCH---
[Your research summary as bullet points]

---INITIAL_SUBJECT---
[Subject line for initial email]
---INITIAL_BODY---
[Body of initial email]

---FOLLOWUP1_SUBJECT---
[Subject line for follow-up 1]
---FOLLOWUP1_BODY---
[Body of follow-up 1]

---FOLLOWUP2_SUBJECT---
[Subject line for follow-up 2]
---FOLLOWUP2_BODY---
[Body of follow-up 2]

---FOLLOWUP3_SUBJECT---
[Subject line for follow-up 3]
---FOLLOWUP3_BODY---
[Body of follow-up 3]
---END---
`.trim();
  }

  private loadPromptTemplate(filename: string): string {
    const filePath = path.join(this.promptsDir, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim();
    }
    return this.getDefaultTemplate(filename);
  }

  // Build prompt to generate LinkedIn connection message + 3 follow-ups
  buildLinkedInSequencePrompt(contact: Contact): string {
    const researchGuidelines = this.loadPromptTemplate('research-guidelines.md');
    const connectionGuidelines = this.loadPromptTemplate('linkedin-connection.md');
    const followupGuidelines = this.loadPromptTemplate('linkedin-followup.md');

    return `
# Task: Generate LinkedIn connection message and follow-up sequence

The goal is to connect with someone doing interesting work in Series B+ engineering and start a genuine conversation.

## About Me
- Name: ${this.senderInfo.name}
- Current Role: ${this.senderInfo.currentRole}
- LinkedIn: ${this.senderInfo.linkedin}
- GitHub: ${this.senderInfo.github}

### My Background - ONLY USE THESE REAL METRICS (pick ONE most relevant for connection message):
${this.senderInfo.background}

**CRITICAL**: Only use achievements and metrics listed above. These are real, verifiable accomplishments. Do NOT invent or exaggerate metrics.

## Target Contact
- Name: ${contact.name}
${contact.company_name ? `- Company: ${contact.company_name}` : ''}
${contact.title ? `- Title: ${contact.title}` : ''}

## Step 1: Research the Contact and Company

${researchGuidelines}

Use web search to find:
1. What ${contact.company_name || 'their company'} builds and recent B+ engineering challenges
2. **${contact.name}'s recent LinkedIn posts** (last 7-14 days)
3. **Recent job postings at ${contact.company_name}** for platform/infrastructure/SRE roles
4. Their specific initiative or system they're building
5. Connection points for the message

Summarize research in 4-5 bullet points.

## Step 2: Write Connection Message (MAX 300 CHARACTERS)

${connectionGuidelines}

**CRITICAL**: The connection message MUST be 300 characters or less (including "Hi [Name],").

## Step 3: Write 3 Follow-up Messages (for after connection is accepted)

${followupGuidelines}

Follow-up timing context:
- Follow-up 1: Sent within 24 hours after they accept
- Follow-up 2: Sent 3-4 days later if no response
- Follow-up 3: Sent 7 days later if no response (graceful close)

## Output Format

Provide your response in EXACTLY this format:

## Research Summary
[Your research summary as bullet points]

## Connection Message
[LinkedIn connection message - MAX 300 CHARACTERS including "Hi [Name],"]

## Follow-up 1
[First message after connection - 3-4 sentences]

## Follow-up 2
[Second follow-up if no response - 2-3 sentences]

## Follow-up 3
[Final follow-up - 1-2 sentences, graceful close]
`.trim();
  }

  private getDefaultTemplate(filename: string): string {
    switch (filename) {
      case 'research-guidelines.md':
        return `Focus on finding 1-2 specific talking points that create a genuine connection.`;
      case 'initial.md':
        return `Write a cold email that is:
- 4-6 sentences maximum
- References something specific about their work
- Includes one relevant accomplishment
- Asks about opportunities in a low-pressure way`;
      case 'followup.md':
        return `Write follow-up emails that:
- Add new value, don't repeat
- Are 2-3 sentences max
- Stay confident, not desperate`;
      case 'linkedin-connection.md':
        return `Write a LinkedIn connection message under 300 characters that is warm and professional.`;
      case 'linkedin-followup.md':
        return `Write follow-ups after connection that add value and stay casual.`;
      default:
        return '';
    }
  }
}
