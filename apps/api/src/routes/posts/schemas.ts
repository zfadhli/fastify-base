import Type from 'typebox';

export const PostParams = Type.Object({ id: Type.String() });

export const CreatePostBody = Type.Object({
  title: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
  published: Type.Optional(Type.Boolean()),
});

export const UpdatePostBody = Type.Partial(CreatePostBody);

export const PostResponse = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  content: Type.String(),
  published: Type.Boolean(),
  authorId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const PostListItem = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  published: Type.Boolean(),
  authorId: Type.String(),
  createdAt: Type.String(),
});
