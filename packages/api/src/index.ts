import type {
  ApiFieldErrors,
  AuthTokens,
  ExpenseRequest,
  ExpenseRequestPayload,
  FinancialEntryChart,
  FinancialEntry,
  FinancialEntryPayload,
  FolderTreeNode,
  Invitation,
  InvitationAcceptResponse,
  LoginPayload,
  LoginResponse,
  Notification,
  PaginatedResponse,
  Permission,
  Project,
  ProjectMember,
  ProjectPayload,
  RegisterPayload,
  Role,
  RolePayload,
  Task,
  TaskPayload,
  TimeEntry,
  TimeEntryPayment,
  TimeEntryPaymentPayload,
  TimeEntryPayload,
  User,
  UserUpdatePayload,
  Folder,
  FolderPayload,
  File,
  DocumentUploadPayload,
} from "@project-gestion/types";

export type TokenStore = {
  getAccessToken: () => string | null | Promise<string | null>;
  getRefreshToken: () => string | null | Promise<string | null>;
  setTokens: (tokens: AuthTokens) => void | Promise<void>;
  clearTokens: () => void | Promise<void>;
};

export type ApiClientOptions = {
  baseUrl: string;
  tokenStore?: TokenStore;
  onSessionInvalid?: () => void;
};

export function normalizeApiList<T>(data: T[] | PaginatedResponse<T> | undefined) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : data.results;
}

export function summarizeFinancialEntries(entries: Pick<FinancialEntry, "amount" | "type">[]) {
  const expenses = sumFinancialEntries(entries, "expense");
  const refunds = sumFinancialEntries(entries, "refund");

  return {
    count: entries.length,
    expenses,
    refunds,
    balance: expenses - refunds,
  };
}

