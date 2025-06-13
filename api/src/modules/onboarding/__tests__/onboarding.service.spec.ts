import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from '../onboarding.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OnboardingService],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQuestions', () => {
    it('should return onboarding questions', async () => {
      const mockQuestions = [
        {
          id: '1',
          question_code: 'P1',
          question_type: 'personalization',
          prompt: 'What is your role?',
          input_type: 'single-select',
          choices: ['manager', 'developer'],
          display_order: 1,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: mockQuestions,
            error: null
          })
        })
      });

      const result = await service.getQuestions();

      expect(result).toEqual(mockQuestions);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('onboarding_questions');
    });

    it('should throw error when database query fails', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });

      await expect(service.getQuestions()).rejects.toThrow('Failed to fetch questions: Database error');
    });
  });

  describe('submitAnswer', () => {
    it('should submit answer successfully', async () => {
      const userId = 'user-123';
      const answerDto = {
        question_id: 'question-123',
        answer_value: 'manager',
        answer_metadata: {}
      };

      mockSupabaseClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: 'answer-123' }],
            error: null
          })
        })
      });

      const result = await service.submitAnswer(userId, answerDto);

      expect(result).toEqual({
        success: true,
        message: 'Answer submitted successfully'
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('onboarding_answers');
    });
  });

  describe('getOnboardingStatus', () => {
    it('should return onboarding status', async () => {
      const userId = 'user-123';

      // Mock questions count
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            count: 10,
            error: null
          })
        })
        // Mock answers count
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: 5,
              error: null
            })
          })
        })
        // Mock personalization data
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  onboarding_status: 'in_progress',
                  personality_scores: { openness: 0.8 }
                },
                error: null
              })
            })
          })
        });

      const result = await service.getOnboardingStatus(userId);

      expect(result).toEqual({
        status: 'in_progress',
        completed_questions: 5,
        total_questions: 10,
        personality_scores: { openness: 0.8 }
      });
    });
  });
}); 