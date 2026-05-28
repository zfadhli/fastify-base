import Type from 'typebox';

export const UserParams = Type.Object({ id: Type.String() });

export const PostIncludeSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  slug: Type.String(),
  content: Type.String(),
  published: Type.Boolean(),
  authorId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const UserResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  image: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  posts: Type.Optional(Type.Array(PostIncludeSchema)),
});
