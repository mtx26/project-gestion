export type ID = number;

export type Profile = {
  picture_url: string;
  default_hourly_rate: string | null;
};

export type User = {
  id: ID;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  profile?: Profile | null;
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  username?: string;
};

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type LoginResponse = AuthTokens & {
  user: User;
};

export type Permission = {
  id: ID;
  name: string;
  description: string | null;
  code: string;
};

export type Role = {
  id: ID;
  project: ID;
  name: string;
  description: string | null;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type Project = {
  id: ID;
  owner: ID;
  owner_display_name: string;
  current_user_permission_codes: string[];
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type ProjectPayload = {
  name: string;
  description?: string | null;
};

export type Folder = {
  id: ID;
  project: ID;
  parent_folder: ID | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_root: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type File = {
  id: ID;
  project: ID;
  folder: ID | null;
  name: string;
  description: string | null;
  file_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ApiFieldErrors = Record<string, string[] | string>;
