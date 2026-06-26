import Anthropic from '@anthropic-ai/sdk';

// Singleton Anthropic client. Reads ANTHROPIC_API_KEY from the environment.
// Node-runtime only — never import this from edge code or middleware.

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic =
  globalForAnthropic.anthropic ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic;

export const CLIP_MODEL = 'claude-opus-4-8';
