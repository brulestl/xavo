import { OpenAI } from "openai";
import { Assistant } from "../assistants/map";
import { config } from "dotenv";
config();

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function callCoachAssistant(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
) {
  return openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
  });
} 