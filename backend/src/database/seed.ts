import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Product } from '../modules/products/entities/product.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { OrderItem } from '../modules/orders/entities/order-item.entity';
import { Reservation } from '../modules/reservations/entities/reservation.entity';
import { BlogPost } from '../modules/blogs/entities/blog-post.entity';
import { Testimonial } from '../modules/testimonials/entities/testimonial.entity';

loadEnv({ path: join(__dirname, '../../.env') });

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Category,
    Product,
    Order,
    OrderItem,
    Reservation,
    BlogPost,
    Testimonial,
  ],
  synchronize: true,
  ssl: { rejectUnauthorized: false },
});

const IMAGE_SRC = join(__dirname, '../../../assets/images');

async function copyWebsiteImages() {
  const uploadDir = join(__dirname, '../../uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  const images: Record<string, string> = {
    'food-menu-1.png': 'food-menu-1.png',
    'food-menu-2.png': 'food-menu-2.png',
    'food-menu-3.png': 'food-menu-3.png',
    'food-menu-4.png': 'food-menu-4.png',
    'food-menu-5.png': 'food-menu-5.png',
    'food-menu-6.png': 'food-menu-6.png',
    'promo-1.png': 'promo-1.png',
    'promo-2.png': 'promo-2.png',
    'promo-3.png': 'promo-3.png',
    'promo-4.png': 'promo-4.png',
    'promo-5.png': 'promo-5.png',
    'blog-1.jpg': 'blog-1.jpg',
    'blog-2.jpg': 'blog-2.jpg',
    'blog-3.jpg': 'blog-3.jpg',
    'avatar-1.jpg': 'avatar-1.jpg',
    'avatar-2.jpg': 'avatar-2.jpg',
    'avatar-3.jpg': 'avatar-3.jpg',
  };
  const copied: string[] = [];
  for (const [srcName, destName] of Object.entries(images)) {
    const src = join(IMAGE_SRC, srcName);
    const dest = join(uploadDir, destName);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      copied.push(destName);
    }
  }
  return copied;
}

