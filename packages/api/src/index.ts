import type {
  ApiFieldErrors,
  AuthSessionResponse,
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

/** Client django-allauth headless. `browser` s'appuie sur le cookie de session
 * Django et la protection CSRF ; `app` transporte la meme session via l'en-tete
 * `X-Session-Token` (voir la documentation headless d'allauth). */
export type HeadlessClient = "browser" | "app";

/** Stockage du session token du client `app`. Inutile pour le client `browser`,
 * dont la session vit uniquement dans un cookie HttpOnly. */
export type SessionTokenStore = {
  getSessionToken: () => string | null | Promise<string | null>;
  setSessionToken: (token: string | null) => void | Promise<void>;
};

export type ApiClientOptions = {
  baseUrl: string;
  /** Defaut : `browser`. */
  client?: HeadlessClient;
  /** Requis pour le client `app`. */
  sessionTokenStore?: SessionTokenStore;
  /** Lecture du cookie CSRF, cote navigateur uniquement. */
  getCsrfToken?: () => string | null;
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
    this.fieldErrors = toFieldErrors(data);
  }
}

/** django-allauth headless renvoie ses erreurs sous la forme
 * `{ errors: [{ message, code, param }] }`, DRF sous la forme `{ champ: [code] }`.
 * Les deux sont ramenees au format DRF, seul connu des formulaires. Le `code`
 * d'allauth est privilegie sur le `message` : ce dernier est en anglais, alors que
 * le code est traduisible cote app comme les codes `errors.*` du backend. */
function toFieldErrors(data: unknown): ApiFieldErrors {
  if (!isRecord(data)) {
    return {};
  }

  const allauthErrors = data.errors;
  if (!Array.isArray(allauthErrors)) {
    return data as ApiFieldErrors;
  }

  const fieldErrors: ApiFieldErrors = {};
  for (const error of allauthErrors) {
    if (!isRecord(error)) continue;
    const value =
      typeof error.code === "string"
        ? error.code
        : typeof error.message === "string"
          ? error.message
          : null;
    if (value === null) continue;
    const field = typeof error.param === "string" ? error.param : "detail";
    const messages = (fieldErrors[field] ??= []) as string[];
    messages.push(value);
  }
  return fieldErrors;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Ne pas notifier `onSessionInvalid` sur un 401 attendu (probe de session). */
  ignoreUnauthorized?: boolean;
};

