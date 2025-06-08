import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, ChatActionType } from './dto/chat.dto';
import { Tier } from '../auth/auth.service';

export interface ModelResponse {
  message: string;
  modelUsed: string;
  tokensUsed?: number;
  processingTime?: number;
}

@Injectable()
export class ModelRouterService {
  constructor(private readonly configService: ConfigService) {}

  async routeToModel(
    request: ChatRequestDto,
    userTier: Tier,
  ): Promise<ModelResponse> {
    // Determine which model to use based on tier
    const modelConfig = this.getModelConfig(userTier);
    
    // For MVP, we'll return mock responses
    // In production, this would call actual AI models
    const response = await this.generateMockResponse(request, modelConfig);
    
    return response;
  }

  private getModelConfig(tier: Tier) {
    switch (tier) {
      case 'power':
        return {
          modelName: 'power-strategist-gpt',
          maxTokens: 4000,
          temperature: 0.7,
          features: ['deep_context', 'voice_input', 'personalization'],
        };
      case 'essential':
        return {
          modelName: 'essential-coach-gpt',
          maxTokens: 2000,
          temperature: 0.6,
          features: ['basic_coaching'],
        };
      case 'guest':
      default:
        return {
          modelName: 'guest-advisor',
          maxTokens: 1000,
          temperature: 0.5,
          features: ['limited_advice'],
        };
    }
  }

  private async generateMockResponse(
    request: ChatRequestDto,
    modelConfig: any,
  ): Promise<ModelResponse> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const responses = this.getMockResponsesByAction(request.actionType);
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Customize response based on tier
    let enhancedResponse = randomResponse;
    if (modelConfig.modelName === 'power-strategist-gpt') {
      enhancedResponse = this.enhanceForPowerTier(randomResponse);
    }

    return {
      message: enhancedResponse,
      modelUsed: modelConfig.modelName,
      tokensUsed: Math.floor(Math.random() * modelConfig.maxTokens * 0.3) + 50,
      processingTime: Math.floor(Math.random() * 2000) + 500,
    };
  }

  private getMockResponsesByAction(actionType?: ChatActionType): string[] {
    switch (actionType) {
      case ChatActionType.EVALUATE_SCENARIO:
        return [
          "Based on the scenario you've described, here are the key factors to consider: stakeholder interests, potential risks, and strategic opportunities. I recommend analyzing the power dynamics and identifying your key allies before proceeding.",
          "This situation requires careful evaluation. Consider the timing, the political climate in your organization, and the potential consequences of different approaches. What's your primary objective here?",
        ];
      
      case ChatActionType.PLAN_STRATEGY:
        return [
          "Here's a strategic approach: 1) Map out all stakeholders and their interests, 2) Identify potential allies and blockers, 3) Develop multiple scenarios with contingency plans, 4) Choose your timing carefully, 5) Prepare your communication strategy.",
          "For this strategy, I recommend a phased approach. Start by building consensus among key influencers, then gradually expand your coalition. Consider the organizational culture and recent changes that might affect your approach.",
        ];
      
      case ChatActionType.ANALYZE_STAKEHOLDERS:
        return [
          "Let me help you map the stakeholder landscape. Consider these categories: Champions (strong supporters), Allies (supportive but not vocal), Neutrals (undecided), Skeptics (concerned but persuadable), and Blockers (strong opposition). Who falls into each category?",
          "Stakeholder analysis is crucial. Look at formal authority vs. informal influence, personal motivations, past behavior patterns, and current priorities. Who has the most to gain or lose from your proposal?",
        ];
      
      case ChatActionType.SUMMARIZE_POLICY:
        return [
          "I'll help you break down this policy into key components: objectives, scope, implementation requirements, stakeholder impacts, and potential challenges. What specific aspects would you like me to focus on?",
          "Policy summaries should highlight: the problem being solved, proposed solution, resource requirements, timeline, success metrics, and potential risks. Which policy document are you working with?",
        ];
      
      case ChatActionType.BRAINSTORM_INSIGHTS:
        return [
          "Let's explore some fresh perspectives on this challenge. Consider: What assumptions might you be making? What would an outsider see differently? What opportunities might emerge from this challenge? What patterns do you notice?",
          "Here are some angles to consider: the historical context, industry trends, generational differences in your workplace, and emerging technologies that might impact this situation. What resonates with your experience?",
        ];
      
      case ChatActionType.DRAFT_EMAIL:
        return [
          "For professional emails in sensitive situations, I recommend this structure: Clear subject line, brief context, specific request or proposal, rationale/benefits, next steps, and professional closing. What's the main message you want to convey?",
          "Email drafting tips: Start with the recipient's perspective, be concise but complete, use positive framing, include specific details, and always end with a clear call to action. Who is your audience and what outcome do you want?",
        ];
      
      default:
        return [
          "I'm here to help you navigate workplace dynamics and corporate politics. Whether you need to evaluate a situation, plan a strategy, or draft communications, I can provide insights based on proven frameworks and best practices.",
          "Corporate influence requires understanding both formal structures and informal networks. What specific challenge are you facing? I can help you analyze the situation and develop an effective approach.",
          "Successful workplace navigation combines emotional intelligence, strategic thinking, and tactical execution. Tell me more about your situation and I'll provide tailored guidance.",
        ];
    }
  }

  private enhanceForPowerTier(baseResponse: string): string {
    const enhancements = [
      "\n\n**Power Strategist Insight:** Consider the long-term implications and how this aligns with your career trajectory.",
      "\n\n**Advanced Strategy:** I can also help you develop a detailed implementation timeline with specific milestones.",
      "\n\n**Personalized Recommendation:** Based on your leadership style, you might want to consider a more collaborative approach.",
    ];
    
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    return baseResponse + randomEnhancement;
  }
} 