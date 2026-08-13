import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }
    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: dto.password,
      phone: dto.phone,
      address: dto.address,
      role: dto.role ?? UserRole.CUSTOMER,
    });
    const saved = await this.usersRepo.save(user);
    return {
      message: 'Account created successfully',
      user: this.sanitize(saved),
      accessToken: this.signToken(saved),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await user.validatePassword(dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled. Contact support.');
    }
    return {
      message: 'Login successful',
      user: this.sanitize(user),
      accessToken: this.signToken(user),
    };
  }

  async getProfile(currentUser: JwtUser) {
    const user = await this.usersRepo.findOne({ where: { id: currentUser.sub } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  signToken(user: User): string {
    const payload: JwtUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return this.jwtService.sign(payload);
  }

  sanitize(user: User) {
    const { password, ...rest } = user;
    return rest;
  }
}
