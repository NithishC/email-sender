import { gmail_v1 } from 'googleapis';
import { SendResult } from '../types';

export class GmailSender {
  private gmail: gmail_v1.Gmail;
  private senderEmail: string;

  constructor(gmail: gmail_v1.Gmail, senderEmail: string) {
    this.gmail = gmail;
    this.senderEmail = senderEmail;
  }

  async sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
    try {
      // Construct RFC 2822 formatted email
      const message = this.createMessage(to, subject, body);

      // Base64url encode the message
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const result = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        success: true,
        messageId: result.data.id || undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error types
      if (this.isRateLimitError(error)) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      if (this.isAuthError(error)) {
        return {
          success: false,
          error: 'Authentication failed. Refresh token may have expired.',
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private createMessage(to: string, subject: string, body: string): string {
    const lines = [
      `From: ${this.senderEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ];

    return lines.join('\r\n');
  }

  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as { code: number }).code === 429;
    }
    return false;
  }

  private isAuthError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code: number }).code;
      return code === 401 || code === 403;
    }
    return false;
  }
}
