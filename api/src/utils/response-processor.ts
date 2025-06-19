/**
 * Response post-processor for conditional "Power Move:" logic
 * Removes "Power Move:" from responses that are clarifying questions
 */

export interface ResponseProcessorOptions {
  preservePowerMove?: boolean;
}

/**
 * Detects if a response is a clarifying question or acknowledgment
 * that should NOT have "Power Move:" appended
 */
export function isNonAdviceResponse(response: string): boolean {
  const trimmedResponse = response.trim();
  
  // Check for clarifying questions
  const clarifyingQuestionPatterns = [
    /^Can you (tell me more|clarify|explain|provide more details)/i,
    /^What (specifically|exactly|do you mean|kind of)/i,
    /^How (specifically|exactly|do you|would you)/i,
    /^Could you (elaborate|provide more context|be more specific)/i,
    /^Which (specific|particular|type of)/i,
    /^When (did|do|does|will)/i,
    /^Where (in|at|during)/i,
    /^Who (is|are|was|were)/i,
    /^Why (do|did|does|is|are)/i,
    /I'd like to understand/i,
    /I need more information/i,
    /Let me ask you/i,
    /Can you help me understand/i,
    /I'm curious about/i,
    /Tell me more about/i,
    /What's your/i,
    /I'd love to know/i,
    /Could you walk me through/i,
    /Help me understand/i,
    /Let's explore/i,
    /I want to make sure I understand/i
  ];

  // Check for acknowledgments
  const acknowledgmentPatterns = [
    /^I understand/i,
    /^Got it/i,
    /^Thanks for clarifying/i,
    /^That makes sense/i,
    /^I see/i,
    /^Understood/i,
    /^Thank you for/i,
    /^Good to know/i,
    /^Perfect/i,
    /^Great/i,
    /^Excellent/i,
    /^Absolutely/i,
    /^Exactly/i,
    /^Right/i,
    /^Correct/i
  ];

  // Check for multi-question responses (likely clarifying)
  const questionCount = (trimmedResponse.match(/\?/g) || []).length;
  
  // If response has multiple questions, likely clarifying
  if (questionCount >= 2) {
    return true;
  }

  // Check against patterns
  for (const pattern of [...clarifyingQuestionPatterns, ...acknowledgmentPatterns]) {
    if (pattern.test(trimmedResponse)) {
      return true;
    }
  }

  // Check if response ends with a question mark (likely clarifying)
  if (trimmedResponse.endsWith('?')) {
    // But exclude rhetorical questions that lead to advice
    const rhetoricalPatterns = [
      /wouldn't it be better/i,
      /don't you think/i,
      /why not/i,
      /what if/i,
      /have you considered/i
    ];
    
    const isRhetorical = rhetoricalPatterns.some(pattern => pattern.test(trimmedResponse));
    if (!isRhetorical) {
      return true;
    }
  }

  return false;
}

/**
 * Removes "Power Move:" from responses that shouldn't have it
 */
export function removePowerMoveIfInappropriate(response: string): string {
  if (!isNonAdviceResponse(response)) {
    return response; // Keep "Power Move:" for substantive advice
  }

  // Remove "Power Move:" and anything after it
  const powerMovePattern = /\s*Power Move:\s*.*/i;
  return response.replace(powerMovePattern, '').trim();
}

/**
 * Main response processor that applies conditional "Power Move:" logic
 */
export function processResponse(
  response: string, 
  options: ResponseProcessorOptions = {}
): string {
  if (options.preservePowerMove) {
    return response; // Skip processing if explicitly requested
  }

  // Apply conditional "Power Move:" logic
  const processedResponse = removePowerMoveIfInappropriate(response);
  
  // Clean up any double spaces or formatting issues
  return processedResponse
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Debug function to test the classifier
 */
export function debugClassifyResponse(response: string): {
  isNonAdvice: boolean;
  questionCount: number;
  endsWith: string;
  classification: string;
} {
  const questionCount = (response.match(/\?/g) || []).length;
  const isNonAdvice = isNonAdviceResponse(response);
  
  let classification = 'substantive-advice';
  if (isNonAdvice) {
    if (response.trim().endsWith('?')) {
      classification = 'clarifying-question';
    } else if (questionCount === 0) {
      classification = 'acknowledgment';
    } else {
      classification = 'mixed-question';
    }
  }

  return {
    isNonAdvice,
    questionCount,
    endsWith: response.trim().slice(-1),
    classification
  };
} 