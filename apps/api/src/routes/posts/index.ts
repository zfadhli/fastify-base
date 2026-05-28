import { resource } from '@fastify-base/controller';
import { commentRelations, post, postRelations, userRelations } from '@/db/schema';
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
  relations: [postRelations, commentRelations, userRelations],
  includeSchemas: { author: UserResponse, comments: CommentListItem },
  lifecycle: {
    beforeCreate: (values) => {
      if (values.title) values.slug = slugify(values.title);
    },
    beforeUpdate: (updateData) => {
      if (updateData.title) updateData.slug = slugify(updateData.title);
    },
  },
});
