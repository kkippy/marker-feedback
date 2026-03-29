import { describe, expect, it } from 'vitest';
import { createShareToken } from './token.js';

describe('createShareToken', () => {
  it('creates a 12 character token', () => {
    const token = createShareToken();
    expect(token).toHaveLength(12);
  });
});
