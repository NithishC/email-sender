import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeCliResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export class ClaudeCli {
  private timeoutMs: number;
  private maxRetries: number;
  private tempDir: string;

  constructor(options: { timeoutMs?: number; maxRetries?: number; tempDir?: string } = {}) {
    this.timeoutMs = options.timeoutMs || 300000; // 5 min default
    this.maxRetries = options.maxRetries || 2;
    this.tempDir = options.tempDir || path.join(process.cwd(), 'temp');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async execute(
    prompt: string,
    options: { allowWebSearch?: boolean } = {}
  ): Promise<ClaudeCliResult> {
    const startTime = Date.now();
    const timestamp = Date.now();

    // Write prompt to temp file
    const promptFile = path.join(this.tempDir, `prompt-${timestamp}.txt`);
    const outputFile = path.join(this.tempDir, `output-${timestamp}.txt`);
    fs.writeFileSync(promptFile, prompt, 'utf-8');

    try {
      // Convert Windows backslashes to forward slashes for Git Bash
      const outputFilePath = outputFile.replace(/\\/g, '/');

      // Build args array
      const args = ['--output-format', 'text'];

      // Enable web search tool if requested
      if (options.allowWebSearch) {
        args.push('--allowedTools', 'WebSearch');
      }

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          // Use cat to pipe prompt file to claude via stdin (Git Bash)
          const promptFilePath = promptFile.replace(/\\/g, '/');
          await new Promise<void>((resolve, reject) => {
            const cmd = `cat "${promptFilePath}" | claude -p - ${args.join(' ')} > "${outputFilePath}"`;
            exec(cmd, { timeout: this.timeoutMs, windowsHide: true, shell: 'C:\\Program Files\\Git\\bin\\bash.exe' }, (error: Error | null) => {
              if (error) reject(error);
              else resolve();
            });
          });

          // Read output from file
          if (fs.existsSync(outputFile)) {
            const output = fs.readFileSync(outputFile, 'utf-8').trim();
            return {
              success: true,
              output,
              durationMs: Date.now() - startTime,
            };
          }

          throw new Error('Output file not created');
        } catch (error) {
          lastError = error as Error;

          // Check if it's a timeout or rate limit - worth retrying
          const isRetryable = this.isRetryableError(error);

          if (!isRetryable || attempt === this.maxRetries) {
            break;
          }

          // Exponential backoff before retry
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
          console.log(`  Retry ${attempt + 1} after ${backoffMs}ms...`);
          await this.sleep(backoffMs);
        }
      }

      return {
        success: false,
        output: '',
        error: lastError?.message || 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(promptFile)) fs.unlinkSync(promptFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error && (error as Error & { killed?: boolean }).killed) return true;
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('etimedout')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
