import { google } from 'googleapis';
import { gmail_v1 } from 'googleapis';
import { Config } from '../types';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify', // For adding labels to messages
];

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

export class GmailAuthClient {
  private oauth2Client;
  private config: Config['gmail'];

  constructor(config: Config['gmail']) {
    this.config = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      REDIRECT_URI
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
      REDIRECT_URI
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
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    return tokens.refresh_token;
  }
}
