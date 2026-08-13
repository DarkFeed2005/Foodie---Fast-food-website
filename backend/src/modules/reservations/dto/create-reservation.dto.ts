import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ example: 'Kalana Yasassri' })
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ example: 'customer@foodie.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+94717595111' })
  @IsOptional()
  @IsString()
  @Length(7, 30)
  phone?: string;

  @ApiProperty({ example: '2 Person' })
  @IsString()
  @Length(1, 50)
  totalPerson: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  bookingDate: string;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'bookingTime must be in HH:MM format',
  })
  bookingTime?: string;

  @ApiPropertyOptional({ example: 'A window table please' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  message?: string;
}
