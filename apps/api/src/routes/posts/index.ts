import { eq } from 'drizzle-orm';
import { post, user } from '@/db/schema';
import { resource } from '@/lib/controller';
import { slugify } from './helpers';
import { CreatePostBody, PostListItem, PostParams, PostResponse, UpdatePostBody } from './schemas';

export default resource({
  model: post,
  resource: 'Post',
  schema: {
    params: PostParams,
    body: CreatePostBody,
    updateBody: UpdatePostBody,
    response: PostResponse,
    listItem: PostListItem,
  },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  visibility: { publishedField: 'published', ownerField: 'authorId' },
  filters: [
    { field: 'author.name', type: 'string', operators: ['eq', 'like'] },
    { field: 'published', type: 'boolean' },
    { field: 'authorId', type: 'string' },
  ],
  sortable: ['createdAt', 'title', 'published'],
  pagination: true,
  joins: [{ alias: 'author', table: user, on: eq(post.authorId, user.id) }],
  slug: { sourceField: 'title', transform: slugify },
});
