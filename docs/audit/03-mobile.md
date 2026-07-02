# Mobile Expo — Inventaire technique

> Périmètre : `apps/mobile/src/**` (~17 fichiers, ~760 lignes). Voir [00-overview.md](00-overview.md).

---

## 1. Cartographie et maturité

État : **squelette auth-only**. Aucun des domaines métier riches du web (tâches, temps, finance, demandes, fichiers, paramètres, notifications) n'existe côté mobile.

| Dossier | Contenu | Rôle |
|---|---|---|
| `src/components/ui.tsx` | `Screen`, `Field`, `Button`, `Message` | Primitives RN génériques (équivalent conceptuel de shadcn, dupliqué légitimement — RN ne peut pas consommer de composants web) |
| `src/lib/{api,errors,query-client}.ts` | Câblage client API, traduction d'erreurs, config React Query | |
| `src/screens/` (7) | Login, Register, VerifyEmail, ResendVerification, ForgotPassword, ResetPassword, Dashboard | Auth complet + CRUD projet minimal |
| `src/stores/auth-store.ts` | `useAuthStore` (Zustand) | |
| `src/types/` | `navigation.ts`, `css.d.ts` | |

`DashboardScreen` : liste de projets (lecture) + formulaire de création inline + suppression **sans dialogue de confirmation** (contraste avec `ConfirmDeleteDialog` côté web).

---

## 2. Consommation des packages partagés

| Package | Import confirmé | Cohérent avec le web ? |
|---|---|---|
| `@project-gestion/api` | `createApiClient`, `TokenStore`, `ApiError` | Oui |
| `@project-gestion/config` | `API_BASE_URL`, `tokenStorageKeys` | Oui |
| `@project-gestion/query-keys` | `queryKeys.projects.*` | Oui |
| `@project-gestion/validation` | `loginSchema`, `registerSchema`, `resetPasswordSchema`, `resetPasswordConfirmSchema`, `resendVerificationSchema`, `projectSchema` — mêmes noms de schémas que le web | Oui — exemple de partage correct |
| `@project-gestion/types` | `AuthTokens`, `LoginPayload`, `User`, `Project` | Oui |
| `@project-gestion/permissions` | **Déclaré dans `package.json`, jamais importé dans `src/`** | Dépendance inutilisée — soit code mort, soit fonctionnalité de gating jamais implémentée (`DashboardScreen` permet à quiconque de supprimer un projet sans vérification de rôle) |

**`mobileTokenStore`** (`lib/api.ts`) — implémentation correcte de `TokenStore` : access token en mémoire (fermeture de module), refresh token via `expo-secure-store`. C'est l'usage attendu de l'architecture packages : logique de stockage spécifique à la plateforme branchée sur une factory partagée.

---

## 3. Duplications avec le web (violation de la règle "zéro duplication")

| Fonction | Mobile | Web | Constat |
|---|---|---|---|
| `getErrorMessage`, `isEmailVerificationRequired`, `translateError` | `src/lib/errors.ts` | `apps/web/src/lib/errors.ts` | Même nom, même logique centrale (cas spécial 429, narrowing `ApiError`, dictionnaire de traduction) copiée-collée. Le web a un sur-ensemble (`getFieldError`, `toastError`, dictionnaire plus riche). Devrait être extrait en package partagé, avec `toastError` (dépend de `sonner`) gardé en wrapper web-only. |
| `createQueryClient()` | `src/lib/query-client.ts` | `apps/web/src/lib/query-client.ts` | **Identique byte-for-byte** (même corps, mêmes options `staleTime: 30_000, retry: 1`) — cas de duplication le plus net et le plus simple à corriger de tout l'audit. |
| Tokens de couleur du thème | `apps/mobile/tailwind.config.js` (valeurs hex codées en dur) | `packages/config`'s `theme.colors` | Les valeurs hex sont **identiques** aux tokens déjà exportés par `packages/config`, mais recopiées plutôt qu'importées — probablement pour une raison technique valable (les fichiers de config Tailwind s'exécutent dans un contexte de build spécial), mais reste une duplication de données que le package a justement été conçu pour centraliser. |

---

## 4. Code mort / éléments incomplets

- Aucun marqueur `TODO`/`FIXME` trouvé dans les 17 fichiers.
- `accessToken`/`refreshToken` dans `AuthState` (`stores/auth-store.ts`) sont écrits par `setTokens` mais **jamais lus** ailleurs — le token réellement utilisé pour les appels API vit dans la fermeture de module `memoryAccessToken` de `lib/api.ts`, pas dans le store Zustand. Champs vestigiaux/write-only.
- Pas d'écrans stub pour les futures features (Tâches, Temps, etc.) — absence plutôt qu'implémentation partielle.
- Suppression de projet sans confirmation (voir §1) — écart d'UX plutôt que code mort à proprement parler.

---

## Évaluation globale

L'architecture mobile branche correctement le système de packages partagés pour l'essentiel de sa surface (appels API, clés de requête, schémas de validation, types). Les écarts identifiés sont concentrés dans 3 petits fichiers utilitaires (`errors.ts`, `query-client.ts`, tokens de thème) qui semblent avoir été copiés-collés lors du bootstrap initial plutôt qu'extraits — consolidation simple et sans complication de plateforme, à l'exception du cas Tailwind config.
