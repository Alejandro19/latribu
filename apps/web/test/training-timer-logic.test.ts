import { describe, it, expect } from 'vitest';
import { parseTimeToSeconds, youtubeEmbedUrl } from '../lib/training-timer-logic';

describe('parseTimeToSeconds', () => {
  it('parses mm:ss', () => {
    expect(parseTimeToSeconds('01:30')).toBe(90);
    expect(parseTimeToSeconds('02:00')).toBe(120);
  });
  it('parses a bare number as seconds', () => {
    expect(parseTimeToSeconds('45')).toBe(45);
  });
  it('falls back to 30 for null, empty, or unparseable input', () => {
    expect(parseTimeToSeconds(null)).toBe(30);
    expect(parseTimeToSeconds('')).toBe(30);
    expect(parseTimeToSeconds('abc')).toBe(30);
  });
  it('falls back to 30 for zero or negative values', () => {
    expect(parseTimeToSeconds('00:00')).toBe(30);
    expect(parseTimeToSeconds('-5')).toBe(30);
  });
});

describe('youtubeEmbedUrl', () => {
  it('converts a watch URL', () => {
    expect(youtubeEmbedUrl('https://youtube.com/watch?v=abc12345')).toBe('https://www.youtube.com/embed/abc12345');
  });
  it('converts a www watch URL', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=abc12345')).toBe('https://www.youtube.com/embed/abc12345');
  });
  it('converts an already-embed URL', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/embed/abc12345')).toBe('https://www.youtube.com/embed/abc12345');
  });
  it('converts a shorts URL', () => {
    expect(youtubeEmbedUrl('https://youtube.com/shorts/abc12345')).toBe('https://www.youtube.com/embed/abc12345');
  });
  it('converts a youtu.be short link', () => {
    expect(youtubeEmbedUrl('https://youtu.be/abc12345')).toBe('https://www.youtube.com/embed/abc12345');
  });
  it('returns null for garbage URLs', () => {
    expect(youtubeEmbedUrl('https://example.com/not-youtube')).toBeNull();
    expect(youtubeEmbedUrl('not a url at all')).toBeNull();
  });
  it('returns null for null or empty input', () => {
    expect(youtubeEmbedUrl(null)).toBeNull();
    expect(youtubeEmbedUrl('')).toBeNull();
  });
});
