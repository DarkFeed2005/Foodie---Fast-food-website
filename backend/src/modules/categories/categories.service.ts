import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
  ) {}

  async findAll() {
    const categories = await this.categoriesRepo.find({
      relations: { products: true },
      order: { name: 'ASC' },
    });
    return categories.map((c) => ({
      ...c,
      products: undefined,
      productCount: c.products?.length ?? 0,
    }));
  }

  async findOne(id: string, withProducts = false) {
    const category = await this.categoriesRepo.findOne({
      where: { id },
      relations: withProducts ? { products: true } : {},
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const baseSlug = slugify(dto.name, { lower: true, strict: true });
    let slug = baseSlug;
    let suffix = 1;
    while (await this.categoriesRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }
    const category = this.categoriesRepo.create({ ...dto, slug });
    return this.categoriesRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    if (dto.name && dto.name !== category.name) {
      category.slug = slugify(dto.name, { lower: true, strict: true });
    }
    return this.categoriesRepo.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    const productCount = await category.products
      ? category.products.length
      : 0;
    if (productCount > 0) {
      throw new BadRequestException(
        'Cannot delete category that still has products. Move or delete its products first.',
      );
    }
    await this.categoriesRepo.remove(category);
    return { message: 'Category deleted successfully' };
  }
}
