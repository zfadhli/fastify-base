import { resource } from '@fastify-base/controller';
import { comment, post } from '@/db/schema';
import {
  CommentListItem,
  CommentParams,
  CommentResponse,
  CreateCommentBody,
  PostIdParams,
  UpdateCommentBody,
} from './schemas';

export default resource({
  model: comment,
  resource: 'Comment',
  idParam: 'commentId',
  schema: {
    params: CommentParams,
    listParams: PostIdParams,
    body: CreateCommentBody,
    updateBody: UpdateCommentBody,
    response: CommentResponse,
    listItem: CommentListItem,
  },
  auth: ['store', 'update', 'destroy'],
  ownership: { field: 'authorId' },
  parentScope: { paramField: 'postId', column: 'postId', parentModel: post, parentResource: 'Post' },
  sortable: ['createdAt'],
});
