import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { getPaginationParams, buildPaginated } from '../../common/helpers/pagination';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async findAll(page = 1, limit = 20, search = '') {
    const params = getPaginationParams(page, limit);
    const qb = this.usersRepo.createQueryBuilder('user');

    if (search) {
      qb.where('user.name ILIKE :search OR user.email ILIKE :search', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('user.createdAt', 'DESC').skip(params.skip).take(params.take);
    const [items, total] = await qb.getManyAndCount();
    return buildPaginated(items, total, params);
  }

  async findOne(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
      if (existing) {
        throw new BadRequestException('Email is already in use');
      }
      user.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.address !== undefined) user.address = dto.address;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    const { password, ...saved } = await this.usersRepo.save(user);
    return saved;
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.usersRepo.remove(user);
    return { message: 'User deleted successfully' };
  }
}
