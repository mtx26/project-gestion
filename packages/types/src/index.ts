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

export type UserUpdatePayload = {
  username?: string;
  first_name?: string;
  last_name?: string;
  profile?: {
    default_hourly_rate?: string;
  };
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

export type ProjectMember = {
  id: ID;
  project: ID;
  user: ID;
  user_display_name: string;
  user_email: string;
  role: ID;
  role_name: string | null;
  role_deleted: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type Invitation = {
  id: ID;
  project: ID;
  email: string;
  role: ID;
  invited_by: ID;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  status: string;
  user_exists: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type InvitationAcceptResponse = {
  invitation: Invitation;
  member: ProjectMember;
};

export type Notification = {
  id: ID;
  user: ID;
  project: ID | null;
  created_by: ID;
  title: string;
  message: string;
  type: string;
  data: Record<string, unknown>;
  is_read: boolean;
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

export type RolePayload = {
  name: string;
  description?: string | null;
  permission_ids?: ID[];
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

export type FolderPayload = {
  parent_folder?: ID | null;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
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

export type DocumentUploadPayload = {
  file: globalThis.File | Blob;
  folder?: ID | null;
  name?: string;
  description?: string | null;
};

export type FolderTreeNode = {
  type: "folder" | "document" | "task";
  id: ID;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  folder?: ID | null;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "normal" | "high";
  due_date?: string | null;
  file_name?: string;
  file_size?: number | null;
  mime_type?: string | null;
  children?: FolderTreeNode[];
};

export type Task = {
  id: ID;
  project: ID;
  folder: ID | null;
  created_by: ID;
  assigned_to: ID[];
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "normal" | "high";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type TaskPayload = {
  folder?: ID | null;
  assigned_to?: ID[];
  title: string;
  description?: string | null;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "normal" | "high";
  due_date?: string | null;
};

export type TimeEntry = {
  id: ID;
  project: ID;
  folder: ID | null;
  task: ID | null;
  user: ID;
  duration_minutes: number;
  hourly_rate: string;
  cost_amount: string;
  paid_amount: string;
  remaining_amount: string;
  is_paid: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type TimeEntryPayload = {
  folder?: ID | null;
  task?: ID | null;
  user: ID;
  duration_minutes: number;
  hourly_rate?: string;
  description?: string | null;
};

export type TimeEntryPaymentPayload = {
  amount?: string;
  pay_full?: boolean;
  description?: string | null;
};

export type TimeEntryPayment = {
  financial_entry: FinancialEntry;
  time_entry: TimeEntry;
};

export type FinancialEntry = {
  id: ID;
  project: ID;
  folder: ID | null;
  document: ID | null;
  time_entry: ID | null;
  created_by: ID;
  amount: string;
  type: "expense" | "refund";
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: ID | null;
};

export type FinancialEntryPayload = {
  amount: string;
  type: "expense" | "refund";
  category?: string | null;
  description?: string | null;
  folder?: ID | null;
};

export type FinancialEntryChartTotals = {
  count: number;
  expenses: string;
  refunds: string;
  balance: string;
};

export type FinancialEntryChartSeriesPoint = FinancialEntryChartTotals & {
  period: string;
};

export type FinancialEntryChartCategory = FinancialEntryChartTotals & {
  category: string | null;
};

export type FinancialEntryChart = {
  group_by: "day" | "month";
  start_date: string | null;
  end_date: string | null;
  totals: FinancialEntryChartTotals;
  series: FinancialEntryChartSeriesPoint[];
  categories: FinancialEntryChartCategory[];
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ApiFieldErrors = Record<string, string[] | string>;
