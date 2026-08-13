import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { getPaginationParams, buildPaginated } from '../../common/helpers/pagination';

const DELIVERY_FEE = 2.5;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const stamp =
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `FD-${stamp}-${random}`;
  }

  async create(dto: CreateOrderDto, currentUser?: JwtUser) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productsRepo.find({ where: { id: In(productIds) } });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products do not exist');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product.isAvailable) {
        throw new BadRequestException(`Product "${product.name}" is not available`);
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        );
      }
    }

    const userId =
      dto.userId ??
      (currentUser?.role === 'admin' ? undefined : currentUser?.sub) ??
      null;

    let subtotal = 0;
    let discount = 0;

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      const price = Number(product.price);
      const oldPrice = product.oldPrice ? Number(product.oldPrice) : price;
      const itemDiscount = oldPrice > price ? (oldPrice - price) * item.quantity : 0;
      subtotal += price * item.quantity;
      discount += itemDiscount;
    }

    const total = subtotal - discount + DELIVERY_FEE;
    if (total < 0) {
      throw new BadRequestException('Order total cannot be negative');
    }

    const order = this.ordersRepo.create({
      orderNumber: this.generateOrderNumber(),
      userId,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail.toLowerCase(),
      customerPhone: dto.customerPhone,
      address: dto.address,
      note: dto.note,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH_ON_DELIVERY,
      subtotal,
      discount,
      deliveryFee: DELIVERY_FEE,
      total,
    });
    const savedOrder = await this.ordersRepo.save(order);

    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      const price = Number(product.price);
      return this.orderItemsRepo.create({
        orderId: savedOrder.id,
        productId: product.id,
        productName: product.name,
        productImage: product.image,
        unitPrice: price,
        quantity: item.quantity,
        discount: product.oldPrice && Number(product.oldPrice) > price
          ? (Number(product.oldPrice) - price) * item.quantity
          : 0,
        total: price * item.quantity,
      });
    });

    await this.orderItemsRepo.save(items);

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      product.stock -= item.quantity;
      await this.productsRepo.save(product);
    }

    return this.findOne(savedOrder.id);
  }

  async findAll(query: { page: number; limit: number; status?: string; search?: string }) {
    const params = getPaginationParams(query.page, query.limit);
    const qb = this.ordersRepo.createQueryBuilder('order');

    if (query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(order.orderNumber ILIKE :search OR order.customerName ILIKE :search OR order.customerEmail ILIKE :search OR order.customerPhone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy('order.createdAt', 'DESC').skip(params.skip).take(params.take);
    const [items, total] = await qb.getManyAndCount();
    return buildPaginated(items, total, params);
  }

  async findMyOrders(userId: string, page = 1, limit = 10) {
    const params = getPaginationParams(page, limit);
    const [items, total] = await this.ordersRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: params.skip,
      take: params.take,
    });
    return buildPaginated(items, total, params);
  }

  async findOne(id: string) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.ordersRepo.findOne({ where: { orderNumber } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    const next = dto.status as OrderStatus;
    if (order.status === OrderStatus.DELIVERED && next !== OrderStatus.CANCELLED) {
      throw new BadRequestException('A delivered order can only be cancelled');
    }
    order.status = next;
    return this.ordersRepo.save(order);
  }

  async cancelOwnOrder(id: string, userId: string) {
    const order = await this.findOne(id);
    if (order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Order can only be cancelled while pending or confirmed',
      );
    }
    order.status = OrderStatus.CANCELLED;
    return this.ordersRepo.save(order);
  }

  async stats() {
    const [totalOrders, totalRevenue, deliveredOrders, pendingOrders] =
      await Promise.all([
        this.ordersRepo.count(),
        this.ordersRepo
          .createQueryBuilder('order')
          .select('COALESCE(SUM(order.total), 0)', 'sum')
          .where('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
          .getRawOne(),
        this.ordersRepo.count({ where: { status: OrderStatus.DELIVERED } }),
        this.ordersRepo.count({ where: { status: OrderStatus.PENDING } }),
      ]);
    return {
      totalOrders,
      totalRevenue: Number(totalRevenue?.sum ?? 0),
      deliveredOrders,
      pendingOrders,
    };
  }
}
