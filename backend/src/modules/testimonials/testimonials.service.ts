import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Testimonial } from './entities/testimonial.entity';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectRepository(Testimonial)
    private readonly testimonialsRepo: Repository<Testimonial>,
  ) {}

  async findAll() {
    const items = await this.testimonialsRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return items;
  }

  async findOne(id: string) {
    const testimonial = await this.testimonialsRepo.findOne({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }
    return testimonial;
  }

  async create(dto: CreateTestimonialDto) {
    const testimonial = this.testimonialsRepo.create({
      ...dto,
      rating: dto.rating ?? 5,
    });
    return this.testimonialsRepo.save(testimonial);
  }

  async update(id: string, dto: UpdateTestimonialDto) {
    const testimonial = await this.findOne(id);
    Object.assign(testimonial, dto);
    return this.testimonialsRepo.save(testimonial);
  }

  async remove(id: string) {
    const testimonial = await this.findOne(id);
    await this.testimonialsRepo.remove(testimonial);
    return { message: 'Testimonial deleted successfully' };
  }
}
