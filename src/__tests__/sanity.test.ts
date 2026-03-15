import { describe, it, expect } from 'vitest';

describe('Initial Setup Verification', () => {
  it('should pass a basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to global variables', () => {
    expect(vi).toBeDefined();
  });
});
