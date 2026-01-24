import * as dotenv from 'dotenv';
import * as path from 'path';
import { Config } from './types';

// Load .env file if it exists
dotenv.config();

function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${name}`);
  }
  return parsed;
}

function getEnvArray(name: string, defaultValue: number[]): number[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.split(',').map((v) => {
    const parsed = parseInt(v.trim(), 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid number in array for environment variable: ${name}`);
    }
    return parsed;
  });
}

export function loadConfig(isDryRun: boolean = false): Config {
  const projectRoot = process.cwd();

  return {
    gmail: {
      clientId: getEnvVar('GMAIL_CLIENT_ID', !isDryRun),
      clientSecret: getEnvVar('GMAIL_CLIENT_SECRET', !isDryRun),
      refreshToken: getEnvVar('GMAIL_REFRESH_TOKEN', !isDryRun),
      senderEmail: getEnvVar('SENDER_EMAIL', !isDryRun),
    },
    supabase: {
      url: getEnvVar('SUPABASE_URL', true),
      anonKey: getEnvVar('SUPABASE_ANON_KEY', true),
    },
    campaign: {
      dailyLimit: getEnvNumber('DAILY_LIMIT', 50),
      followUpIntervals: getEnvArray('FOLLOW_UP_INTERVALS', [3, 7]),
      maxFollowUps: getEnvNumber('MAX_FOLLOW_UPS', 2),
      campaignId: getEnvVar('CAMPAIGN_ID', false) || 'default',
    },
    paths: {
      templatesDir: process.env.TEMPLATES_DIR || path.join(projectRoot, 'data', 'templates'),
      promptsDir: process.env.PROMPTS_DIR || path.join(projectRoot, 'data', 'prompts'),
    },
    dryRun: isDryRun,
  };
}
