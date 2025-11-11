import { describe, expect, it } from 'vitest';
import type { WorkflowInput } from '../mastra/workflows/message-processing-workflow';

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-key';
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'service-role-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'anon-key';

const { resolveDetermineInputOutput } = await import(
  '../mastra/workflows/message-processing-workflow'
);

const FIXED_DATE = new Date('2025-01-15T12:00:00Z');

describe('resolveDetermineInputOutput', () => {
  const baseInput: Omit<WorkflowInput, 'messageText' | 'voiceFilePath' | 'photoFilePath'> = {
    userId: 123,
    messageId: 456,
    timezone: 'UTC',
  };

  it('detects text input and normalizes spacing', () => {
    const input: WorkflowInput = {
      ...baseInput,
      messageText: '  I spent 50 AED  ',
      timezone: 'Asia/Dubai',
    };

    const result = resolveDetermineInputOutput(input, FIXED_DATE);

    expect(result.inputType).toBe('text');
    expect(result.messageText).toBe('I spent 50 AED');
    expect(result.currentDate).toBe('2025-01-15');
    expect(result.currentTime).toBe('2025-01-15T16:00:00+04:00');
    expect(result.yesterday).toBe('2025-01-14');
    expect(result.timezone).toBe('Asia/Dubai');
  });

  it('detects voice input when no text is provided', () => {
    const input: WorkflowInput = {
      ...baseInput,
      voiceFilePath: '/tmp/voice.ogg',
    };

    const result = resolveDetermineInputOutput(input, FIXED_DATE);

    expect(result.inputType).toBe('voice');
    expect(result.voiceFilePath).toBe('/tmp/voice.ogg');
    expect(result.messageText).toBeUndefined();
    expect(result.currentTime).toBe('2025-01-15T12:00:00Z');
  });

  it('detects photo input when only photo is provided', () => {
    const input: WorkflowInput = {
      ...baseInput,
      photoFilePath: '/tmp/receipt.jpg',
    };

    const result = resolveDetermineInputOutput(input, FIXED_DATE);

    expect(result.inputType).toBe('photo');
    expect(result.photoFilePath).toBe('/tmp/receipt.jpg');
  });

  it('prefers text when both text and voice are available', () => {
    const input: WorkflowInput = {
      ...baseInput,
      messageText: 'Groceries 120 AED',
      voiceFilePath: '/tmp/voice.ogg',
    };

    const result = resolveDetermineInputOutput(input, FIXED_DATE);

    expect(result.inputType).toBe('text');
    expect(result.messageText).toBe('Groceries 120 AED');
  });

  it('uses UTC timezone by default', () => {
    const input: WorkflowInput = {
      ...baseInput,
      timezone: undefined,
      messageText: 'Rent 3000 AED',
    };

    const result = resolveDetermineInputOutput(input, FIXED_DATE);

    expect(result.timezone).toBe('UTC');
    expect(result.currentDate).toBe('2025-01-15');
  });

  it('throws for unsupported message types', () => {
    const input: WorkflowInput = {
      ...baseInput,
    };

    expect(() => resolveDetermineInputOutput(input, FIXED_DATE)).toThrow(
      /Unsupported message type/
    );
  });
});

