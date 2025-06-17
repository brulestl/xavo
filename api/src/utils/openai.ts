import { OpenAI } from "openai";
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables immediately when this module is imported
dotenv.config({ path: path.join(process.cwd(), '../.env') });

let openaiInstance: OpenAI | null = null;

export const getOpenAI = (): OpenAI => {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set. Please add your OpenAI API key to use AI features.');
    }
    openaiInstance = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }
  return openaiInstance;
};

// Export a function that only initializes when called
export const openai = getOpenAI;

export async function callCoachAssistant(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  return openai().chat.completions.create({
    model: "gpt-4o-mini",
    messages
  });
}

// New streaming function for real-time chat
export async function streamCoachAssistant(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  return openai().chat.completions.create({
    model: "gpt-4o-mini", 
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1000
  });
}

// Helper function to build chat messages for OpenAI
export function buildChatMessages(
  userMessage: string,
  context?: string,
  systemPrompt?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  // Add system prompt
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  } else {
    messages.push({
      role: 'system',
      content: `You are a helpful AI assistant specializing in corporate influence and professional development. 
      Provide practical, actionable advice to help users navigate workplace dynamics and advance their careers.
      Keep responses concise but comprehensive.`
    });
  }

  // Add context if provided
  if (context) {
    messages.push({
      role: 'system', 
      content: `Context: ${context}`
    });
  }

  // Add user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
} 