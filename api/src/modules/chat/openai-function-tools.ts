import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateUUID } from '../../utils/uuid-validator.util';

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface ToolCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class OpenAIFunctionTools {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  /**
   * Get all available tools for OpenAI function calling
   */
  getAvailableTools(): OpenAITool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'add_long_term_memory',
          description: 'Save an important insight, learning, or experience to the user\'s long-term memory for future reference',
          parameters: {
            type: 'object',
            properties: {
              memory_content: {
                type: 'string',
                description: 'The content of the memory to save (insight, learning, key point, etc.)'
              },
              memory_type: {
                type: 'string',
                enum: ['insight', 'goal', 'preference', 'experience', 'skill', 'challenge'],
                description: 'The type/category of memory being saved'
              },
              importance_score: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: 'How important this memory is (1-10, where 10 is most important)'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags to categorize this memory (e.g., ["leadership", "communication"])'
              }
            },
            required: ['memory_content', 'memory_type', 'importance_score']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_user_goal',
          description: 'Update or add a new goal for the user based on their conversation',
          parameters: {
            type: 'object',
            properties: {
              goal_text: {
                type: 'string',
                description: 'The goal text to add or update'
              },
              goal_category: {
                type: 'string',
                enum: ['leadership', 'communication', 'influence', 'career', 'skills', 'personal'],
                description: 'The category this goal belongs to'
              },
              priority: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'The priority level of this goal'
              },
              target_date: {
                type: 'string',
                format: 'date',
                description: 'Optional target date for achieving this goal (YYYY-MM-DD format)'
              }
            },
            required: ['goal_text', 'goal_category', 'priority']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_personality_profile',
          description: 'Retrieve the user\'s detailed personality profile and assessment results',
          parameters: {
            type: 'object',
            properties: {
              include_history: {
                type: 'boolean',
                description: 'Whether to include personality assessment history',
                default: false
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_communication_preference',
          description: 'Update the user\'s communication style preferences based on their feedback',
          parameters: {
            type: 'object',
            properties: {
              communication_style: {
                type: 'string',
                enum: ['formal', 'casual', 'direct', 'supportive', 'analytical', 'creative'],
                description: 'The preferred communication style'
              },
              feedback_frequency: {
                type: 'string',
                enum: ['immediate', 'session_end', 'weekly', 'monthly'],
                description: 'How often the user wants feedback'
              },
              preferred_topics: {
                type: 'array',
                items: { type: 'string' },
                description: 'Topics the user is most interested in discussing'
              }
            },
            required: ['communication_style']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_past_conversations',
          description: 'Search through the user\'s past conversations for specific topics or insights',
          parameters: {
            type: 'object',
            properties: {
              search_query: {
                type: 'string',
                description: 'The search query to find relevant past conversations'
              },
              limit: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                default: 5,
                description: 'Maximum number of results to return'
              },
              date_range_days: {
                type: 'number',
                minimum: 1,
                maximum: 365,
                description: 'Optional: limit search to last N days'
              }
            },
            required: ['search_query']
          }
        }
      }
    ];
  }

  /**
   * Execute a tool call based on the function name and arguments
   */
  async executeToolCall(
    functionName: string,
    args: Record<string, any>,
    userId: string,
    sessionId?: string
  ): Promise<ToolCallResult> {
    // Validate UUID format
    validateUUID(userId, 'user_id');
    try {
      switch (functionName) {
        case 'add_long_term_memory':
          return await this.addLongTermMemory(args, userId);
        
        case 'update_user_goal':
          return await this.updateUserGoal(args, userId);
        
        case 'get_personality_profile':
          return await this.getPersonalityProfile(args, userId);
        
        case 'update_communication_preference':
          return await this.updateCommunicationPreference(args, userId);
        
        case 'search_past_conversations':
          return await this.searchPastConversations(args, userId);
        
        default:
          return {
            success: false,
            error: `Unknown function: ${functionName}`
          };
      }
    } catch (error) {
      console.error(`Error executing tool call ${functionName}:`, error);
      return {
        success: false,
        error: `Failed to execute ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Add a long-term memory
   */
  private async addLongTermMemory(args: any, userId: string): Promise<ToolCallResult> {
    const { memory_content, memory_type, importance_score, tags = [] } = args;

    const { data, error } = await this.supabase
      .from('long_term_memories')
      .insert({
        user_id: userId,
        memory_content,
        memory_type,
        importance_score,
        tags,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Failed to save memory: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        message: 'Memory saved successfully',
        memory_id: data.id,
        memory_type,
        importance_score
      }
    };
  }

  /**
   * Update user goal
   */
  private async updateUserGoal(args: any, userId: string): Promise<ToolCallResult> {
    const { goal_text, goal_category, priority, target_date } = args;

    // First, get current goals from user_personalization
    const { data: currentPersonalization, error: fetchError } = await this.supabase
      .from('user_personalization')
      .select('goals')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Goals fetch error:', { code: fetchError.code, message: fetchError.message, details: fetchError.details });
    }

    const currentGoals = currentPersonalization?.goals || [];
    
    // Create new goal object
    const newGoal = {
      text: goal_text,
      category: goal_category,
      priority,
      target_date,
      created_at: new Date().toISOString(),
      status: 'active'
    };

    // Add to goals array
    const updatedGoals = [...currentGoals, newGoal];

    // Update user_personalization
    const { error } = await this.supabase
      .from('user_personalization')
      .upsert({
        user_id: userId,
        goals: updatedGoals,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Goal update error:', { code: error.code, message: error.message, details: error.details });
      return {
        success: false,
        error: `Failed to update goal: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        message: 'Goal updated successfully',
        goal: newGoal,
        total_goals: updatedGoals.length
      }
    };
  }

  /**
   * Get personality profile
   */
  private async getPersonalityProfile(args: any, userId: string): Promise<ToolCallResult> {
    const { include_history = false } = args;

    // Get current personality scores
    const { data: profile, error: profileError } = await this.supabase
      .from('user_profiles')
      .select('openness, conscientiousness, extraversion, agreeableness, neuroticism, updated_at')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      return {
        success: false,
        error: `Failed to get personality profile: ${profileError.message}`
      };
    }

    const result: any = {
      personality_scores: {
        openness: profile.openness,
        conscientiousness: profile.conscientiousness,
        extraversion: profile.extraversion,
        agreeableness: profile.agreeableness,
        neuroticism: profile.neuroticism
      },
      last_updated: profile.updated_at,
      interpretation: this.interpretPersonalityScores(profile)
    };

    // Include assessment history if requested
    if (include_history) {
      const { data: answers } = await this.supabase
        .from('onboarding_answers')
        .select('question_id, answer_value, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      result.assessment_history = answers || [];
    }

    return {
      success: true,
      data: result
    };
  }

  /**
   * Update communication preferences
   */
  private async updateCommunicationPreference(args: any, userId: string): Promise<ToolCallResult> {
    const { communication_style, feedback_frequency, preferred_topics } = args;

    const updateData: any = {
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    if (communication_style) {
      updateData.communication_style = communication_style;
    }

    if (feedback_frequency) {
      updateData.feedback_frequency = feedback_frequency;
    }

    if (preferred_topics) {
      updateData.preferred_topics = preferred_topics;
    }

    const { error } = await this.supabase
      .from('user_personalization')
      .upsert(updateData);

    if (error) {
      console.error('Communication preferences update error:', { code: error.code, message: error.message, details: error.details });
      return {
        success: false,
        error: `Failed to update communication preferences: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        message: 'Communication preferences updated successfully',
        updated_fields: Object.keys(updateData).filter(key => key !== 'user_id' && key !== 'updated_at')
      }
    };
  }

  /**
   * Search past conversations
   */
  private async searchPastConversations(args: any, userId: string): Promise<ToolCallResult> {
    const { search_query, limit = 5, date_range_days } = args;

    let query = this.supabase
      .from('conversation_messages')
      .select('id, content, role, created_at, session_id')
      .eq('user_id', userId)
      .textSearch('content', search_query)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Add date range filter if specified
    if (date_range_days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - date_range_days);
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: `Failed to search conversations: ${error.message}`
      };
    }

    return {
      success: true,
      data: {
        results: data || [],
        search_query,
        result_count: data?.length || 0
      }
    };
  }

  /**
   * Interpret personality scores for human-readable insights
   */
  private interpretPersonalityScores(profile: any): Record<string, string> {
    const interpretations: Record<string, string> = {};

    // Openness interpretation
    if (profile.openness > 0.7) {
      interpretations.openness = 'High openness - enjoys new experiences, creative, and open to change';
    } else if (profile.openness < 0.3) {
      interpretations.openness = 'Low openness - prefers routine, practical, and traditional approaches';
    } else {
      interpretations.openness = 'Moderate openness - balanced between new experiences and established methods';
    }

    // Conscientiousness interpretation
    if (profile.conscientiousness > 0.7) {
      interpretations.conscientiousness = 'High conscientiousness - organized, disciplined, and goal-oriented';
    } else if (profile.conscientiousness < 0.3) {
      interpretations.conscientiousness = 'Low conscientiousness - flexible, spontaneous, and adaptable';
    } else {
      interpretations.conscientiousness = 'Moderate conscientiousness - balanced approach to planning and spontaneity';
    }

    // Extraversion interpretation
    if (profile.extraversion > 0.7) {
      interpretations.extraversion = 'High extraversion - energetic, outgoing, and enjoys social interaction';
    } else if (profile.extraversion < 0.3) {
      interpretations.extraversion = 'Low extraversion (introverted) - prefers quiet environments and deep conversations';
    } else {
      interpretations.extraversion = 'Moderate extraversion - comfortable in both social and solitary situations';
    }

    // Agreeableness interpretation
    if (profile.agreeableness > 0.7) {
      interpretations.agreeableness = 'High agreeableness - cooperative, trusting, and empathetic';
    } else if (profile.agreeableness < 0.3) {
      interpretations.agreeableness = 'Low agreeableness - competitive, skeptical, and direct';
    } else {
      interpretations.agreeableness = 'Moderate agreeableness - balanced between cooperation and assertiveness';
    }

    // Neuroticism interpretation
    if (profile.neuroticism > 0.7) {
      interpretations.neuroticism = 'High neuroticism - may experience stress more intensely, benefits from support';
    } else if (profile.neuroticism < 0.3) {
      interpretations.neuroticism = 'Low neuroticism - emotionally stable, calm under pressure';
    } else {
      interpretations.neuroticism = 'Moderate neuroticism - typical emotional responses to stress';
    }

    return interpretations;
  }
} 