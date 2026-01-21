import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { GmailAuthClient } from '../src/auth/gmail-auth';

dotenv.config();

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env file');
    console.log('\nTo get these values:');
    console.log('1. Go to https://console.cloud.google.com');
    console.log('2. Create a new project (or select existing)');
    console.log('3. Enable the Gmail API');
    console.log('4. Configure OAuth consent screen');
    console.log('   - Choose "External" user type');
    console.log('   - Add your email as a test user');
    console.log('   - Set publishing status to "In Production" for persistent refresh tokens');
    console.log('5. Create OAuth 2.0 Client ID (Desktop app type)');
    console.log('6. Copy Client ID and Client Secret to your .env file');
    process.exit(1);
  }

  console.log('Gmail OAuth Setup');
  console.log('=================\n');

  // Generate auth URL
  const authUrl = GmailAuthClient.getAuthUrl(clientId, clientSecret);

  console.log('Step 1: Open this URL in your browser and authorize the app:\n');
  console.log(authUrl);
  console.log('\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Step 2: Paste the authorization code here: ', async (code) => {
    try {
      const refreshToken = await GmailAuthClient.getTokenFromCode(
        clientId,
        clientSecret,
        code.trim()
      );

      if (!refreshToken) {
        console.error('\nError: Failed to get refresh token. Try again with prompt: consent');
        rl.close();
        process.exit(1);
      }

      console.log('\n=== SUCCESS ===\n');
      console.log('Your refresh token (save this as GMAIL_REFRESH_TOKEN):');
      console.log('\n' + refreshToken + '\n');
      console.log('\nAdd this to your .env file or GitHub Secrets:');
      console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
      console.log('\n');
      console.log('IMPORTANT: Keep this token secure! Do not commit it to git.');
    } catch (error) {
      console.error('\nError getting token:', error);
    }

    rl.close();
  });
}

main();
