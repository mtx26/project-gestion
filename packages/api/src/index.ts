import type {
  ApiFieldErrors,
  AuthTokens,
  CalendarData,
  CalendarSubscription,
  CalendarSubscriptionPayload,
  DayEntryPayload,
  DayEntryResult,
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
  TimeEntryPaymentCorrectionPayload,
  TimeEntryPaymentPayload,
  TimeEntryPayload,
  TimeEntryStats,
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

export function getApiCount<T>(data: T[] | PaginatedResponse<T> | undefined): number {
  if (!data) return 0;
  if (Array.isArray(data)) return data.length;
  return data.count;
}

export function getApiPageSize<T>(data: T[] | PaginatedResponse<T> | undefined): number {
  if (!data || Array.isArray(data)) return 50;
  return (data as PaginatedResponse<T>).page_size ?? 50;
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

export function isEmailVerificationRequired(error: unknown) {
  return (
    error instanceof ApiError &&
    Array.isArray(error.fieldErrors.email) &&
    error.fieldErrors.email.includes("errors.email_verification.required")
  );
}

const PASSWORD_VALIDATOR_ATTRIBUTE_LABELS: Record<string, string> = {
  email: "l'email",
  username: "le nom d'utilisateur",
  "first name": "le prenom",
  "last name": "le nom",
};

/** Django's `validate_password()` (accounts/serializers.py) raises its own English
 * sentences rather than this app's usual `errors.xxx` codes — matched here by
 * pattern since two of them interpolate a count/attribute name. */
const PASSWORD_VALIDATOR_MESSAGES: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /^This password is too short\. It must contain at least (\d+) characters?\.$/,
    (m) => `Le mot de passe doit contenir au moins ${m[1]} caracteres.`,
  ],
  [
    /^The password is too similar to the (.+)\.$/,
    (m) => `Le mot de passe est trop proche de ${PASSWORD_VALIDATOR_ATTRIBUTE_LABELS[m[1]] ?? m[1]}.`,
  ],
  [/^This password is too common\.$/, () => "Ce mot de passe est trop courant."],
  [/^This password is entirely numeric\.$/, () => "Le mot de passe ne peut pas etre uniquement numerique."],
];

/** Translates a backend `errors.xxx` code (or a handful of Django password-validator
 * sentences) into a French user-facing message. Shared by web and mobile so a new
 * backend error code only needs a translation added in one place. */
