import { ulid } from 'ulid';
import { getDb } from '@/db/index.js';
import * as authSchema from './schema/auth.js';
import { comment } from './schema/comments.js';
import { post } from './schema/posts.js';

async function seed() {
  const db = getDb();

  console.log('Seeding database...');

  // Clear existing data in FK-safe order
  await db.delete(comment);
  await db.delete(post);
  await db.delete(authSchema.session);
  await db.delete(authSchema.account);
  await db.delete(authSchema.verification);
  await db.delete(authSchema.user);

  // ── Users ──
  const adminId = ulid();
  const userId = ulid();

  const adminPassword = await Bun.password.hash('admin123');
  const userPassword = await Bun.password.hash('user123');

  await db.insert(authSchema.user).values([
    {
      id: adminId,
      email: 'admin@example.com',
      emailVerified: true,
      name: 'Admin User',
      role: 'admin',
    },
    {
      id: userId,
      email: 'user@example.com',
      emailVerified: true,
      name: 'Regular User',
      role: 'user',
    },
  ]);

  await db.insert(authSchema.account).values([
    {
      userId: adminId,
      accountId: 'admin@example.com',
      providerId: 'email',
      password: adminPassword,
    },
    {
      userId: userId,
      accountId: 'user@example.com',
      providerId: 'email',
      password: userPassword,
    },
  ]);

  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const adminToken = ulid();
  const userToken = ulid();

  await db.insert(authSchema.session).values([
    {
      userId: adminId,
      token: adminToken,
      expiresAt,
    },
    {
      userId: userId,
      token: userToken,
      expiresAt,
    },
  ]);

  // ── Posts ──
  const post1Id = ulid();
  const post2Id = ulid();
  const post3Id = ulid();

  await db.insert(post).values([
    {
      id: post1Id,
      title: 'Getting Started with Fastify',
      slug: 'getting-started-with-fastify',
      content:
        'Fastify is a fast and low-overhead web framework for Node.js. It supports TypeScript out of the box, has a powerful plugin system, and is one of the fastest Node.js web frameworks available.\n\nIn this post, we will explore how to set up a Fastify project, define routes, and use plugins to extend functionality.',
      published: true,
      authorId: adminId,
    },
    {
      id: post2Id,
      title: 'Understanding Drizzle ORM',
      slug: 'understanding-drizzle-orm',
      content:
        'Drizzle is a lightweight TypeScript ORM that provides a SQL-like query builder. Unlike traditional ORMs, Drizzle embraces SQL while providing type safety.\n\nIt supports multiple databases including PostgreSQL, MySQL, and SQLite, making it a versatile choice for modern applications.',
      published: true,
      authorId: userId,
    },
    {
      id: post3Id,
      title: 'Draft: Upcoming Features',
      slug: 'draft-upcoming-features',
      content:
        'This is a draft post about upcoming features that is not yet published. Only the author and admins can see this post.',
      published: false,
      authorId: adminId,
    },
  ]);

  // ── Comments ──
  await db.insert(comment).values([
    {
      postId: post1Id,
      authorId: userId,
      content: 'Great introduction! Fastify has been a game changer for my projects.',
    },
    {
      postId: post1Id,
      authorId: adminId,
      content: 'Thanks! Glad you found it helpful.',
    },
    {
      postId: post2Id,
      authorId: adminId,
      content: 'Nice write-up! Drizzle type safety is incredible.',
    },
  ]);

  console.log('Database seeded successfully!');
  console.log('');
  console.log('Users:');
  console.log('  Admin: admin@example.com / admin123');
  console.log('  User:  user@example.com / user123');
  console.log('');
  console.log('Bearer Tokens:');
  console.log(`  Admin: ${adminToken}`);
  console.log(`  User:  ${userToken}`);
  console.log('');
  console.log('Created: 2 users, 3 posts, 3 comments');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
