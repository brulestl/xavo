import { readFileSync } from "fs";
import { OpenAI } from "openai";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from the root directory
config({ path: resolve(process.cwd(), '.env') });

// Debug: Check if API key is loaded
console.log('Environment check:');
console.log('- Current working directory:', process.cwd());
console.log('- OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? 'Yes (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'No');

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables.');
  console.error('Please add OPENAI_API_KEY=your_api_key_here to your .env file');
  process.exit(1);
}

async function createAssistant(
  name: string,
  model: string,
  promptPath: string
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const instructions = readFileSync(promptPath, "utf8");
  
  try {
    const res = await openai.beta.assistants.create({
      name,
      model,
      instructions,
      tools: []
    });
    console.log(`${name}:`, res.id);
    return res.id;
  } catch (error) {
    console.error(`Failed to create assistant ${name}:`, error);
    throw error;
  }
}

const assistants = [
  {
    name: "Xavo Coach",
    instructions: "You are Xavo Coach, an expert influence and persuasion coach. Help users develop their influence skills through practical advice, techniques, and personalized guidance.",
    model: "gpt-4o-mini"
  },
  {
    name: "Xavo Curator", 
    instructions: "You are Xavo Curator, a sophisticated content curator and strategic advisor. You help users curate high-quality content and develop strategic thinking around influence and persuasion.",
    model: "gpt-4o"
  }
];

(async () => {
  console.log('\n🚀 Creating OpenAI Assistants...\n');
  
  try {
    const coachId   = await createAssistant("Xavo Coach", "gpt-4o-mini", "prompts/coach.txt");
    const curatorId = await createAssistant("Xavo Curator", "gpt-4o",           "prompts/curator.txt");

    console.log("\n✅ Assistants created successfully!");
    console.log("\n📋 Paste these into assistants/map.ts:");
    console.log(`coach  : "${coachId}",`);
    console.log(`curator: "${curatorId}"`);
  } catch (error) {
    console.error('\n❌ Failed to create assistants:', error);
    process.exit(1);
  }
})(); 