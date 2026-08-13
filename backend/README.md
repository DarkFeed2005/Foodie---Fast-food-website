# Foodie API - NestJS Backend

Powerful REST API backend for the Foodie fast-food website. Built with **NestJS 10**, **TypeORM** and **PostgreSQL (Neon)**.

## Features

- **Auth** - register / login / profile with JWT + bcrypt, role-based access (admin / customer)
- **Products & Categories** - menu with category filter, search, price range, sorting, pagination, featured items
- **Orders** - guest & logged-in checkout, order number tracking, status flow (pending -> confirmed -> preparing -> out_for_delivery -> delivered / cancelled), stock management, admin stats
- **Reservations** - "Book a Table" (name, email, phone, persons, date, time, message), booking-number lookup, status management
- **Blogs** - posts with slugs, view counter, drafts, category filter
- **Testimonials** - customer reviews
- **Uploads** - image upload (admin) served at `/api/uploads`
- **Extras** - Swagger docs, rate limiting, helmet, compression, CORS, global exception filter, consistent `{ success, statusCode, message, data }` response envelope

## Quick Start

```bash
cd backend
cp .env.example .env      # then fill in DATABASE_URL
npm install
npm run seed              # creates tables, admin user, menu, blogs, testimonials
npm run start:dev         # http://localhost:3001/api  |  docs: /api/docs
```

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run start`   | start the server                     |
| `npm run start:dev` | start with hot reload              |
| `npm run start:prod` | start compiled build (dist)       |
| `npm run build`   | compile to `dist/`                   |
| `npm run seed`    | populate the database with demo data |
| `npm run lint`    | TypeScript type check                |

## Default Admin (created by seed)

```
email:    admin@foodie.com
password: Admin@12345
```

## API Overview (prefix `/api/v1`)

| Method   | Endpoint                          | Access | Description                          |
| -------- | --------------------------------- | ------ | ------------------------------------ |
| POST     | /auth/register                    | public | create account                       |
| POST     | /auth/login                       | public | login, returns JWT                   |
| GET      | /auth/profile                     | user   | current profile                      |
| GET      | /products                         | public | menu with filters & pagination       |
| GET      | /products/featured                | public | featured items                       |
| GET      | /products/slug/:slug              | public | product by slug                      |
| GET/POST | /categories                       | pub/admin | list / create categories          |
| POST     | /orders                           | public | place order (guest or logged in)     |
| GET      | /orders/my-orders                 | user   | my orders                            |
| GET      | /orders/number/:orderNumber       | user   | track order                          |
| PATCH    | /orders/:id/status                | admin  | update order status                  |
| POST     | /reservations                     | public | book a table                         |
| GET      | /reservations/number/:bookingNumber | public | check reservation                |
| GET      | /blogs                            | public | published posts                      |
| GET      | /blogs/slug/:slug                 | public | single post (increments views)       |
| GET      | /testimonials                     | public | customer reviews                     |
| POST     | /upload/image                     | admin  | upload an image                      |

Admin-only write endpoints are protected with `Authorization: Bearer <token>`.

## Environment Variables

See `.env.example`. **Never expose `DATABASE_URL` or `JWT_SECRET` to client-side code.**

## Connecting the Frontend

The frontend (static HTML) can call the API directly, e.g.:

```js
// fetch the menu
const res = await fetch('http://localhost:3001/api/v1/products?categorySlug=burger');
const { data } = await res.json();

// book a table
await fetch('http://localhost:3001/api/v1/reservations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Your Name',
    email: 'you@example.com',
    totalPerson: '2 Person',
    bookingDate: '2026-08-20',
    message: 'Window table please',
  }),
});
```

CORS is enabled by default in development, so `index.html` opened locally can call the API without extra setup.
