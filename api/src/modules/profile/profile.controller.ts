import { Controller, Get, Put, Body, Req } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { 
  CompleteProfileDto,
  UpdateProfileDto,
  UpdatePersonalizationDto
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

  @Put('profile')
  async updateProfile(
    @Body() updateDto: UpdateProfileDto,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.profileService.updateProfile(userId, updateDto);
  }
} 