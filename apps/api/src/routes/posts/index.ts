import { eq } from 'drizzle-orm';
import { comment, post, user } from '@/db/schema';
import { resource } from '@/lib/controller';
import { CommentListItem } from '@/routes/posts/[postId]/comments/schemas';
import { UserResponse } from '@/routes/users/schemas';
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
  includeMap: {
    author: { type: 'single', table: user, schema: UserResponse, localKey: 'authorId', foreignKey: 'id' },
    comments: { type: 'many', table: comment, schema: CommentListItem, localKey: 'id', foreignKey: 'postId' },
  },
});
