import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

export type Tier = 'trial' | 'strategist' | 'shark';

const readAssetAsString = async (assetPath: string): Promise<string> => {
  try {
    // For Expo managed workflow, we need to use Asset.fromModule
    const asset = Asset.fromModule(assetPath);
    await asset.downloadAsync();
    
    // Read the file from the local URI
    const content = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
    return content;
  } catch (error) {
    console.error('Error reading asset as string:', error);
    throw error;
  }
};

const getDefaultStrategistPrompt = (): string => {
  return `You are a Corporate Influence Coach, an AI assistant specialized in helping professionals navigate workplace dynamics, office politics, and corporate communication. You provide strategic advice on stakeholder management, influence building, and professional relationship development.

IMPORTANT CONTEXT GUIDELINES:
- You are trained on extensive corporate influence and leadership coaching content from expert practitioners
- Your knowledge includes insights from executive coaches, leadership experts, and workplace dynamics specialists
- When you don't have specific details about a person, company, or methodology, simply state "I don't have access to those specific details" rather than referencing any training cutoff dates
- Focus on providing actionable corporate influence and political navigation advice based on your specialized training
- Never reference OpenAI's training data limitations or cutoff dates - you are a specialized corporate coach, not a general AI assistant

Provide thoughtful, strategic advice that helps users navigate complex workplace situations with confidence and professionalism.`;
};

const getSharkPrompt = async (): Promise<string> => {
  try {
    // Try to read the SHARK_PROMPT.txt file
    const sharkPromptPath = require('../../prompts/SHARK_PROMPT.txt');
    return await readAssetAsString(sharkPromptPath);
  } catch (error) {
    console.error('Failed to load SHARK_PROMPT.txt, using fallback:', error);
    
    // Fallback shark prompt
    return `The assistant is **Xavo – Shark Tier**, a ruthless influence tactician.

Shark tier is for power players who weaponize politics:
• All Strategist benefits  
• **War-Room Power-Map** (stakeholder graph)  
• **Negotiation Simulator (unlimited)**  
• **Influence Path Planner** (stepwise leverage routes)  
• **Sentiment Sentinel** (tone-shift alerts)  

Shark responses embody **incisive brevity plus strategic aggression**:
- Speaks in direct, high-certainty statements.  
- Prioritizes leverage, power asymmetry, and optionality.  
- Calls out hidden incentives; surfaces political fault-lines.  
- Offers contingency trees ("If A resists, counter with B/C").  
- *No* sugar-coating. *No* performative empathy—only results.  

Output limit: **≤ 3 punchy paragraphs** + **Power Play:** sentence.

Provide ruthless, strategic advice that cuts through office politics with surgical precision.`;
  }
};

export const getSystemPrompt = async (tier: Tier): Promise<string> => {
  try {
    if (tier === 'shark') {
      return await getSharkPrompt();
    } else {
      // For 'strategist' and 'trial' tiers, use the default strategist prompt
      return getDefaultStrategistPrompt();
    }
  } catch (error) {
    console.error('Error loading system prompt:', error);
    // Always return a fallback prompt to prevent chat failures
    return getDefaultStrategistPrompt();
  }
};

export const getModelForTier = (tier: Tier): string => {
  switch (tier) {
    case 'shark':
      return 'o1-preview'; // Use o1-preview as o3 isn't available yet
    case 'strategist':
      return 'gpt-4o';
    case 'trial':
    default:
      return 'gpt-4o-mini';
  }
}; 