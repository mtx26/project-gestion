import type {
  ApiFieldErrors,
  AuthTokens,
  LoginPayload,
  LoginResponse,
  PaginatedResponse,
  Project,
  ProjectPayload,
  RegisterPayload,
  User,
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
      body: options.body == null ? undefined : JSON.stringify(options.body),
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
    },
  };
}

async function buildHeaders(options: RequestOptions, tokenStore?: TokenStore) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body != null) {
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
  if (status === 429) {
    return "Trop de tentatives. Reessaie plus tard.";
  }
  if (status === 401) {
    return "Session expiree. Connecte-toi a nouveau.";
  }
  return "Une erreur est survenue.";
}
