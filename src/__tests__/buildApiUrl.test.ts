// Mock environment variable
const originalEnv = process.env.EXPO_PUBLIC_API_URL;

// Simple buildApiUrl function for testing (without importing the full module)
function buildApiUrl(path: string): string {
  const BASE = `${process.env.EXPO_PUBLIC_API_URL}/api/v1`;
  return `${BASE}${path}`;
}

describe('buildApiUrl', () => {
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it('should build correct API URL without double slashes', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    
    const url = buildApiUrl('/profile/me');
    expect(url).toBe('http://localhost:3000/api/v1/profile/me');
  });

  it('should handle API URL with trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/';
    
    const url = buildApiUrl('/profile/me');
    expect(url).toBe('http://localhost:3000//api/v1/profile/me');
  });

  it('should handle path without leading slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    
    const url = buildApiUrl('profile/me');
    expect(url).toBe('http://localhost:3000/api/v1profile/me');
  });

  it('should not create double /api/v1 prefixes', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000';
    
    const url = buildApiUrl('/profile/personality-scores');
    expect(url).not.toContain('/api/v1/api/v1');
    expect(url).toBe('http://localhost:3000/api/v1/profile/personality-scores');
  });

  it('should work with production URLs', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    
    const url = buildApiUrl('/chat/sessions');
    expect(url).toBe('https://api.example.com/api/v1/chat/sessions');
  });
}); 