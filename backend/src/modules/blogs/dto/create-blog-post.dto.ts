import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsInt,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBlogPostDto {
  @ApiProperty({ example: 'What Do You Think About Cheese Pizza Recipes?' })
  @IsString()
  @Length(5, 200)
  title: string;

  @ApiPropertyOptional({ example: 'Pizza' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  category?: string;

  @ApiPropertyOptional({ example: 'Short summary of the article...' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({ example: 'Full article content in HTML or markdown...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: '/api/uploads/blog-1.jpg' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: 'Kalana Yasassri' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  author?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ example: '2026-08-13' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
