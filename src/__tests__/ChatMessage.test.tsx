import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatMessage } from '../components/ChatMessage';
import { ThemeProvider } from '../providers/ThemeProvider';

// Mock the theme provider for testing
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
);

describe('ChatMessage', () => {
  it('renders markdown text correctly', () => {
    const sampleMarkdown = `
# This is a heading

This is **bold text** and this is *italic text*.

Here's a list:
- Item 1
- Item 2
- Item 3

And a numbered list:
1. First item
2. Second item
3. Third item

Here's some \`inline code\` and a [link](https://example.com).

> This is a blockquote

\`\`\`javascript
// This is a code block
function hello() {
  console.log("Hello world!");
}
\`\`\`
    `.trim();

    const { toJSON } = render(
      <MockThemeProvider>
        <ChatMessage text={sampleMarkdown} />
      </MockThemeProvider>
    );

    expect(toJSON()).toMatchSnapshot();
  });

  it('renders plain text correctly', () => {
    const plainText = 'This is just plain text without any markdown formatting.';

    const { toJSON } = render(
      <MockThemeProvider>
        <ChatMessage text={plainText} />
      </MockThemeProvider>
    );

    expect(toJSON()).toMatchSnapshot();
  });

  it('handles empty text', () => {
    const { toJSON } = render(
      <MockThemeProvider>
        <ChatMessage text="" />
      </MockThemeProvider>
    );

    expect(toJSON()).toMatchSnapshot();
  });
}); 