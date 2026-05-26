import Type from 'typebox';

export const PostIdParams = Type.Object({ postId: Type.String() });

export const CommentParams = Type.Object({
  postId: Type.String(),
  commentId: Type.String(),
});

export const CreateCommentBody = Type.Object({
  content: Type.String({ minLength: 1 }),
});

export const UpdateCommentBody = Type.Partial(CreateCommentBody);

export const CommentResponse = Type.Object({
  id: Type.String(),
  postId: Type.String(),
  authorId: Type.String(),
  content: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CommentListItem = Type.Object({
  id: Type.String(),
  authorId: Type.String(),
  content: Type.String(),
  createdAt: Type.String(),
});
