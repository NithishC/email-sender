import { google } from 'googleapis';
import { gmail_v1 } from 'googleapis';
import { Config } from '../types';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic', // For reading signatures
  'https://www.googleapis.com/auth/gmail.labels', // For adding labels
];

export class GmailAuthClient {
  private oauth2Client;
  private config: Config['gmail'];

  constructor(config: Config['gmail']) {
    this.config = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    // Set refresh token
    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    });
  }

  async getGmailClient(): Promise<gmail_v1.Gmail> {
    // The googleapis library will automatically refresh the access token
    // when using the refresh_token
    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  static getAuthUrl(clientId: string, clientSecret: string): string {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force refresh token generation
    });
  }

  static async getTokenFromCode(
    clientId: string,
    clientSecret: string,
    code: string
  ): Promise<string | null | undefined> {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens.refresh_token;
  }
}
