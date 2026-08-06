import { describe, it, expect } from 'vitest';
import { uploadFile } from '../src/storage/index.js';

describe('storage', () => {
  it('uploads a file to Supabase Storage and returns a public URL', async () => {
    const url = await uploadFile('test-uploads', Buffer.from('hello world'), 'text/plain', 'sample.txt');
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('sample.txt');
  });
});
