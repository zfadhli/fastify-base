import Type from 'typebox';

export const UserParams = Type.Object({ id: Type.String() });

export const UserResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  image: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});
