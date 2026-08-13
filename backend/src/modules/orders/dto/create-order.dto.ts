import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/order.entity';

export class CreateOrderItemDto {
  @ApiProperty({ description: 'product id' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Authenticated user id. Optional for guest checkout.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 'Kalana Yasassri' })
  @IsString()
  @Length(2, 150)
  customerName: string;

  @ApiProperty({ example: 'customer@foodie.com' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ example: '+94717595111' })
  @IsString()
  @Length(7, 30)
  customerPhone: string;

  @ApiProperty({ example: '153 Temple Road, Maharagama' })
  @IsString()
  @Length(5, 255)
  address: string;

  @ApiPropertyOptional({ example: 'Extra cheese please' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  note?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH_ON_DELIVERY })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'] })
  @IsEnum(['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])
  status: string;
}