export function sumFinancialEntries(
  entries: Pick<FinancialEntry, "amount" | "type">[],
  type: FinancialEntry["type"],
) {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + Number(entry.amount), 0);
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  fieldErrors: ApiFieldErrors;

  constructor(status: number, data: unknown) {
    super(getErrorMessage(status, data));
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.fieldErrors = isRecord(data) ? (data as ApiFieldErrors) : {};
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

export function createApiClient({
  baseUrl,
  tokenStore,
  onSessionInvalid,
}: ApiClientOptions) {
  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const shouldRetry = options.retryOnUnauthorized !== false;
    return execute<T>(path, options, shouldRetry);
  };

  const execute = async <T>(
    path: string,
    options: RequestOptions,
    canRetry: boolean,
  ): Promise<T> => {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...options,
      headers: await buildHeaders(options, tokenStore),
      body: serializeBody(options.body),
    });

    if (response.status === 401 && tokenStore && canRetry) {
      const refreshed = await refreshAccessToken(baseUrl, tokenStore);
      if (refreshed) {
        return execute<T>(path, options, false);
      }

      await tokenStore.clearTokens();
      onSessionInvalid?.();
    }

    if (!response.ok) {
      throw new ApiError(response.status, await readJson(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await readJson(response)) as T;
  };

  return {
    request,
    auth: {
      register: (payload: RegisterPayload) =>
        request<{ detail: string; email: string; email_verified: boolean }>(
          "/api/accounts/register/",
          { method: "POST", body: payload, skipAuth: true },
        ),
      login: (payload: LoginPayload) =>
        request<LoginResponse>("/api/accounts/login/", {
          method: "POST",
          body: payload,
          skipAuth: true,
        }),
      me: () => request<User>("/api/accounts/me/"),
      updateMe: (payload: UserUpdatePayload) =>
        request<User>("/api/accounts/me/", {
          method: "PATCH",
          body: payload,
        }),
      uploadProfilePicture: (file: globalThis.File | Blob) => {
        const formData = new FormData();
        formData.set("file", file);

        return request<User>("/api/accounts/me/picture/", {
          method: "POST",
          body: formData,
        });
      },
      refresh: (refresh: string) =>
        request<{ access: string }>("/api/accounts/refresh/", {
          method: "POST",
          body: { refresh },
          skipAuth: true,
          retryOnUnauthorized: false,
        }),
      logout: (refresh: string) =>
        request<void>("/api/accounts/logout/", {
          method: "POST",
          body: { refresh },
          skipAuth: true,
          retryOnUnauthorized: false,
        }),
      verifyEmail: (key: string) =>
        request<{ detail: string }>("/api/accounts/email/verify/", {
          method: "POST",
          body: { key },
          skipAuth: true,
        }),
      resendVerification: (email: string) =>
        request<{ detail: string }>("/api/accounts/email/resend/", {
          method: "POST",
          body: { email },
          skipAuth: true,
        }),
      resetPassword: (email: string) =>
        request<{ detail: string }>("/api/accounts/password/reset/", {
          method: "POST",
          body: { email },
          skipAuth: true,
        }),
      resetPasswordConfirm: (payload: { uid: string; token: string; new_password: string }) =>
        request<{ detail: string }>("/api/accounts/password/reset/confirm/", {
          method: "POST",
          body: payload,
          skipAuth: true,
        }),
      changePassword: (payload: { old_password: string; new_password: string }) =>
        request<{ detail: string }>("/api/accounts/password/change/", {
          method: "POST",
          body: payload,
        }),
    },
    projects: {
      list: () => request<Project[] | PaginatedResponse<Project>>("/api/projects/"),
      create: (payload: ProjectPayload) =>
        request<Project>("/api/projects/", { method: "POST", body: payload }),
      detail: (id: number) => request<Project>(`/api/projects/${id}/`),
      update: (id: number, payload: Partial<ProjectPayload>) =>
        request<Project>(`/api/projects/${id}/`, { method: "PATCH", body: payload }),
      remove: (id: number) =>
        request<void>(`/api/projects/${id}/`, { method: "DELETE" }),
      trash: () => request<Project[] | PaginatedResponse<Project>>("/api/projects/trash/"),
      restore: (id: number) =>
        request<Project>(`/api/projects/${id}/restore/`, { method: "POST" }),
    },
    members: {
      list: (projectId: number) =>
        request<ProjectMember[] | PaginatedResponse<ProjectMember>>(
          `/api/projects/${projectId}/members/`,
        ),
      update: (projectId: number, memberId: number, payload: { role: number }) =>
        request<ProjectMember>(`/api/projects/${projectId}/members/${memberId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, memberId: number) =>
        request<void>(`/api/projects/${projectId}/members/${memberId}/`, {
          method: "DELETE",
        }),
    },
    roles: {
      list: (projectId: number) =>
        request<Role[] | PaginatedResponse<Role>>(`/api/projects/${projectId}/roles/`),
      create: (projectId: number, payload: RolePayload) =>
        request<Role>(`/api/projects/${projectId}/roles/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, roleId: number, payload: RolePayload) =>
        request<Role>(`/api/projects/${projectId}/roles/${roleId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, roleId: number) =>
        request<void>(`/api/projects/${projectId}/roles/${roleId}/`, {
          method: "DELETE",
        }),
    },
    permissions: {
      list: () => request<Permission[] | PaginatedResponse<Permission>>("/api/permissions/"),
    },
    invitations: {
      list: (projectId: number) =>
        request<Invitation[] | PaginatedResponse<Invitation>>(
          `/api/projects/${projectId}/invitations/`,
        ),
      create: (projectId: number, payload: { email: string; role: number }) =>
        request<Invitation>(`/api/projects/${projectId}/invitations/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, invitationId: number, payload: { role: number }) =>
        request<Invitation>(`/api/projects/${projectId}/invitations/${invitationId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, invitationId: number) =>
        request<void>(`/api/projects/${projectId}/invitations/${invitationId}/`, {
          method: "DELETE",
        }),
      accept: (token: string) =>
        request<InvitationAcceptResponse>("/api/invitations/accept/", {
          method: "POST",
          body: { token },
        }),
    },
    notifications: {
      list: (query: { unread?: boolean } = {}) =>
        request<Notification[] | PaginatedResponse<Notification>>(
          `/api/notifications/${buildQueryString({
            unread: query.unread ? "true" : undefined,
          })}`,
        ),
      unreadCount: () => request<{ count: number }>("/api/notifications/unread-count/"),
      markRead: (id: number) =>
        request<Notification>(`/api/notifications/${id}/mark-read/`, {
          method: "POST",
        }),
      markAllRead: () =>
        request<void>("/api/notifications/mark-all-read/", {
          method: "POST",
        }),
    },
    financialEntries: {
      list: (
        projectId: number,
        query: { type?: string; folder?: number; created_by?: number } = {},
      ) =>
        request<FinancialEntry[] | PaginatedResponse<FinancialEntry>>(
          `/api/projects/${projectId}/financial-entries/${buildQueryString({
            type: query.type,
            folder: query.folder != null ? String(query.folder) : undefined,
            created_by: query.created_by != null ? String(query.created_by) : undefined,
          })}`,
        ),
      chart: (
        projectId: number,
        query: { group_by?: "day" | "month"; start_date?: string; end_date?: string } = {},
      ) =>
        request<FinancialEntryChart>(
          `/api/projects/${projectId}/financial-entries/chart/${buildQueryString(query)}`,
        ),
      create: (projectId: number, payload: FinancialEntryPayload) =>
        request<FinancialEntry>(`/api/projects/${projectId}/financial-entries/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, entryId: number, payload: Partial<FinancialEntryPayload>) =>
        request<FinancialEntry>(`/api/projects/${projectId}/financial-entries/${entryId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, entryId: number) =>
        request<void>(`/api/projects/${projectId}/financial-entries/${entryId}/`, {
          method: "DELETE",
        }),
      trash: (projectId: number) =>
        request<FinancialEntry[] | PaginatedResponse<FinancialEntry>>(
          `/api/projects/${projectId}/financial-entries/trash/`,
        ),
      restore: (projectId: number, entryId: number) =>
        request<FinancialEntry>(
          `/api/projects/${projectId}/financial-entries/${entryId}/restore/`,
          { method: "POST" },
        ),
    },
    timeEntries: {
      list: (
        projectId: number,
        query: { user?: number; start_date?: string; end_date?: string; include_unpaid?: boolean } = {},
      ) =>
        request<TimeEntry[] | PaginatedResponse<TimeEntry>>(
          `/api/projects/${projectId}/time-entries/${buildQueryString({
            user: query.user ? String(query.user) : undefined,
            start_date: query.start_date,
            end_date: query.end_date,
            include_unpaid: query.include_unpaid ? "true" : undefined,
          })}`,
        ),
      create: (projectId: number, payload: TimeEntryPayload) =>
        request<TimeEntry>(`/api/projects/${projectId}/time-entries/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, timeEntryId: number, payload: Partial<TimeEntryPayload>) =>
        request<TimeEntry>(`/api/projects/${projectId}/time-entries/${timeEntryId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, timeEntryId: number) =>
        request<void>(`/api/projects/${projectId}/time-entries/${timeEntryId}/`, {
          method: "DELETE",
        }),
      pay: (projectId: number, timeEntryId: number, payload: TimeEntryPaymentPayload) =>
        request<TimeEntryPayment>(`/api/projects/${projectId}/time-entries/${timeEntryId}/pay/`, {
          method: "POST",
          body: payload,
        }),
      trash: (projectId: number) =>
        request<TimeEntry[] | PaginatedResponse<TimeEntry>>(`/api/projects/${projectId}/time-entries/trash/`),
      restore: (projectId: number, timeEntryId: number) =>
        request<TimeEntry>(`/api/projects/${projectId}/time-entries/${timeEntryId}/restore/`, { method: "POST" }),
    },
    tasks: {
      list: (
        projectId: number,
        query: { folder?: number; status?: Task["status"]; priority?: Task["priority"]; created_by?: number } = {},
      ) =>
        request<Task[] | PaginatedResponse<Task>>(
          `/api/projects/${projectId}/tasks/${buildQueryString({
            folder: query.folder ? String(query.folder) : undefined,
            status: query.status,
            priority: query.priority,
            created_by: query.created_by != null ? String(query.created_by) : undefined,
          })}`,
        ),
      create: (projectId: number, payload: TaskPayload) =>
        request<Task>(`/api/projects/${projectId}/tasks/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, taskId: number, payload: Partial<TaskPayload>) =>
        request<Task>(`/api/projects/${projectId}/tasks/${taskId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, taskId: number) =>
        request<void>(`/api/projects/${projectId}/tasks/${taskId}/`, {
          method: "DELETE",
        }),
      trash: (projectId: number) =>
        request<Task[] | PaginatedResponse<Task>>(`/api/projects/${projectId}/tasks/trash/`),
      restore: (projectId: number, taskId: number) =>
        request<Task>(`/api/projects/${projectId}/tasks/${taskId}/restore/`, { method: "POST" }),
    },
    folders: {
      tree: (projectId: number, query: { includeTasks?: boolean } = {}) =>
        request<FolderTreeNode[]>(`/api/projects/${projectId}/folders/tree/${buildQueryString({
          include_tasks: query.includeTasks ? "true" : undefined,
        })}`),
      targetTree: (projectId: number) =>
        request<FolderTreeNode[]>(`/api/projects/${projectId}/folders/target-tree/`),
      create: (projectId: number, payload: FolderPayload) =>
        request<Folder>(`/api/projects/${projectId}/folders/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, folderId: number, payload: Partial<FolderPayload>) =>
        request<Folder>(`/api/projects/${projectId}/folders/${folderId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, folderId: number) =>
        request<void>(`/api/projects/${projectId}/folders/${folderId}/`, {
          method: "DELETE",
        }),
      trash: (projectId: number) =>
        request<Folder[] | PaginatedResponse<Folder>>(`/api/projects/${projectId}/folders/trash/`),
      restore: (projectId: number, folderId: number) =>
        request<Folder>(`/api/projects/${projectId}/folders/${folderId}/restore/`, { method: "POST" }),
    },
    documents: {
      download: (projectId: number, documentId: number) =>
        request<{ url: string; file_name: string; mime_type: string | null }>(
          `/api/projects/${projectId}/documents/${documentId}/download/`,
        ),
      update: (
        projectId: number,
        documentId: number,
        payload: Partial<{ folder: number | null; name: string; description: string | null }>,
      ) =>
        request<File>(`/api/projects/${projectId}/documents/${documentId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, documentId: number) =>
        request<void>(`/api/projects/${projectId}/documents/${documentId}/`, {
          method: "DELETE",
        }),
      upload: (projectId: number, payload: DocumentUploadPayload) => {
        const formData = new FormData();
        formData.set("file", payload.file);
        appendFormDataValue(formData, "folder", payload.folder);
        appendFormDataValue(formData, "name", payload.name);
        appendFormDataValue(formData, "description", payload.description);

        return request<File>(`/api/projects/${projectId}/documents/`, {
          method: "POST",
          body: formData,
        });
      },
      trash: (projectId: number) =>
        request<File[] | PaginatedResponse<File>>(`/api/projects/${projectId}/documents/trash/`),
      restore: (projectId: number, id: number) =>
        request<File>(`/api/projects/${projectId}/documents/${id}/restore/`, { method: "POST" }),
    },
    expenseRequests: {
      list: (
        projectId: number,
        query: { status?: string; folder?: number; requested_by?: number } = {},
      ) =>
        request<ExpenseRequest[] | PaginatedResponse<ExpenseRequest>>(
          `/api/projects/${projectId}/expense-requests/${buildQueryString({
            status: query.status,
            folder: query.folder != null ? String(query.folder) : undefined,
            requested_by: query.requested_by != null ? String(query.requested_by) : undefined,
          })}`,
        ),
      create: (projectId: number, payload: ExpenseRequestPayload) =>
        request<ExpenseRequest>(`/api/projects/${projectId}/expense-requests/`, {
          method: "POST",
          body: payload,
        }),
      update: (projectId: number, id: number, payload: Partial<ExpenseRequestPayload>) =>
        request<ExpenseRequest>(`/api/projects/${projectId}/expense-requests/${id}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, id: number) =>
        request<void>(`/api/projects/${projectId}/expense-requests/${id}/`, {
          method: "DELETE",
        }),
      approve: (projectId: number, id: number) =>
        request<ExpenseRequest>(
          `/api/projects/${projectId}/expense-requests/${id}/approve/`,
          { method: "POST" },
        ),
      reject: (projectId: number, id: number) =>
        request<ExpenseRequest>(
          `/api/projects/${projectId}/expense-requests/${id}/reject/`,
          { method: "POST" },
        ),
    },
  };
}

async function buildHeaders(options: RequestOptions, tokenStore?: TokenStore) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body != null && !isFormData(options.body)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const access = options.skipAuth ? null : await tokenStore?.getAccessToken();
  if (access) {
    headers.set("Authorization", `Bearer ${access}`);
  }

  return headers;
}

function serializeBody(body: unknown) {
  if (body == null) {
    return undefined;
  }

  return isFormData(body) ? body : JSON.stringify(body);
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function appendFormDataValue(formData: FormData, key: string, value: string | number | null | undefined) {
  if (value != null && value !== "") {
    formData.set(key, String(value));
  }
}

async function refreshAccessToken(baseUrl: string, tokenStore: TokenStore) {
  const refresh = await tokenStore.getRefreshToken();
  if (!refresh) {
    return false;
  }

  const response = await fetch(buildUrl(baseUrl, "/api/accounts/refresh/"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { access?: string; refresh?: string };
  if (!data.access) {
    return false;
  }

  await tokenStore.setTokens({ access: data.access, refresh: data.refresh ?? refresh });
  return true;
}

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function buildQueryString(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(status: number, data: unknown) {
  if (isRecord(data) && typeof data.detail === "string") {
    return data.detail;
  }
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  if (status === 429) {
    return "Trop de tentatives. Reessaie plus tard.";
  }
  if (status === 401) {
    return "Session expiree. Connecte-toi a nouveau.";
  }
  if (status === 403) {
    return "Action non autorisee.";
  }
  if (status === 404) {
    return "Ressource introuvable.";
  }
  if (status >= 500) {
    return `Erreur serveur (${status}).`;
  }
  if (status >= 400) {
    return `Erreur API (${status}).`;
  }
  return "Une erreur est survenue.";
}
