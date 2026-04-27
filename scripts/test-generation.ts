import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ClaudeCli } from '../src/ai/claude-cli';
import { PromptBuilder, SenderInfo } from '../src/ai/prompt-builder';
import { Contact } from '../src/types';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

function loadSenderInfo(): SenderInfo {
  const backgroundPath = path.join(process.cwd(), 'data', 'prompts', 'sender-background.md');
  let background = '';
  if (fs.existsSync(backgroundPath)) {
    background = fs.readFileSync(backgroundPath, 'utf-8').trim();
  } else {
    console.warn('Warning: data/prompts/sender-background.md not found. Background will be empty.');
  }
  return {
    name: process.env.SENDER_NAME || '',
    email: process.env.SENDER_EMAIL || '',
    linkedin: process.env.SENDER_LINKEDIN || '',
    github: process.env.SENDER_GITHUB || '',
    currentRole: process.env.SENDER_ROLE || '',
    background,
  };
}

const SENDER_INFO: SenderInfo = loadSenderInfo();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: npx ts-node scripts/test-generation.ts <email>');
    console.log('Example: npx ts-node scripts/test-generation.ts caitlin.stanley@affirm.com');
    process.exit(1);
  }

  console.log(`\n🔍 Testing email generation for: ${email}`);
  console.log('   (This will NOT update Supabase - just shows output)\n');

  // Fetch contact from Supabase (read only)
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('email, name, title, company_name')
    .eq('email', email)
    .single();

  if (error || !contact) {
    console.error('Contact not found:', error?.message || 'No data');
    process.exit(1);
  }

  console.log('📋 Contact Info:');
  console.log(`   Name: ${contact.name}`);
  console.log(`   Title: ${contact.title}`);
  console.log(`   Company: ${contact.company_name}`);
  console.log('');

  // Build prompt with new research guidelines
  const promptBuilder = new PromptBuilder('data/prompts', SENDER_INFO);
  const prompt = promptBuilder.buildFullSequencePrompt(contact as Contact);

  console.log('📝 Prompt includes enhanced research for:');
  console.log('   - LinkedIn posts from contact');
  console.log('   - Recent job postings at company');
  console.log('');

  // Execute Claude CLI
  console.log('🤖 Calling Claude CLI with web search...');
  console.log('   (This may take 60-120 seconds)\n');

  const claudeCli = new ClaudeCli({ timeoutMs: 180000 }); // 3 min timeout
  const result = await claudeCli.execute(prompt, { allowWebSearch: true });

  if (!result.success) {
    console.error('❌ Claude CLI failed:', result.error);
    process.exit(1);
  }

  console.log(`✅ Response received (${(result.durationMs / 1000).toFixed(1)}s)\n`);
  console.log('═'.repeat(80));
  console.log('FULL CLAUDE OUTPUT (with enhanced research):');
  console.log('═'.repeat(80));
  console.log(result.output);
  console.log('═'.repeat(80));
  console.log('\n⚠️  Supabase was NOT updated. This was just a test run.');
}

main().catch(console.error);