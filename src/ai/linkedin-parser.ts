export interface LinkedInMessages {
  research_summary?: string;
  connection_message: string;
  connection_char_count: number;
  follow_up_1: string;
  follow_up_2: string;
  follow_up_3: string;
}

export class LinkedInParser {
  parseLinkedInSequence(output: string): LinkedInMessages | null {
    try {
      // Extract research summary
      const researchMatch = output.match(/## Research Summary\s+([\s\S]*?)(?=## Connection Message|$)/i);
      const research_summary = researchMatch ? researchMatch[1].trim() : undefined;

      // Extract connection message
      const connectionMatch = output.match(/## Connection Message\s+([\s\S]*?)(?=## Follow-up|$)/i);
      if (!connectionMatch) {
        console.error('Could not find Connection Message section');
        return null;
      }

      const connection_message = connectionMatch[1].trim();
      const connection_char_count = connection_message.length;

      // Validate 300 char limit
      if (connection_char_count > 300) {
        console.warn(`⚠️  Connection message is ${connection_char_count} chars (limit: 300)`);
      }

      // Extract follow-up 1
      const followUp1Match = output.match(/## Follow-up 1.*?\n([\s\S]*?)(?=## Follow-up 2|$)/i);
      if (!followUp1Match) {
        console.error('Could not find Follow-up 1 section');
        return null;
      }
      const follow_up_1 = followUp1Match[1].trim();

      // Extract follow-up 2
      const followUp2Match = output.match(/## Follow-up 2.*?\n([\s\S]*?)(?=## Follow-up 3|$)/i);
      if (!followUp2Match) {
        console.error('Could not find Follow-up 2 section');
        return null;
      }
      const follow_up_2 = followUp2Match[1].trim();

      // Extract follow-up 3
      const followUp3Match = output.match(/## Follow-up 3.*?\n([\s\S]*?)$/i);
      if (!followUp3Match) {
        console.error('Could not find Follow-up 3 section');
        return null;
      }
      const follow_up_3 = followUp3Match[1].trim();

      return {
        research_summary,
        connection_message,
        connection_char_count,
        follow_up_1,
        follow_up_2,
        follow_up_3,
      };
    } catch (error) {
      console.error('Error parsing LinkedIn messages:', error);
      return null;
    }
  }
}
