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