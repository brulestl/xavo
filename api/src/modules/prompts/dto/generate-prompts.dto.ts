import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class GeneratePromptsDto {
  @IsString()
  userId: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  count?: number = 5;
} 