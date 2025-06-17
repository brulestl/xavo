import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

@Injectable()
export class PromptsService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate(userId: string, count: number = 5): Promise<string[]> {
    try {
      console.log(`🤖 Generating ${count} AI prompts for user ${userId}`);

      // Fetch user personalization data
      const { data: personalization, error } = await this.supabase
        .from('user_personalization')
        .select('current_position, primary_function, company_size, top_challenges, personality_scores')
        .eq('user_id', userId)
        .single();

      if (error || !personalization) {
        console.error('❌ No personalization data found:', error);
        return this.getFallbackPrompts(count);
      }

      // Build context string
      const context = this.buildUserContext(personalization);
      console.log('📝 User context:', context);

      // Call OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a corporate influence coach. Generate exactly ${count} personalized coaching questions for this user. Each question should be:
- Specific to their role and situation
- Actionable and practical
- Focused on building corporate influence
- Different from each other
- Phrased as questions they can ask their coach

Return ONLY a JSON object with format: {"prompts": ["Question 1", "Question 2", ...]}`
          },
          {
            role: 'user',
            content: `User Profile:\n${context}\n\nGenerate ${count} personalized coaching questions for this user.`
          }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      });

      const aiResponse = response.choices[0]?.message?.content?.trim();
      console.log('🤖 OpenAI raw response:', aiResponse);

      if (!aiResponse) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse response
      let prompts: string[];
      try {
        const parsed = JSON.parse(aiResponse);
        if (parsed.prompts && Array.isArray(parsed.prompts)) {
          prompts = parsed.prompts;
        } else if (Array.isArray(parsed)) {
          prompts = parsed;
        } else {
          throw new Error('Response is not in expected format');
        }
      } catch (parseError) {
        console.log('⚠️ Failed to parse as JSON, trying line-based parsing...');
        // Fallback: split by newlines and clean up
        prompts = aiResponse
          .split('\n')
          .map((line: string) => line.replace(/^[\d\.\-\s\*\[\]"]+/, '').trim())
          .filter((line: string) => line.length > 10)
          .map((line: string) => line.replace(/["\[\]]/g, '').trim())
          .slice(0, count);
      }

      // Clean up and validate prompts
      const cleanPrompts = prompts
        .filter(prompt => prompt && typeof prompt === 'string')
        .map(prompt => prompt.trim())
        .filter(prompt => prompt.length > 10)
        .slice(0, count);

      console.log('✅ Generated AI prompts:', cleanPrompts);

      if (cleanPrompts.length === 0) {
        throw new Error('No valid prompts generated');
      }

      return cleanPrompts;

    } catch (error) {
      console.error('💥 Error generating AI prompts:', error);
      return this.getFallbackPrompts(count);
    }
  }

  private buildUserContext(personalization: any): string {
    const contextParts = [];

    if (personalization.current_position) {
      contextParts.push(`Role: ${personalization.current_position}`);
    }

    if (personalization.primary_function) {
      contextParts.push(`Function: ${personalization.primary_function}`);
    }

    if (personalization.company_size) {
      contextParts.push(`Company Size: ${personalization.company_size}`);
    }

    if (personalization.top_challenges && personalization.top_challenges.length > 0) {
      contextParts.push(`Top Challenges: ${personalization.top_challenges.join(', ')}`);
    }

    if (personalization.personality_scores) {
      const scores = Object.entries(personalization.personality_scores)
        .map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`)
        .join(', ');
      contextParts.push(`Personality Traits: ${scores}`);
    }

    return contextParts.length > 0
      ? contextParts.join('\n')
      : 'Professional seeking corporate influence coaching';
  }

  private getFallbackPrompts(count: number): string[] {
    const fallbackPrompts = [
      "How can I build stronger relationships with key stakeholders?",
      "What's the best way to present ideas to senior leadership?",
      "How do I navigate competing priorities effectively?",
      "What strategies help me influence without authority?",
      "How can I improve my executive presence in meetings?",
      "What's the most effective way to handle pushback on my proposals?",
      "How do I build credibility when I'm new to a role?",
      "What's the best approach to managing up effectively?",
      "How can I better communicate my value to the organization?",
      "What techniques help me stay calm under pressure during important discussions?"
    ];

    return fallbackPrompts.slice(0, count);
  }
} 