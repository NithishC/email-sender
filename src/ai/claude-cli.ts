import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ClaudeCliResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export class ClaudeCli {
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: { timeoutMs?: number; maxRetries?: number } = {}) {
    this.timeoutMs = options.timeoutMs || 120000; // 2 min default
    this.maxRetries = options.maxRetries || 2;
  }

  async execute(
    prompt: string,
    options: { allowWebSearch?: boolean } = {}
  ): Promise<ClaudeCliResult> {
    const startTime = Date.now();

    const args = ['-p', prompt, '--output-format', 'text'];

    // Enable web search tool if requested
    if (options.allowWebSearch) {
      args.push('--allowedTools', 'mcp__fetch__fetch,WebSearch');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const { stdout, stderr } = await execFileAsync('claude', args, {
          timeout: this.timeoutMs,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          windowsHide: true,
          shell: true,
        });

        if (stderr && stderr.trim()) {
          console.warn('Claude CLI stderr:', stderr);
        }

        return {
          success: true,
          output: stdout.trim(),
          durationMs: Date.now() - startTime,
        };
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
  }

  private isRetryableError(error: unknown): boolean {
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
