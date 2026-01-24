import * as fs from 'fs';
import * as path from 'path';
import { Contact } from '../types';

export interface SenderInfo {
  name: string;
  company: string;
  role: string;
  valueProposition: string;
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
# Task: Generate a complete cold email sequence (4 emails)

## Contact Information
- Name: ${contact.name}
- Email: ${contact.email}
${contact.company_name ? `- Company: ${contact.company_name}` : ''}
${contact.title ? `- Title: ${contact.title}` : ''}

## Sender Information
- Name: ${this.senderInfo.name}
- Company: ${this.senderInfo.company}
- Role: ${this.senderInfo.role}
- Value Proposition: ${this.senderInfo.valueProposition}

## Step 1: Research the Contact and Company

${researchGuidelines}

Use web search to find:
1. Recent news about ${contact.company_name || 'their company'} (funding, product launches, hiring)
2. The contact's recent posts, talks, or articles
3. Company challenges and opportunities
4. Any connection points between our companies

Summarize your research findings in 2-3 bullet points.

## Step 2: Write the Initial Email

${initialGuidelines}

## Step 3: Write 3 Follow-up Emails

${followupGuidelines}

Follow-up timing context:
- Follow-up 1: Sent 3 days after initial (if no reply)
- Follow-up 2: Sent 7 days after initial (if no reply)
- Follow-up 3: Sent 14 days after initial (final attempt)

Each follow-up should:
- Add new value or angle
- Be progressively shorter
- Follow-up 3 should gracefully close the loop

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

  private getDefaultTemplate(filename: string): string {
    switch (filename) {
      case 'research-guidelines.md':
        return `Focus on finding 1-2 specific, recent talking points that demonstrate genuine research. Avoid generic observations.`;
      case 'initial.md':
        return `Write a cold email that is:
- 3-5 sentences maximum
- References something specific from your research
- Has one clear value proposition
- Ends with a simple, low-commitment call to action
- Does not start with "I" or "Hope this finds you well"`;
      case 'followup.md':
        return `Write follow-up emails that:
- Don't re-pitch, add new value instead
- Are 2-3 sentences max
- Acknowledge they're follow-ups naturally`;
      default:
        return '';
    }
  }

}