export function translateError(code: string) {
  const messages: Record<string, string> = {
    "errors.email_verification.required": "Ton email n'est pas encore verifie.",
    "errors.auth.identifier_required": "Email ou nom d'utilisateur requis.",
    "errors.token.invalid": "Session invalide.",
    "errors.email_verification.invalid_key": "Lien de verification invalide ou expire.",
    "errors.user.email_already_exists": "Un compte existe deja avec cet email.",
    "errors.user.username_already_exists": "Ce nom d'utilisateur est deja utilise.",
    "errors.password.invalid_current_password": "Mot de passe actuel incorrect.",
    "errors.password_reset.invalid_token": "Lien de reinitialisation invalide ou expire.",

    "errors.task.start_date_after_end_date": "La date de debut ne peut pas depasser la date de fin.",
    "errors.task.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.task.assigned_user_not_project_member": "Cet utilisateur ne fait pas partie du projet.",

    "errors.invitation.invalid_token": "Lien d'invitation invalide.",
    "errors.invitation.already_accepted": "Cette invitation a deja ete acceptee.",
    "errors.invitation.expired": "Cette invitation a expire.",
    "errors.invitation.email_mismatch": "Cette invitation ne correspond pas a ton compte.",
    "errors.invitation.role_project_mismatch": "Ce role n'appartient pas a ce projet.",

    "errors.project_member.role_project_mismatch": "Ce role n'appartient pas a ce projet.",

    "errors.folder.parent_is_self": "Un dossier ne peut pas etre son propre parent.",
    "errors.folder.parent_project_mismatch": "Le dossier parent n'appartient pas a ce projet.",
    "errors.folder.circular_parent": "Ce dossier ne peut pas etre deplace dans l'un de ses sous-dossiers.",

    "errors.document.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.document.file_required": "Un fichier est requis.",
    "errors.document.folder_not_found": "Dossier introuvable.",
    "errors.document.file_too_large": "Le fichier depasse la taille maximale autorisee.",
    "errors.document.file_type_not_allowed": "Ce type de fichier n'est pas autorise.",

    "errors.profile_picture.file_too_large": "L'image depasse la taille maximale autorisee (5 Mo).",
    "errors.profile_picture.file_type_not_allowed": "Ce type d'image n'est pas autorise.",

    "errors.time_entry.multiple_targets": "Choisis soit un dossier, soit une tache, pas les deux.",
    "errors.time_entry.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.time_entry.task_project_mismatch": "Cette tache n'appartient pas a ce projet.",
    "errors.time_entry.user_not_project_member": "Cet utilisateur ne fait pas partie du projet.",

    "errors.time_entry_payment.already_paid": "Cette entree est deja entierement payee.",
    "errors.time_entry_payment.amount_required": "Le montant est requis.",
    "errors.time_entry_payment.amount_must_be_positive": "Le montant doit etre superieur a 0.",
    "errors.time_entry_payment.amount_exceeds_remaining": "Le montant ne peut pas depasser le reste a payer.",
    "errors.time_entry_payment.amount_unchanged": "Le montant est identique au montant deja paye.",

    "errors.financial_entry.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.financial_entry.time_entry_project_mismatch": "Cette entree de temps n'appartient pas a ce projet.",
    "errors.financial_entry.task_project_mismatch": "Cette tache n'appartient pas a ce projet.",
    "errors.financial_entry.multiple_targets": "Choisis soit un dossier, soit une tache, pas les deux.",
    "errors.financial_entry.amount_must_be_positive": "Le montant doit etre superieur a 0.",
    "errors.financial_entry.amount_exceeds_time_entry_remaining": "Le montant ne peut pas depasser le reste a payer.",
    "errors.financial_entry.refund_exceeds_time_entry_paid_amount": "Le remboursement ne peut pas depasser le montant deja paye.",

    "errors.expense_request.folder_project_mismatch": "Ce dossier n'appartient pas a ce projet.",
    "errors.expense_request.multiple_targets": "Choisis soit un dossier, soit une tache, pas les deux.",
    "errors.expense_request.task_project_mismatch": "Cette tache n'appartient pas a ce projet.",
    "errors.expense_request.amount_must_be_positive": "Le montant doit etre superieur a 0.",

    "errors.financial_chart.end_date_before_start_date": "La date de fin ne peut pas preceder la date de debut.",

    "errors.calendar.end_date_before_start_date": "La date de fin ne peut pas preceder la date de debut.",
    "errors.calendar_subscription.at_least_one_required": "Coche au moins taches ou temps.",
  };

  if (messages[code]) return messages[code];

  for (const [pattern, translate] of PASSWORD_VALIDATOR_MESSAGES) {
    const match = code.match(pattern);
    if (match) return translate(match);
  }

  return code;
}

