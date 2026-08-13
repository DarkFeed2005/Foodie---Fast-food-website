import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { getPaginationParams, buildPaginated } from '../../common/helpers/pagination';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepo: Repository<Reservation>,
  ) {}

  private generateBookingNumber(): string {
    const now = new Date();
    const stamp =
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RB-${stamp}-${random}`;
  }

  async create(dto: CreateReservationDto) {
    const booking = this.reservationsRepo.create({
      bookingNumber: this.generateBookingNumber(),
      ...dto,
    });
    const saved = await this.reservationsRepo.save(booking);
    return {
      message: `Table booked successfully. Your booking number is ${saved.bookingNumber}`,
      reservation: saved,
    };
  }

  async findAll(query: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
    date?: string;
  }) {
    const params = getPaginationParams(query.page, query.limit);
    const qb = this.reservationsRepo.createQueryBuilder('reservation');

    if (query.status) {
      qb.andWhere('reservation.status = :status', { status: query.status });
    }
    if (query.date) {
      qb.andWhere('reservation.bookingDate = :date', { date: query.date });
    }
    if (query.search) {
      qb.andWhere(
        '(reservation.fullName ILIKE :search OR reservation.email ILIKE :search OR reservation.bookingNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy('reservation.bookingDate', 'DESC')
      .addOrderBy('reservation.createdAt', 'DESC')
      .skip(params.skip)
      .take(params.take);
    const [items, total] = await qb.getManyAndCount();
    return buildPaginated(items, total, params);
  }

  async findOne(id: string) {
    const reservation = await this.reservationsRepo.findOne({ where: { id } });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  async findByBookingNumber(bookingNumber: string) {
    const reservation = await this.reservationsRepo.findOne({
      where: { bookingNumber },
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto) {
    const reservation = await this.findOne(id);
    Object.assign(reservation, dto);
    return this.reservationsRepo.save(reservation);
  }

  async remove(id: string) {
    const reservation = await this.findOne(id);
    await this.reservationsRepo.remove(reservation);
    return { message: 'Reservation deleted successfully' };
  }

  async stats() {
    const [total, pending, confirmed, cancelled, completed] = await Promise.all([
      this.reservationsRepo.count(),
      this.reservationsRepo.count({ where: { status: ReservationStatus.PENDING } }),
      this.reservationsRepo.count({ where: { status: ReservationStatus.CONFIRMED } }),
      this.reservationsRepo.count({ where: { status: ReservationStatus.CANCELLED } }),
      this.reservationsRepo.count({ where: { status: ReservationStatus.COMPLETED } }),
    ]);
    return { total, pending, confirmed, cancelled, completed };
  }
}