async function seed() {
  await dataSource.initialize();
  console.log('Connected to Neon PostgreSQL');

  const copied = await copyWebsiteImages();
  console.log(`Copied ${copied.length} website images into uploads/`);

  const userRepo = dataSource.getRepository(User);
  const categoryRepo = dataSource.getRepository(Category);
  const productRepo = dataSource.getRepository(Product);
  const blogRepo = dataSource.getRepository(BlogPost);
  const testimonialRepo = dataSource.getRepository(Testimonial);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@foodie.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        name: 'Foodie Admin',
        email: adminEmail,
        password: adminPassword,
        role: UserRole.ADMIN,
        phone: '+94717595111',
        address: '153 Temple Road, Maharagama',
      }),
    );
    console.log(`Created admin user: ${adminEmail} / ${adminPassword}`);
  } else {
    const passwordOk = await bcrypt.compare(adminPassword, admin.password);
    if (!passwordOk) {
      admin.password = await bcrypt.hash(adminPassword, 10);
      await userRepo.save(admin);
      console.log(`Reset admin password for: ${adminEmail}`);
    }
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  const categoryData = [
    { name: 'Pizza', description: 'Wood-fired, cheesy and delicious pizzas' },
    { name: 'Burger', description: 'Juicy burgers made fresh to order' },
    { name: 'Drinks', description: 'Refreshing soft drinks and shakes' },
    { name: 'Sandwich', description: 'Hearty sandwiches for every craving' },
  ];

  const categories: Record<string, Category> = {};
  for (const c of categoryData) {
    let cat = await categoryRepo.findOne({ where: { slug: c.name.toLowerCase() } });
    if (!cat) {
      cat = await categoryRepo.save(categoryRepo.create({ ...c, slug: c.name.toLowerCase() }));
      console.log(`Created category: ${c.name}`);
    }
    categories[c.name] = cat;
  }

  interface SeedProduct {
    name: string;
    description: string;
    price: number;
    oldPrice: number;
    discount: number;
    category: string;
    image: string;
    rating: number;
    reviewCount: number;
    stock: number;
    isAvailable: boolean;
    isFeatured: boolean;
  }

  const productData: SeedProduct[] = [
    {
      name: 'Fried Chicken Unlimited',
      description: 'Crispy, golden fried chicken served with unlimited sides. A customer favourite!',
      price: 49,
      oldPrice: 69,
      discount: 15,
      category: 'Burger',
      image: '/api/uploads/food-menu-1.png',
      rating: 4.5,
      reviewCount: 128,
      stock: 100,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'Burger King Whopper',
      description: 'Flame-grilled whopper with fresh lettuce, tomatoes and our signature sauce.',
      price: 29,
      oldPrice: 39,
      discount: 10,
      category: 'Burger',
      image: '/api/uploads/food-menu-2.png',
      rating: 4.8,
      reviewCount: 205,
      stock: 150,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'White Castle Pizzas',
      description: 'Thin crust pizza loaded with mozzarella, pepperoni and garden vegetables.',
      price: 49,
      oldPrice: 69,
      discount: 25,
      category: 'Pizza',
      image: '/api/uploads/food-menu-3.png',
      rating: 4.7,
      reviewCount: 173,
      stock: 80,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'Bell Burrito Supreme',
      description: 'Warm tortilla wrapped around seasoned beef, rice, beans and cheese.',
      price: 59,
      oldPrice: 69,
      discount: 20,
      category: 'Sandwich',
      image: '/api/uploads/food-menu-4.png',
      rating: 4.6,
      reviewCount: 96,
      stock: 60,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'Kung Pao Chicken BBQ',
      description: 'BBQ glazed chicken nuggets with a spicy kung pao kick.',
      price: 49,
      oldPrice: 69,
      discount: 5,
      category: 'Burger',
      image: '/api/uploads/food-menu-5.png',
      rating: 4.4,
      reviewCount: 87,
      stock: 120,
      isAvailable: true,
      isFeatured: false,
    },
    {
      name: "Wendy's Chicken",
      description: 'Tender chicken fillet sandwich with creamy mayo and crunchy slaw.',
      price: 49,
      oldPrice: 69,
      discount: 15,
      category: 'Sandwich',
      image: '/api/uploads/food-menu-6.png',
      rating: 4.7,
      reviewCount: 141,
      stock: 90,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'Maxican Pizza',
      description: 'Bold Mexican-style pizza with spicy chorizo, jalapenos and three cheeses.',
      price: 39,
      oldPrice: 49,
      discount: 20,
      category: 'Pizza',
      image: '/api/uploads/promo-1.png',
      rating: 4.6,
      reviewCount: 112,
      stock: 70,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'Soft Drinks',
      description: 'Ice-cold soft drinks, shakes and fresh juices to go with your meal.',
      price: 5,
      oldPrice: 7,
      discount: 28,
      category: 'Drinks',
      image: '/api/uploads/promo-2.png',
      rating: 4.5,
      reviewCount: 260,
      stock: 500,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'French Fry',
      description: 'Crispy golden french fries sprinkled with our secret seasoning.',
      price: 8,
      oldPrice: 12,
      discount: 33,
      category: 'Sandwich',
      image: '/api/uploads/promo-3.png',
      rating: 4.6,
      reviewCount: 198,
      stock: 400,
      isAvailable: true,
      isFeatured: false,
    },
    {
      name: 'Burger Kingo',
      description: 'Double-patty kingo burger with melted cheese and smoky BBQ sauce.',
      price: 35,
      oldPrice: 45,
      discount: 22,
      category: 'Burger',
      image: '/api/uploads/promo-4.png',
      rating: 4.9,
      reviewCount: 310,
      stock: 110,
      isAvailable: true,
      isFeatured: true,
    },
    {
      name: 'Chicken Masala',
      description: 'Spicy chicken masala with fresh naan and basmati rice.',
      price: 42,
      oldPrice: 55,
      discount: 23,
      category: 'Sandwich',
      image: '/api/uploads/promo-5.png',
      rating: 4.8,
      reviewCount: 154,
      stock: 85,
      isAvailable: true,
      isFeatured: false,
    },
  ];

  for (const p of productData) {
    const { category, ...productFields } = p;
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const categoryId = categories[category].id;
    let existing = await productRepo.findOne({ where: { slug } });
    if (!existing) {
      await productRepo.save(
        productRepo.create({
          ...productFields,
          slug,
          categoryId,
        } as any),
      );
      console.log(`Created product: ${p.name}`);
    } else {
      console.log(`Product exists, updating: ${p.name}`);
      Object.assign(existing, productFields, { categoryId });
      await productRepo.save(existing);
    }
  }

  const blogData = [
    {
      title: 'What Do You Think About Cheese Pizza Recipes?',
      category: 'Pizza',
      excerpt: 'Financial experts support or help you to find out which way you can raise your funds more...',
      content:
        '<p>Financial experts support or help you to find out which way you can raise your funds more.</p><p>From the classic Margherita to a four-cheese feast, discover how to pick the perfect cheese blend for your next homemade pizza night.</p>',
      image: '/api/uploads/blog-1.jpg',
      author: 'Kalana Yasassri',
      isPublished: true,
    },
    {
      title: 'Making Chicken Strips With New Delicious Ingridents.',
      category: 'Burger',
      excerpt: 'Financial experts support or help you to find out which way you can raise your funds more...',
      content:
        '<p>Financial experts support or help you to find out which way you can raise your funds more.</p><p>Crunchy, juicy chicken strips made with a secret blend of herbs and a crispy panko coating.</p>',
      image: '/api/uploads/blog-2.jpg',
      author: 'Kalana Yasassri',
      isPublished: true,
    },
    {
      title: 'Innovative Hot Chessyraw Pasta Make Creator Fact.',
      category: 'Chicken',
      excerpt: 'Financial experts support or help you to find out which way you can raise your funds more...',
      content:
        '<p>Financial experts support or help you to find out which way you can raise your funds more.</p><p>An innovative take on cheesy pasta that will change the way you think about comfort food.</p>',
      image: '/api/uploads/blog-3.jpg',
      author: 'Kalana Yasassri',
      isPublished: true,
    },
  ];

  for (const b of blogData) {
    const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let existing = await blogRepo.findOne({ where: { slug } });
    if (!existing) {
      await blogRepo.save(
        blogRepo.create({
          ...b,
          slug,
          publishedAt: new Date().toISOString().slice(0, 10),
        }),
      );
      console.log(`Created blog post: ${b.title}`);
    } else {
      console.log(`Blog post exists: ${b.title}`);
    }
  }

  const testimonialData = [
    {
      name: 'Robert William',
      title: 'CEO Kingfisher',
      content:
        'I would be lost without restaurant. I would like to personally thank you for your outstanding product.',
      avatar: '/api/uploads/avatar-1.jpg',
      rating: 5,
      isActive: true,
    },
    {
      name: 'Thomas Josef',
      title: 'CEO Getforce',
      content:
        'I would be lost without restaurant. I would like to personally thank you for your outstanding product.',
      avatar: '/api/uploads/avatar-2.jpg',
      rating: 5,
      isActive: true,
    },
    {
      name: 'Charles Richard',
      title: 'CEO Angela',
      content:
        'I would be lost without restaurant. I would like to personally thank you for your outstanding product.',
      avatar: '/api/uploads/avatar-3.jpg',
      rating: 5,
      isActive: true,
    },
  ];

  for (const t of testimonialData) {
    const existing = await testimonialRepo.findOne({ where: { name: t.name } });
    if (!existing) {
      await testimonialRepo.save(testimonialRepo.create(t));
      console.log(`Created testimonial: ${t.name}`);
    } else {
      console.log(`Testimonial exists: ${t.name}`);
    }
  }

  console.log('\nSeeding complete!');
  console.log(`Admin login -> email: ${adminEmail}, password: ${adminPassword}`);
  console.log('Login endpoint: POST /api/v1/auth/login');

  await dataSource.destroy();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