export function createApiClient({
  baseUrl,
  client = "browser",
  sessionTokenStore,
  getCsrfToken,
  onSessionInvalid,
}: ApiClientOptions) {
  const headlessUrl = (path: string) => `/_allauth/${client}/v1${path}`;

  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...options,
      // Le client `browser` s'authentifie par cookie de session : sans cela le
      // navigateur ne le joindrait pas a une requete cross-origin.
      credentials: client === "browser" ? "include" : options.credentials,
      headers: await buildHeaders(options),
      body: serializeBody(options.body),
    });

    // Le client `app` recoit son session token dans `meta`, y compris quand la
    // reponse est un 401 (etape d'authentification encore en cours).
    const payload = response.status === 204 ? null : await readJson(response);
    await storeSessionToken(payload);

    if (response.status === 401 && !options.ignoreUnauthorized) {
      await sessionTokenStore?.setSessionToken(null);
      onSessionInvalid?.();
    }

    if (!response.ok) {
      throw new ApiError(response.status, payload);
    }

    return payload as T;
  };

  const buildHeaders = async (options: RequestOptions) => {
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body != null && !isFormData(options.body)) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (client === "app") {
      const sessionToken = await sessionTokenStore?.getSessionToken();
      if (sessionToken) {
        headers.set("X-Session-Token", sessionToken);
      }
      return headers;
    }

    const method = (options.method ?? "GET").toUpperCase();
    if (!SAFE_METHODS.has(method)) {
      const csrfToken = getCsrfToken?.();
      if (csrfToken) {
        headers.set("X-CSRFToken", csrfToken);
      }
    }
    return headers;
  };

  const storeSessionToken = async (payload: unknown) => {
    if (client !== "app" || !sessionTokenStore || !isRecord(payload)) return;
    const meta = payload.meta;
    if (isRecord(meta) && typeof meta.session_token === "string") {
      await sessionTokenStore.setSessionToken(meta.session_token);
    }
  };

  return {
    request,
    auth: {
      /** POST /_allauth/<client>/v1/auth/signup. Avec verification d'email
       * obligatoire, allauth repond 401 : le compte est cree mais la session
       * reste bloquee sur l'etape `verify_email`. */
      register: ({ email, password, first_name, last_name }: RegisterPayload) =>
        readSession(
          request<AuthSessionResponse>(headlessUrl("/auth/signup"), {
            method: "POST",
            body: { email, password, first_name, last_name },
            ignoreUnauthorized: true,
          }),
        ),
      /** POST /_allauth/<client>/v1/auth/login. allauth attend exactement une
       * methode de connexion, l'identifiant saisi est donc route vers `email` ou
       * `username` selon sa forme. */
      login: ({ identifier, password }: LoginPayload) =>
        request<AuthSessionResponse>(headlessUrl("/auth/login"), {
          method: "POST",
          body: identifier.includes("@")
            ? { email: identifier, password }
            : { username: identifier, password },
          // Un 401 signale ici une etape restante (email non verifie), pas une
          // session expiree : la page de connexion doit pouvoir la lire.
          ignoreUnauthorized: true,
        }),
      /** GET /_allauth/<client>/v1/auth/session — 401 quand aucune session n'est ouverte. */
      session: () =>
        readSession(
          request<AuthSessionResponse>(headlessUrl("/auth/session"), {
            ignoreUnauthorized: true,
          }),
        ),
      /** DELETE /_allauth/<client>/v1/auth/session. allauth repond 401 une fois la
       * session fermee : c'est le resultat attendu, pas une erreur. */
      logout: () =>
        readSession(
          request<AuthSessionResponse>(headlessUrl("/auth/session"), {
            method: "DELETE",
            ignoreUnauthorized: true,
          }),
        ),
      /** POST /_allauth/<client>/v1/auth/email/verify. 401 = email confirme mais
       * session non ouverte (l'utilisateur doit encore se connecter). */
      verifyEmail: (key: string) =>
        readSession(
          request<AuthSessionResponse>(headlessUrl("/auth/email/verify"), {
            method: "POST",
            body: { key },
            ignoreUnauthorized: true,
          }),
        ),
      /** POST /_allauth/<client>/v1/auth/password/request */
      resetPassword: (email: string) =>
        request<AuthSessionResponse>(headlessUrl("/auth/password/request"), {
          method: "POST",
          body: { email },
        }),
      /** POST /_allauth/<client>/v1/auth/password/reset */
      resetPasswordConfirm: (payload: { key: string; password: string }) =>
        readSession(
          request<AuthSessionResponse>(headlessUrl("/auth/password/reset"), {
            method: "POST",
            body: payload,
            ignoreUnauthorized: true,
          }),
        ),
      /** POST /_allauth/<client>/v1/account/password/change */
      changePassword: (payload: { current_password: string; new_password: string }) =>
        request<AuthSessionResponse>(headlessUrl("/account/password/change"), {
          method: "POST",
          body: payload,
        }),
      /** URL de `POST /_allauth/browser/v1/auth/provider/redirect`. Ce flux est une
       * soumission de formulaire navigateur (redirection vers le provider), il ne
       * peut pas passer par `fetch`. */
      providerRedirectUrl: () => buildUrl(baseUrl, headlessUrl("/auth/provider/redirect")),
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

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/** Sur les endpoints de session, un 401 est une reponse metier ("pas connecte")
 * et non un echec : allauth y renvoie la meme enveloppe qu'en 200. */
async function readSession(pending: Promise<AuthSessionResponse>) {
  try {
    return await pending;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return error.data as AuthSessionResponse;
    }
    throw error;
  }
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
  if (isRecord(data) && Array.isArray(data.errors)) {
    const first = data.errors.find(
      (error) => isRecord(error) && typeof error.message === "string",
    );
    if (isRecord(first) && typeof first.message === "string") {
      return first.message;
    }
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
