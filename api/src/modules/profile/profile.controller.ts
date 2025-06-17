import { Controller, Get, Put, Post, Body, Req } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { 
  CompleteProfileDto,
  UpdateProfileDto,
  UpdatePersonalizationDto,
  SavePersonalityScoresDto,
  GenerateAiPromptsDto,
  GenerateSummaryDto,
  GeneratePersonaSummaryDto,
  GenerateCorporateSummaryDto
} from './dto/profile.dto';

@Controller('api/v1/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getProfile(@Req() req: any): Promise<CompleteProfileDto> {
    const userId = req.user?.id; // Assuming auth middleware sets user
    return this.profileService.getProfile(userId);
  }

  @Put('personalization')
  async updatePersonalization(
    @Body() updateDto: UpdatePersonalizationDto,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.profileService.updatePersonalization(userId, updateDto);
  }

  @Get('personality')
  async getPersonalityScores(@Req() req: any): Promise<Record<string, number>> {
    const userId = req.user?.id;
    return this.profileService.getPersonalityScores(userId);
  }

  @Post('personality-scores')
  async savePersonalityScores(
    @Body() saveDto: SavePersonalityScoresDto,
    @Req() req: any
  ) {
    try {
      // Use userId from request body if available, otherwise try from auth
      const userId = saveDto.userId || req.user?.id;
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      return this.profileService.savePersonalityScores(userId, saveDto);
    } catch (error) {
      console.error('Error in savePersonalityScores controller:', error);
      throw error;
    }
  }

  @Put('profile')
  async updateProfile(
    @Body() updateDto: UpdateProfileDto,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.profileService.updateProfile(userId, updateDto);
  }

  @Post('generate-ai-prompts')
  async generateAiPrompts(
    @Body() dto: GenerateAiPromptsDto,
    @Req() req: any
  ): Promise<{ prompts: string[] }> {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return this.profileService.generateAiPrompts(userId, dto);
  }

  @Post('generate-summary')
  async generateSummary(
    @Body() dto: GenerateSummaryDto,
    @Req() req: any
  ): Promise<{ summary: string }> {
    // Use userId from DTO if provided, otherwise from auth
    const userId = dto.userId || req.user?.id;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return this.profileService.generateQuizSummary(userId);
  }

  @Post('generate-persona-summary')
  async generatePersonaSummary(
    @Body() dto: GeneratePersonaSummaryDto,
    @Req() req: any
  ): Promise<{ summary: string }> {
    // Use userId from DTO if provided, otherwise from auth
    const userId = dto.userId || req.user?.id;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return this.profileService.generatePersonaSummary(userId);
  }

  @Post('generate-summary')
  async generateCorporateSummary(
    @Body() dto: GenerateCorporateSummaryDto,
    @Req() req: any
  ): Promise<{ summary: string }> {
    // Use userId from DTO if provided, otherwise from auth
    const userId = dto.userId || req.user?.id;
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return this.profileService.generateCorporateSummary(userId);
  }
} 