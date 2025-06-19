"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoachPrompt = buildCoachPrompt;
exports.extractUserPersona = extractUserPersona;
exports.getToneForPersona = getToneForPersona;
exports.buildUserContextString = buildUserContextString;
const fs = require("fs");
const path = require("path");
/**
 * Build the complete coach prompt with dynamic personalization
 */
function buildCoachPrompt(options) {
    const { tier, userPersonalization = {}, personalityScores = {}, currentDateTime = new Date().toISOString(), tokenLimit = getTokenLimitForTier(tier), } = options;
    // Load the base coach prompt template
    // Path is relative to this file's location: api/src/utils -> go up 3 levels to project root
    const templatePath = path.join(__dirname, '..', '..', '..', 'prompts', 'coach.txt');
    let promptTemplate = '';
    try {
        promptTemplate = fs.readFileSync(templatePath, 'utf-8');
    }
    catch (error) {
        console.error('Error loading coach prompt template:', error);
        return getBasicCoachPrompt(tier);
    }
    // Replace template variables
    let prompt = promptTemplate
        .replace(/\{\{currentDateTime\}\}/g, currentDateTime)
        .replace(/\{\{json user_personalization\}\}/g, JSON.stringify(userPersonalization, null, 2))
        .replace(/\{\{json personality_scores\}\}/g, JSON.stringify(personalityScores, null, 2))
        .replace(/\{\{tier\}\}/g, tier)
        .replace(/\{\{token_limit\}\}/g, tokenLimit.toString());
    return prompt;
}
/**
 * Get token limit for user tier
 */
function getTokenLimitForTier(tier) {
    switch (tier) {
        case 'trial':
            return 2000;
        case 'strategist':
            return 32000;
        case 'shark':
            return 128000;
        default:
            return 2000;
    }
}
/**
 * Fallback basic coach prompt if template file is not available
 */
function getBasicCoachPrompt(tier) {
    return `You are Xavo, the corporate-influence coach created by Bru Le.

You are a multi-tier coaching platform that blends an LLM ("Xavo Coach") with optional analytical modules.

Current tier: ${tier}

You provide strategic advice on stakeholder management, influence building, and professional relationship development. You help users navigate workplace dynamics, office politics, and corporate communication.

Guidelines:
- Keep responses concise but comprehensive (max 3 paragraphs)
- End every answer with "Power Move:" followed by one actionable sentence
- Adapt tone based on user's seniority level
- Provide practical, actionable advice
- Never offer illegal, discriminatory, violent, or unethical tactics
- Focus on corporate influence, leadership, and professional development

Your responses should be professional, strategic, and focused on helping users build influence and advance their careers.`;
}
/**
 * Extract user persona from personalization data
 */
function extractUserPersona(userPersonalization) {
    var _a;
    const position = ((_a = userPersonalization.current_position) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    const seniority = userPersonalization.seniority_level || 'mid-management';
    // Determine persona based on position and seniority
    if (seniority === 'c-suite' || position.includes('ceo') || position.includes('president') || position.includes('founder')) {
        return 'C-suite / Founder';
    }
    else if (seniority === 'senior' || position.includes('director') || position.includes('vp') || position.includes('head of')) {
        return 'Senior / Director';
    }
    else if (seniority === 'mid-management' || position.includes('manager') || position.includes('lead')) {
        return 'Mid-management';
    }
    else {
        return 'Junior / Entry';
    }
}
/**
 * Get tone recommendations based on persona
 */
function getToneForPersona(persona) {
    switch (persona) {
        case 'C-suite / Founder':
            return {
                tone: 'Advisory, incisive',
                depth: '3–5 steps',
                typicalGoals: ['power mapping', 'stakeholder buy-in', 'strategic positioning']
            };
        case 'Senior / Director':
            return {
                tone: 'Strategic, concise',
                depth: '3–4 steps',
                typicalGoals: ['org politics', 'promotion path', 'team leadership']
            };
        case 'Mid-management':
            return {
                tone: 'Tactical, pragmatic',
                depth: '2–3 steps',
                typicalGoals: ['conflict resolution', 'gain visibility', 'negotiate budget']
            };
        case 'Junior / Entry':
        default:
            return {
                tone: 'Mentoring, reassuring',
                depth: '1–2 steps',
                typicalGoals: ['clarify role', 'resolve peer tension', 'build credibility']
            };
    }
}
/**
 * Build user context string for prompt injection
 */
function buildUserContextString(userPersonalization) {
    const persona = extractUserPersona(userPersonalization);
    const toneInfo = getToneForPersona(persona);
    let context = `User Profile:
- Persona: ${persona}
- Position: ${userPersonalization.current_position || 'Not specified'}
- Industry: ${userPersonalization.industry || 'Not specified'}
- Recommended Tone: ${toneInfo.tone}
- Response Depth: ${toneInfo.depth}`;
    if (userPersonalization.top_challenges && userPersonalization.top_challenges.length > 0) {
        context += `\n- Top Challenges: ${userPersonalization.top_challenges.join(', ')}`;
    }
    if (userPersonalization.frequent_topics && userPersonalization.frequent_topics.length > 0) {
        context += `\n- Frequent Topics: ${userPersonalization.frequent_topics.join(', ')}`;
    }
    if (userPersonalization.communication_style) {
        context += `\n- Communication Style: ${userPersonalization.communication_style.formality || 'balanced'} formality, ${userPersonalization.communication_style.directness || 'balanced'} directness`;
    }
    return context;
}
