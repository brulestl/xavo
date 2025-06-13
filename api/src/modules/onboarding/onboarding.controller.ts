import { Controller, Get, Post, Put, Body, Req, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { 
  OnboardingQuestionDto, 
  CreateOnboardingAnswerDto, 
  CompleteOnboardingDto,
  OnboardingStatusDto 
} from './dto/onboarding.dto';

@Controller('api/v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('questions')
  async getQuestions(): Promise<OnboardingQuestionDto[]> {
    return this.onboardingService.getQuestions();
  }

  @Post('answers')
  async submitAnswer(
    @Body() createAnswerDto: CreateOnboardingAnswerDto,
    @Req() req: any
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user?.id; // Assuming auth middleware sets user
    return this.onboardingService.submitAnswer(userId, createAnswerDto);
  }

  @Put('complete')
  async completeOnboarding(
    @Body() completeDto: CompleteOnboardingDto,
    @Req() req: any
  ): Promise<OnboardingStatusDto> {
    const userId = req.user?.id;
    return this.onboardingService.completeOnboarding(userId, completeDto);
  }

  @Get('status')
  async getOnboardingStatus(@Req() req: any): Promise<OnboardingStatusDto> {
    const userId = req.user?.id;
    return this.onboardingService.getOnboardingStatus(userId);
  }
} 