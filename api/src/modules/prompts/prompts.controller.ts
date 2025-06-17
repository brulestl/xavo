import { Controller, Post, Body } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { GeneratePromptsDto } from './dto/generate-prompts.dto';

@Controller('api/v1/prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Post()
  async generatePrompts(@Body() generatePromptsDto: GeneratePromptsDto) {
    const { userId, count = 5 } = generatePromptsDto;
    const prompts = await this.promptsService.generate(userId, count);
    return { prompts };
  }
} 