/** Reads a single field's error out of an ApiError's `fieldErrors`, translated to French. */
export function getFieldError(error: unknown, field: string) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const value = error.fieldErrors[field];
  if (Array.isArray(value)) {
    return translateError(value[0]);
  }
  if (typeof value === "string") {
    return translateError(value);
  }
  return null;
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
      update: (projectId: number, memberId: number, payload: { role?: number; hourly_rate?: string }) =>
        request<ProjectMember>(`/api/projects/${projectId}/members/${memberId}/`, {
          method: "PATCH",
          body: payload,
        }),
      remove: (projectId: number, memberId: number) =>
        request<void>(`/api/projects/${projectId}/members/${memberId}/`, {
          method: "DELETE",
        }),
      updateOwnerRate: (projectId: number, hourly_rate: string) =>
        request<{ hourly_rate: string }>(`/api/projects/${projectId}/owner-rate/`, {
          method: "PATCH",
          body: { hourly_rate },
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
      list: (query: { unread?: boolean; page?: number } = {}) =>
        request<Notification[] | PaginatedResponse<Notification>>(
          `/api/notifications/${buildQueryString({
            unread: query.unread ? "true" : undefined,
            page: query.page && query.page > 1 ? String(query.page) : undefined,
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
        query: { type?: string; source?: "manual" | "labor"; folder?: number; created_by?: number; ordering?: string; page?: number; search?: string; date_from?: string; date_to?: string } = {},
      ) =>
        request<FinancialEntry[] | PaginatedResponse<FinancialEntry>>(
          `/api/projects/${projectId}/financial-entries/${buildQueryString({
            type: query.type,
            source: query.source,
            folder: query.folder != null ? String(query.folder) : undefined,
            created_by: query.created_by != null ? String(query.created_by) : undefined,
            ordering: query.ordering || undefined,
            page: query.page && query.page > 1 ? String(query.page) : undefined,
            search: query.search || undefined,
            date_from: query.date_from || undefined,
            date_to: query.date_to || undefined,
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
      trash: (projectId: number, query: { page?: number } = {}) =>
        request<FinancialEntry[] | PaginatedResponse<FinancialEntry>>(
          `/api/projects/${projectId}/financial-entries/trash/${buildQueryString({
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
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
        query: {
          user?: number;
          start_date?: string;
          end_date?: string;
          include_paid?: boolean;
          payment_status?: string;
          target?: string;
          search?: string;
          page?: number;
        } = {},
      ) =>
        request<TimeEntry[] | PaginatedResponse<TimeEntry>>(
          `/api/projects/${projectId}/time-entries/${buildQueryString({
            user: query.user ? String(query.user) : undefined,
            start_date: query.start_date,
            end_date: query.end_date,
            include_paid: query.include_paid ? "true" : undefined,
            payment_status: query.payment_status && query.payment_status !== "all" ? query.payment_status : undefined,
            target: query.target && query.target !== "project" ? query.target : undefined,
            search: query.search || undefined,
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
        ),
      stats: (
        projectId: number,
        query: {
          user?: number;
          start_date?: string;
          end_date?: string;
          include_paid?: boolean;
          payment_status?: string;
          target?: string;
        } = {},
      ) =>
        request<TimeEntryStats>(
          `/api/projects/${projectId}/time-entries/stats/${buildQueryString({
            user: query.user ? String(query.user) : undefined,
            start_date: query.start_date,
            end_date: query.end_date,
            include_paid: query.include_paid ? "true" : undefined,
            payment_status: query.payment_status && query.payment_status !== "all" ? query.payment_status : undefined,
            target: query.target && query.target !== "project" ? query.target : undefined,
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
      correctPayment: (projectId: number, timeEntryId: number, payload: TimeEntryPaymentCorrectionPayload) =>
        request<TimeEntryPayment>(`/api/projects/${projectId}/time-entries/${timeEntryId}/pay/`, {
          method: "PATCH",
          body: payload,
        }),
      get: (projectId: number, timeEntryId: number) =>
        request<TimeEntry>(`/api/projects/${projectId}/time-entries/${timeEntryId}/`),
      trash: (projectId: number, query: { page?: number } = {}) =>
        request<TimeEntry[] | PaginatedResponse<TimeEntry>>(
          `/api/projects/${projectId}/time-entries/trash/${buildQueryString({
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
        ),
      restore: (projectId: number, timeEntryId: number) =>
        request<TimeEntry>(`/api/projects/${projectId}/time-entries/${timeEntryId}/restore/`, { method: "POST" }),
    },
    calendar: {
      get: (
        projectId: number,
        query: { start_date: string; end_date: string; include_tasks?: boolean; include_time?: boolean },
      ) =>
        request<CalendarData>(
          `/api/projects/${projectId}/calendar/${buildQueryString({
            start_date: query.start_date,
            end_date: query.end_date,
            include_tasks: query.include_tasks === false ? "false" : undefined,
            include_time: query.include_time === false ? "false" : undefined,
          })}`,
        ),
      getSubscription: (projectId: number) =>
        request<CalendarSubscription>(`/api/projects/${projectId}/calendar/subscription/`),
      createSubscription: (projectId: number, payload: CalendarSubscriptionPayload) =>
        request<CalendarSubscription>(`/api/projects/${projectId}/calendar/subscription/`, {
          method: "POST",
          body: payload,
        }),
      deleteSubscription: (projectId: number) =>
        request<void>(`/api/projects/${projectId}/calendar/subscription/`, {
          method: "DELETE",
        }),
    },
    tasks: {
      list: (
        projectId: number,
        query: {
          folder?: number;
          status?: Task["status"];
          priority?: Task["priority"];
          created_by?: number;
          assigned_to?: number;
          exclude_done?: boolean;
          date_from?: string;
          date_to?: string;
          page?: number;
          ordering?: string;
          search?: string;
        } = {},
      ) =>
        request<Task[] | PaginatedResponse<Task>>(
          `/api/projects/${projectId}/tasks/${buildQueryString({
            folder: query.folder ? String(query.folder) : undefined,
            status: query.status,
            priority: query.priority,
            created_by: query.created_by != null ? String(query.created_by) : undefined,
            assigned_to: query.assigned_to != null ? String(query.assigned_to) : undefined,
            exclude_done: query.exclude_done ? "true" : undefined,
            date_from: query.date_from,
            date_to: query.date_to,
            page: query.page && query.page > 1 ? String(query.page) : undefined,
            ordering: query.ordering || undefined,
            search: query.search || undefined,
          })}`,
        ),
      get: (projectId: number, taskId: number) =>
        request<Task>(`/api/projects/${projectId}/tasks/${taskId}/`),
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
      trash: (projectId: number, query: { page?: number } = {}) =>
        request<Task[] | PaginatedResponse<Task>>(
          `/api/projects/${projectId}/tasks/trash/${buildQueryString({
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
        ),
      restore: (projectId: number, taskId: number) =>
        request<Task>(`/api/projects/${projectId}/tasks/${taskId}/restore/`, { method: "POST" }),
      createDayEntry: (projectId: number, payload: DayEntryPayload) =>
        request<DayEntryResult>(`/api/projects/${projectId}/day-entries/`, {
          method: "POST",
          body: payload,
        }),
    },
    folders: {
      tree: (projectId: number, query: { includeTasks?: boolean; includeFiles?: boolean } = {}) =>
        request<FolderTreeNode[]>(`/api/projects/${projectId}/folders/tree/${buildQueryString({
          include_tasks: query.includeTasks ? "true" : undefined,
          include_files: query.includeFiles === false ? "false" : undefined,
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
      trash: (projectId: number, query: { page?: number } = {}) =>
        request<Folder[] | PaginatedResponse<Folder>>(
          `/api/projects/${projectId}/folders/trash/${buildQueryString({
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
        ),
      restore: (projectId: number, folderId: number) =>
        request<Folder>(`/api/projects/${projectId}/folders/${folderId}/restore/`, { method: "POST" }),
    },
    documents: {
      download: (projectId: number, documentId: number) =>
        request<{ url: string; file_name: string; mime_type: string | null }>(
          `/api/projects/${projectId}/documents/${documentId}/download/`,
        ),
      downloadBatch: (projectId: number, documentIds: number[]) =>
        request<{ id: number; url: string; file_name: string; mime_type: string | null }[]>(
          `/api/projects/${projectId}/documents/download-urls/`,
          { method: "POST", body: { ids: documentIds } },
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
      trash: (projectId: number, query: { page?: number } = {}) =>
        request<File[] | PaginatedResponse<File>>(
          `/api/projects/${projectId}/documents/trash/${buildQueryString({
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
        ),
      restore: (projectId: number, id: number) =>
        request<File>(`/api/projects/${projectId}/documents/${id}/restore/`, { method: "POST" }),
    },
    expenseRequests: {
      list: (
        projectId: number,
        query: { status?: string; folder?: number; requested_by?: number; exclude_rejected?: boolean; ordering?: string; page?: number; search?: string; date_from?: string; date_to?: string } = {},
      ) =>
        request<ExpenseRequest[] | PaginatedResponse<ExpenseRequest>>(
          `/api/projects/${projectId}/expense-requests/${buildQueryString({
            status: query.status,
            folder: query.folder != null ? String(query.folder) : undefined,
            requested_by: query.requested_by != null ? String(query.requested_by) : undefined,
            exclude_rejected: query.exclude_rejected ? "true" : undefined,
            ordering: query.ordering || undefined,
            page: query.page && query.page > 1 ? String(query.page) : undefined,
            search: query.search || undefined,
            date_from: query.date_from || undefined,
            date_to: query.date_to || undefined,
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
      trash: (projectId: number, query: { page?: number } = {}) =>
        request<ExpenseRequest[] | PaginatedResponse<ExpenseRequest>>(
          `/api/projects/${projectId}/expense-requests/trash/${buildQueryString({
            page: query.page && query.page > 1 ? String(query.page) : undefined,
          })}`,
        ),
      restore: (projectId: number, id: number) =>
        request<ExpenseRequest>(
          `/api/projects/${projectId}/expense-requests/${id}/restore/`,
          { method: "POST" },
        ),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export * from "./query-builders";

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
