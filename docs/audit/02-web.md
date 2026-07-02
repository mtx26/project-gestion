# Web Next.js — Inventaire technique

> Périmètre : `apps/web/src/app/**` (routes/features), `apps/web/src/components/**`, `apps/web/src/lib/**`,
> `apps/web/src/stores/**`, `packages/{api,config,permissions,query-keys,types,validation}`.
> Voir [00-overview.md](00-overview.md) pour le contexte général.

---

## 1. Cartographie des modules

### `apps/web/src/app/` (routes)

| Route | Fichier(s) | Fin ? |
|---|---|---|
| `/` | `app/page.tsx` | Oui — redirect serveur |
| `/dashboard` | `page.tsx` → `dashboard-page-content.tsx` → `components/active-project-dashboard.tsx` (486 lignes) | page fine ; logique dans le composant |
| `/account` | `app/account/page.tsx` (117 lignes) | Non — formulaire mot de passe inline |
| `/auth/*` (6 pages) | fichiers autonomes 65-104 lignes | Non-fines mais cohérentes (pattern répété propre) |
| `/calendar` | `page.tsx` → `project-calendar-page-content.tsx` (190) → `components/project-calendar-view.tsx` (239) | fine |
| `/files` | `page.tsx` → `project-files-page-content.tsx` (**687 lignes — le plus gros fichier du repo**) | Non |
| `/finance` | `page.tsx` (393 lignes, route+contenu fusionnés) | Non |
| `/requests` | `page.tsx` (389 lignes, route+contenu fusionnés) | Non |
| `/time` | `page.tsx` (489 lignes, route+contenu fusionnés) | Non |
| `/trash` | `page.tsx` (485 lignes, route+contenu fusionnés) | Non |
| `/invitations/accept` | `page.tsx` (108 lignes, 3 composants) | Borderline |
| `/notifications` | `page.tsx` (189 lignes, 3 composants) | Non |
| `/projects` | `page.tsx` (4 lignes) — ré-exporte `DashboardPage` | Alias mort probable |
| `/settings` | `page.tsx` → `components/project-settings-page.tsx` (399, 5 composants) | fine |
| `/tasks` | `page.tsx` → `project-tasks-page-content.tsx` (393) | fine |

**Pattern observé** : `dashboard`, `calendar`, `files`, `tasks`, `settings` suivent `page.tsx` fin (Suspense) → `*-page-content.tsx`. **`finance`, `requests`, `time`, `trash`, `notifications`, tous les `auth/*`, `account`** fusionnent route et logique métier dans `page.tsx` — répété de façon cohérente sur tout le repo, donc probablement la convention réelle plutôt qu'un défaut isolé (voir [00-overview.md §3](00-overview.md#3-conventions-et-écarts-de-documentation)).

### `apps/web/src/components/`

| Dossier | Contenu | Rôle |
|---|---|---|
| `ui/` (38 fichiers) | Primitives shadcn, jamais éditées à la main | Fondation |
| `badges/` (8) | `StatusBadge` générique + 7 configs par domaine | Pattern bien respecté (sauf `MemberTypeBadge`) |
| `dashboard/` (5) | `ProjectWorkspaceShell` (160 lignes, shell de données central), `DashboardSidebar` (393 lignes, plus gros composant partagé) | Coquille applicative |
| `dialogs/` (5) | `FormDialog` (nouveau), `ConfirmDeleteDialog`, `DocumentPreviewModal`, `detail-layout.tsx` (9 primitives), `TaskDetailModal` | |
| `documents/` (2) | `DocumentThumbnail`, `FileAttachment` | |
| `entries/` (1) | `EntryMetadataRow` | |
| `filters/` (5) | `FilterBar` famille, `CollapsibleFilterBar`, `FilterPeriodPicker` (216 lignes) | |
| `forms/` (8) | `PasswordInput`, `DatePicker`, `DateTimePicker`, `DateRangeField` (nouveau), `FormError`/`FormErrorAlert`, `FormSubmitButton` (nouveau), `PrioritySelect` (nouveau) | |
| `pickers/` (1, était 2) | `TreePickerDialog` unifié (373 lignes) — fusion post-suppression de `target-tree-picker.tsx` | |
| `states/` (3) | `SkeletonLoader`, `NoProjectState`, `AccessDeniedState` | |
| racine | `AppHeader`, `AuthShell`, `ProtectedRoute`, `Providers`, `PageTitle`, `MultiDocumentAttachmentField`, `PaginationBar`, `ScrollableTabsList` | |

