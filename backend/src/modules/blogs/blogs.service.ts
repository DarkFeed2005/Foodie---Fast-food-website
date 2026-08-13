import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { BlogPost } from './entities/blog-post.entity';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { getPaginationParams, buildPaginated } from '../../common/helpers/pagination';

@Injectable()
export class BlogsService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly blogsRepo: Repository<BlogPost>,
  ) {}

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    includeUnpublished?: boolean;
  }) {
    const params = getPaginationParams(query.page, query.limit);
    const qb = this.blogsRepo.createQueryBuilder('post');

    if (!query.includeUnpublished) {
      qb.where('post.isPublished = true');
    }
    if (query.search) {
      qb.andWhere('(post.title ILIKE :search OR post.excerpt ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.category) {
      qb.andWhere('post.category ILIKE :category', {
        category: `%${query.category}%`,
      });
    }
    qb.orderBy('post.publishedAt', 'DESC')
      .addOrderBy('post.createdAt', 'DESC')
      .skip(params.skip)
      .take(params.take);
    const [items, total] = await qb.getManyAndCount();
    return buildPaginated(items, total, params);
  }

  async findOne(id: string) {
    const post = await this.blogsRepo.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }
    return post;
  }

  async findBySlug(slug: string) {
    const post = await this.blogsRepo.findOne({ where: { slug } });
    if (!post || !post.isPublished) {
      throw new NotFoundException('Blog post not found');
    }
    post.views += 1;
    await this.blogsRepo.save(post);
    return post;
  }

  async create(dto: CreateBlogPostDto) {
    const baseSlug = slugify(dto.title, { lower: true, strict: true });
    let slug = baseSlug;
    let suffix = 1;
    while (await this.blogsRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }
    const post = this.blogsRepo.create({
      ...dto,
      slug,
      publishedAt: dto.publishedAt ?? new Date().toISOString().slice(0, 10),
    });
    return this.blogsRepo.save(post);
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const post = await this.findOne(id);
    Object.assign(post, dto);
    if (dto.title && dto.title !== post.title) {
      post.slug = slugify(dto.title, { lower: true, strict: true });
    }
    return this.blogsRepo.save(post);
  }

  async remove(id: string) {
    const post = await this.findOne(id);
    await this.blogsRepo.remove(post);
    return { message: 'Blog post deleted successfully' };
  }
}
