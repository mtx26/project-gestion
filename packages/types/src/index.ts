export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Profile = User;

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
}
