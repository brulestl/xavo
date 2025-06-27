interface Intent {
  type: 'list_files' | 'default';
}

export function getIntent(message: string): Intent {
  // Intent: list_files - matches patterns like "what files", "list files", "uploaded files"
  if (/(?:what|which).*files|list.*files|uploaded.*files/i.test(message)) {
    return { type: 'list_files' };
  }

  // Default intent for all other messages
  return { type: 'default' };
} 