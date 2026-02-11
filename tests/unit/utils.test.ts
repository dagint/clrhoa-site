/**
 * Example utility tests
 * Add your utility function tests here
 */

import { describe, it, expect } from 'vitest';

describe('Utility Functions', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle string operations', () => {
    const str = 'Crooked Lake Reserve';
    expect(str.toLowerCase()).toBe('crooked lake reserve');
    expect(str.length).toBeGreaterThan(0);
  });

  it('should handle array operations', () => {
    const items = ['home', 'about', 'contact'];
    expect(items).toHaveLength(3);
    expect(items).toContain('about');
  });
});
