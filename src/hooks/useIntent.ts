import { useMemo } from 'react';

interface Intent {
  type: 'list_files' | 'default';
}

export function useIntent(message: string): Intent {
  return useMemo(() => {
    // Intent: list_files - matches patterns like "what files", "list files", "uploaded files"
    if (/(?:what|which).*files|list.*files|uploaded.*files/i.test(message)) {
      return { type: 'list_files' };
    }

    // Default intent for all other messages
    return { type: 'default' };
  }, [message]);
} 