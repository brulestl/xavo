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
    messages,
    temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
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
    temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
    max_tokens: 1000
  });
}

import { buildCoachPrompt, UserPersonalization, PersonalityScores } from './coach-prompt';

export interface ChatMessageOptions {
  userPersonalization?: UserPersonalization;
  personalityScores?: PersonalityScores;
  tier?: 'trial' | 'strategist' | 'shark';
  context?: string;
  systemPrompt?: string;
  conversationContext?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

// Enhanced function to build chat messages with coach prompt and personalization
export function buildChatMessages(
  userMessage: string,
  options: ChatMessageOptions = {}
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const {
    userPersonalization,
    personalityScores,
    tier = 'trial',
    context,
    systemPrompt,
    conversationContext // New parameter for injected context
  } = options;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  // Add system prompt (prioritize custom, then coach prompt, then fallback)
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  } else {
    // Use the dynamic coach prompt with personalization
    const coachPrompt = buildCoachPrompt({
      tier,
      userPersonalization,
      personalityScores,
      currentDateTime: new Date().toISOString(),
    });
    
    messages.push({
      role: 'system',
      content: coachPrompt
    });
  }

  // 🔥 INJECT CONVERSATION CONTEXT (short-term summary + message history)
  if (conversationContext && conversationContext.length > 0) {
    conversationContext.forEach(contextMessage => {
      messages.push({
        role: contextMessage.role,
        content: contextMessage.content
      });
    });
  }

  // Add RAG context if provided
  if (context) {
    messages.push({
      role: 'system', 
      content: `Additional Context: ${context}`
    });
  }

  // Add user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}

// Legacy function for backward compatibility
export function buildChatMessagesLegacy(
  userMessage: string,
  context?: string,
  systemPrompt?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return buildChatMessages(userMessage, {
    context,
    systemPrompt
  });
} 