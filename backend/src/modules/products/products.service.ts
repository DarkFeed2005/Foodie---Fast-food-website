import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { getPaginationParams, buildPaginated } from '../../common/helpers/pagination';

export interface ProductQueryFilters {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
  ) {}

  async findAll(filters: ProductQueryFilters) {
    const params = getPaginationParams(filters.page, filters.limit);
    const qb = this.productsRepo.createQueryBuilder('product');

    if (filters.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters.category) {
      qb.andWhere('product.categoryId = :category', { category: filters.category });
    }
    if (filters.categorySlug) {
      qb.innerJoin('product.category', 'cat').andWhere('cat.slug = :slug', {
        slug: filters.categorySlug,
      });
    }
    if (typeof filters.minPrice === 'number' && !Number.isNaN(filters.minPrice)) {
      qb.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (typeof filters.maxPrice === 'number' && !Number.isNaN(filters.maxPrice)) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }
    if (filters.isAvailable !== undefined) {
      qb.andWhere('product.isAvailable = :isAvailable', {
        isAvailable: filters.isAvailable,
      });
    }
    if (filters.isFeatured !== undefined) {
      qb.andWhere('product.isFeatured = :isFeatured', {
        isFeatured: filters.isFeatured,
      });
    }

    switch (filters.sort) {
      case 'price_asc':
        qb.orderBy('product.price', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('product.price', 'DESC');
        break;
      case 'newest':
        qb.orderBy('product.createdAt', 'DESC');
        break;
      case 'rating':
        qb.orderBy('product.rating', 'DESC');
        break;
      case 'popular':
        qb.orderBy('product.reviewCount', 'DESC');
        break;
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }

        qb.skip(params.skip).take(params.take);
        const [items, total] = await qb.getManyAndCount();
        return buildPaginated(items, total, params);
  }

  async findOne(id: string) {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.productsRepo.findOne({ where: { slug } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    const baseSlug = slugify(dto.name, { lower: true, strict: true });
    let slug = baseSlug;
    let suffix = 1;
    while (await this.productsRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }
    const product = this.productsRepo.create({ ...dto, slug });
    return this.productsRepo.save(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    if (dto.name && dto.name !== product.name) {
      product.slug = slugify(dto.name, { lower: true, strict: true });
    }
    return this.productsRepo.save(product);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.productsRepo.remove(product);
    return { message: 'Product deleted successfully' };
  }

  async getFeatured(limit = 8) {
    const items = await this.productsRepo.find({
      where: { isFeatured: true, isAvailable: true },
      take: Math.min(limit, 50),
      order: { createdAt: 'DESC' },
    });
    return items;
  }
}
