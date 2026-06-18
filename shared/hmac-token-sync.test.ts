import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `shared/hmac-token.ts` (Vitest/browser) and `supabase/functions/_shared/hmac-token.ts`
// (Deno Edge Function) are intentional duplicates — the two runtimes can't share a
// single import path. They MUST stay code-identical or the email portal links signed by
// the webhook won't verify in `create-billing-portal`. This test fails if they drift.
// Comment lines (`//`) are allowed to differ; everything else must match.
// Paths are resolved from the repo root (Vitest's cwd) to avoid import.meta, which the
// CommonJS electron tsconfig that also compiles shared/ does not allow.

const sharedPath = join(process.cwd(), 'shared', 'hmac-token.ts');
const denoPath = join(process.cwd(), 'supabase', 'functions', '_shared', 'hmac-token.ts');

function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .trim();
}

describe('hmac-token.ts duplicate sync', () => {
  it('keeps shared/ and _shared/ functionally identical (comments may differ)', () => {
    const shared = stripComments(readFileSync(sharedPath, 'utf8'));
    const deno = stripComments(readFileSync(denoPath, 'utf8'));
    expect(deno).toBe(shared);
  });
});