### `apps/web/src/lib/` et `stores/`

Infrastructure : `api.ts` (point d'entrée unique du client API), formatage (`date-utils.ts`, `task-utils.ts`, `period-utils.ts` — **3 fonctions `formatDate` différentes**, voir §5), tree helpers (`folder-utils.ts`, `target-utils.ts`), `errors.ts` (traduction centralisée), `query-client.ts`, hooks (`use-document-preview`, `use-project-resources`, `use-search-param`, `use-url-filter`, `use-document-attachment`), `close-then-notify.ts` (nouveau). `stores/auth-store.ts` — seul store Zustand du projet.

### `packages/*`

| Package | Lignes | Contenu |
|---|---|---|
| `api` | 736 | `createApiClient`, `ApiError`, helpers de normalisation de liste, 13 groupes de domaine d'endpoints |
| `config` | 35 | `API_BASE_URL`, `tokenStorageKeys`, `theme` (tokens couleur — **non utilisés côté web**, probablement mobile-only) |
| `permissions` | 265 | Catalogue de permissions + graphe de dépendances + helpers RBAC |
| `query-keys` | 155 | Clés React Query centralisées par domaine |
| `types` | 410 | Types miroir des serializers DRF |
| `validation` | 58 | 8 schémas Zod — **auth + projet uniquement** |

Tous mono-fichiers (`src/index.ts`) — contraire à la convention `AI_DIRECTIVES.md` (`index.ts` + `<module>.ts` + `types.ts`), plus criant pour `packages/api` (736 lignes, 13 domaines mélangés avec des maths financières).

---

## 2. Inventaire des composants/fonctions — points saillants

*(Inventaire exhaustif fichier par fichier disponible dans les rapports source ; ci-dessous les éléments à plus forte valeur d'audit.)*

- **`ProjectWorkspaceShell`** (`components/dashboard/project-workspace-shell.tsx`, 160 lignes) — shell utilisé par **toutes** les pages projet-scopées (dashboard, files, tasks, calendar, time, finance, requests, settings, trash). Combine : requête liste de projets, résolution de sélection (URL/manuel/défaut backend/premier de liste), dialogue de création + mutation, mutation "projet par défaut", déconnexion. Responsabilité large mais justifiée en tant que coquille unique — candidat à extraction partielle (`useProjectSelection`) pour testabilité.
- **`DashboardSidebar`** (393 lignes) — plus gros composant partagé. Contient en interne : commutateur de projet (shadcn `DropdownMenu`, correct), navigation avec verrouillage par permission, **bascule de thème via `useSyncExternalStore` fait maison** (devrait être un hook `useTheme()` dans `lib/`), et un **menu compte fait main** (dupliqué avec `app-header.tsx`, voir §5).
- **`TreePickerDialog`** (`components/pickers/tree-picker.tsx`, 373 lignes) — fusion réussie de l'ancien `target-tree-picker.tsx` (supprimé) via union discriminée `mode: "folder" | "target"`. **La consolidation la plus significative du changeset en cours.** Contient toutefois un `TaskStatusBadge` local dupliqué (§5) et 2 primitives natives non-shadcn (checkbox, input).
- **`useDocumentAttachment`** (`lib/use-document-attachment.ts`) — hook bien conçu, état pending/existant, upload à la soumission ; réutilisé par 5 dialogues.
- **`useProjectResources`** (`lib/use-project-resources.ts`) — agrège 3 requêtes + 1 mutation, réutilisé par 4 pages.

---

## 3. Inventaire des packages (détail par domaine d'endpoint)

`packages/api` expose, via `createApiClient(...)`, 13 groupes : `auth`, `projects`, `members`, `roles`, `permissions`, `invitations`, `notifications`, `financialEntries`, `timeEntries`, `tasks`, `folders`, `documents`, `expenseRequests`.

**Incohérences de nommage/forme relevées** :
- `projects.detail(id)` vs `tasks.get`/`timeEntries.get` — deux verbes différents pour la même opération "lire un".
- `folders`, `financialEntries`, `expenseRequests` n'ont **aucune** méthode de lecture unitaire.
- `members`, `roles`, `invitations`, `notifications`, `permissions` n'ont pas de `trash`/`restore` malgré la convention de soft-delete générale côté backend — probablement volontaire mais non documenté.
- Filtres booléens à sémantique équivalente nommés différemment par domaine (`exclude_done`, `exclude_rejected`, `include_unpaid`).
- `folders.tree` utilise des clés camelCase (`includeTasks`/`includeFiles`) mappées vers du snake_case — seul endroit du client à faire ce mapping.

**`packages/permissions`** — vérifié **consistamment utilisé**, aucun contournement significatif trouvé côté `apps/web` (un seul accès direct à `current_user_permission_codes`, à but d'affichage uniquement, pas de décision d'autorisation).

**`packages/validation`** — ne couvre que auth + projet. Tâche/Temps/Finance/Demande/Rôle définissent chacun leur schéma Zod **local** dans leur fichier de dialogue — conforme à la règle CLAUDE.md ("local si non partagé avec mobile") tant que mobile ne les réplique pas.

---

## 4. Audit shadcn/ui

38 primitives installées, correspond à `apps/web/CLAUDE.md`. **Absence notable** : pas de `components/ui/form.tsx` (wrapper `Form`/`FormField` documenté) — aucun formulaire audité ne l'utilise ; le pattern réel est `Field`/`FieldLabel`/`FieldError` + `register()`/`Controller`. Écart doc/réalité cohérent sur tout le repo (voir 00-overview.md).

**Violations concrètes "shadcn en premier" (contournement d'un composant déjà présent)** :
1. `components/pickers/tree-picker.tsx:353-373` — `TaskStatusBadge` local dupliquant `components/badges/task-status-badge.tsx`.
2. `components/dashboard/dashboard-sidebar.tsx:280-317` et `components/app-header.tsx:44-88` — menu compte fait main (`useState` + `div` positionné en absolu) au lieu de `DropdownMenu` — **incohérence interne** puisque `dashboard-sidebar.tsx` utilise correctement `DropdownMenu` pour le sélecteur de projet 140 lignes plus haut dans le même fichier.
3. `components/pickers/tree-picker.tsx:144-151` — `<input type="checkbox">` brut au lieu de `Checkbox` shadcn.

---

## 5. Duplications identifiées

### Adoption des 5 nouvelles abstractions partagées (chantier en cours)

| Fichier | `FormDialog` | `FormSubmitButton` | `DateRangeField` | `PrioritySelect` | `closeThenNotify` |
|---|---|---|---|---|---|
| `file-draft-dialogs.tsx` | ✅ | ✅ | N/A (date unique) | ✅ | — |
| `finance-entry-dialogs.tsx` | ✅ | ✅ | N/A | N/A | — |
| `request-dialogs.tsx` | ✅ | ✅ | N/A | N/A | — |
| `role-form-dialog.tsx` | ✅ | ✅ | N/A | N/A | — |
| `task-form-dialog.tsx` | ✅ | ✅ | ✅ | ✅ | — |
| `time-dialogs.tsx` | ✅ (3 dialogues) | ✅ | ✅ | N/A | — |

**Verdict** : migration **complète et cohérente** sur les 6 fichiers ciblés — aucun `Dialog`/`DialogContent` manuel ni bouton "spinner" fait main ne subsiste dans ces fichiers.

**`closeThenNotify`** — extrait du pattern `setOpen(false); setTimeout(() => onSelect(value), 0)` précédemment codé en dur dans `target-tree-picker.tsx` (confirmé par `git show HEAD:...`, même commentaire FR). Adopté dans 4 fichiers (`tree-picker.tsx`, `date-picker.tsx`, `date-time-picker.tsx`, `filter-period-picker.tsx`) — migration complète pour ce pattern précis, mais **jamais utilisé dans `app/`** (seulement dans `components/`).

**Écarts de migration restants** (hors des 6 fichiers ciblés) :
- `app/time/page.tsx:412-440` — dialogue de création de temps encore en `Dialog`/`DialogContent` brut, alors que son fichier voisin `time-dialogs.tsx` a migré ses 3 dialogues.
- `components/dashboard/create-project-dialog.tsx` + `project-form.tsx` — n'ont pas adopté `FormDialog`/`FormSubmitButton` malgré une forme identique au pattern cible.
- `app/account/components/profile-picture-editor-dialog.tsx` — `Dialog` manuel (justifié : UI de recadrage, pas un formulaire de données classique).
- `app/files/project-files-page-content.tsx:629-684` — dialogues rename/delete en primitives brutes ; le cas delete devrait utiliser `ConfirmDeleteDialog` (déjà utilisé ailleurs).

### Autres duplications (indépendantes du chantier en cours)

- **Graphique financier dupliqué 2×** : `FinanceBarChart` (`app/finance/components/finance-bar-chart.tsx`) et `FinanceTimelineChart`+`DashboardFinanceTooltip` (inline dans `active-project-dashboard.tsx:256-340`) — même structure Recharts, implémentées indépendamment.
- **`formatFinancePeriod`** défini 2× (`app/finance/lib/finance-utils.ts` et inline dans `active-project-dashboard.tsx`).
- **`formatMoney`/`formatDuration`** réimplémentés localement dans `active-project-dashboard.tsx` alors que `@/lib/task-utils` les exporte déjà et est importé par toutes les autres features.
- **Avatar de membre dupliqué** : `DashboardMemberAvatar` (dashboard) et `MemberAvatar` (`members-settings-tab.tsx`) — implémentations pixel-identiques, noms différents.
- **`getInitials`/`getUserDisplayName`** — dupliqués entre `app-header.tsx` et `dashboard-sidebar.tsx`.
- **`invalidateTasks`**/**`invalidateTimeQueries`** — deux helpers d'invalidation de requête structurellement identiques, un par feature.
- **Agrégation de totaux temps** dupliquée entre `app/time/lib/time-filters.ts: summarizeTimeEntries` et un composant local `TimeTotals` dans `folder-preview-panel.tsx`.
- **`FinancialEntryFormDialog`/`DetailDialog`** vs **`ExpenseRequestFormDialog`/`DetailDialog`** — structure quasi identique (schéma Zod local, `useDocumentAttachment`, `TreePickerDialog` mode target, mise en page `DetailModal`/`ModalHero`/`ModalGrid`/`ModalDocs`) — candidat à un composant générique `TargetedEntryFormDialog`/`TargetedEntryDetailDialog`.
- **Trois fonctions `formatDate` distinctes** (`lib/date-utils.ts`, `lib/task-utils.ts`, `lib/period-utils.ts`) — deux portent le même nom `formatDate` avec des formats de sortie incompatibles.
- **`getStatusLabel`/`getPriorityLabel`/`getStatusClassName`/`getPriorityClassName`** (`lib/task-utils.ts`) — source de vérité parallèle à `TaskStatusBadge`/`TaskPriorityBadge`'s `OPTIONS`, non consolidée malgré que `PrioritySelect` ait prouvé la viabilité de la réutilisation de configuration.

---

## 6. Code mort identifié

| Symbole | Fichier | Constat |
|---|---|---|
| `summarizeFinancialEntries`, `sumFinancialEntries` | `packages/api/src/index.ts` | 0 usage dans `apps/web/src` |
| `getApiCount`, `getApiPageSize` | `packages/api/src/index.ts` | 0 usage confirmé dans `apps/web/src` |
| `theme` (tokens couleur) | `packages/config/src/index.ts` | 0 usage web (Tailwind CSS variables utilisées à la place) — probablement mobile-only |
| `queryKeys.auth.me` | `packages/query-keys/src/index.ts` | 0 usage — `api.auth.me()` appelé directement, hors React Query |
| `isProjectOwner`, `getPermissionScope`, `formatPermissionScope`, `normalizePermissionCodes`, `permissionScopeLabels`, `permissionDependencyCodes`, `allProjectPermissionCodes` | `packages/permissions/src/index.ts` | 0 usage externe — consommés uniquement en interne par d'autres exports du même package (surface d'API publique surdimensionnée) |
| `DetailGrid` | `components/dialogs/detail-layout.tsx` | 0 usage externe, seulement interne à `ModalGrid` |
| `app/projects/page.tsx` | — | Ré-exporte `DashboardPage` à l'identique ; `/projects` semble être un alias orphelin de `/dashboard` |
| `filterTimeEntriesByPaymentStatus`, `filterTimeEntriesByTarget`, `summarizeTimeEntries`, `groupTimeEntriesByDay`, `getCalendarMonthDate`, `getMonthCalendarDays`, `parseTimeViewMode`, `TimeViewMode` | `app/time/lib/time-filters.ts` | Aucun appelant trouvé dans le module `time` — à confirmer par un grep plus large avant suppression |
| `setOptionalParam` | `lib/url-params.ts` | Aucun site d'appel confirmé (`buildFilterParams` semble l'avoir remplacé) |
| `collectTargetLabelsByType`, `collectTaskFolderIds` | `lib/target-utils.ts` | Aucun appelant confirmé parmi les 4 consommateurs connus |

---

## 7. Dette technique / points faibles

1. **`lib/task-utils.ts` est un fourre-tout mal nommé** — mélange formateurs génériques (`formatDate`, `formatDuration`, `formatBytes`, `formatMoney`) et helpers réellement liés aux tâches (`getStatusLabel`). Contraire à la règle AI_DIRECTIVES "éviter les fichiers vagues type utils.ts sauf périmètre déjà étroit".
2. **Deux composants "erreur de formulaire" qui se chevauchent** — `FormError` (1 seul consommateur) vs `FormErrorAlert` (dominant partout ailleurs) : candidat à consolidation.
3. **Gestion du thème embarquée dans `DashboardSidebar`** plutôt qu'un hook `useTheme()` dans `lib/` — logique stateful réutilisable, actuellement non testable isolément.
4. **Nom de type `File`** dans `packages/types` entre en collision avec le `File` DOM global, forçant un alias (`File as ApiFile`) à chaque site d'import.
5. **`packages/validation` ne couvre pas les entités riches** (Task/TimeEntry/FinancialEntry/ExpenseRequest/Role) — chaque dialogue définit son propre schéma local, cohérent avec la règle actuelle mais laisse le package sous-dimensionné par rapport à la croissance de l'app.
6. **Tous les packages sont mono-fichiers** — le plus criant pour `packages/api` (736 lignes, 13 domaines + maths financières mélangés) et `packages/permissions` (265 lignes, au moins 3 frontières de module naturelles).
7. Aucun usage de `any` trouvé dans `components/`, `lib/`, `stores/`, ni dans `app/` — règle bien respectée sur l'ensemble du périmètre audité (point positif).

---

## 8. Cartographie de `components/ui/dialog.tsx`

168 lignes, construit sur `radix-ui`'s `Dialog` namespace (import consolidé `radix-ui`, pas `@radix-ui/react-dialog` individuel). 10 exports : `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose` (passthrough), `DialogOverlay` (stylé), `DialogContent` (centré, `max-h-[85vh]`, bouton fermeture optionnel), `DialogHeader`, `DialogFooter` (bouton "Close" par défaut **en anglais**, incohérent avec le reste de l'UI en français — a priori jamais déclenché en pratique car chaque consommateur audité fournit ses propres boutons français), `DialogTitle`, `DialogDescription`.

`FormDialog` (nouveau) est une composition fine au-dessus de ces primitives — n'a nécessité aucune modification de `dialog.tsx` lui-même. La seule exception au contrat standard est `DocumentPreviewModal`, qui contourne délibérément `DialogContent` pour un layout plein écran (justifié).

Au moment de l'audit, le fichier sur disque est **identique à `HEAD`** malgré son statut git "MM" — un changement stagé (`sticky bottom-0` sur `DialogFooter`) est annulé par un changement non-stagé qui le retire.

---

## Couverture / réserves

- Inventaire exhaustif composant-par-composant disponible dans les transcriptions d'audit source ; ce document retient les éléments à plus forte valeur (duplication, dette, cartographie).
- Tous les fichiers `.ts`/`.tsx` sous `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/lib/**`, `apps/web/src/stores/**`, et les 6 `packages/*/src/index.ts` ont été lus intégralement.
