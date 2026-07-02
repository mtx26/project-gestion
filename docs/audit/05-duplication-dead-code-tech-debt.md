# Synthèse transverse — Duplications, code mort, dette technique

> Consolidation cross-stack des constats détaillés dans [01-backend.md](01-backend.md) et [02-web.md](02-web.md)/[03-mobile.md](03-mobile.md).
> Aucune duplication cross-stack (Python ↔ TypeScript) n'a de sens à signaler puisque les deux bases ne partagent pas de code —
> en revanche, les mêmes **catégories** de problèmes réapparaissent des deux côtés, ce qui suggère des habitudes d'équipe plutôt que des accidents isolés.

---

## 1. Duplications — vue consolidée

### Backend (Django)

| # | Duplication | Emplacements | Impact |
|---|---|---|---|
| 1 | Switch `permission_code` par méthode HTTP dans `get_permissions()` | ~25 classes de vues | Boilerplate, risque d'oubli lors de l'ajout d'une ressource |
| 2 | `swagger_fake_view` guard en tête de `get_queryset()` | 30+ occurrences | Boilerplate uniquement |
| 3 | Vue de restauration en 3 lignes | 7 vues (Project/Folder/Document/Task/TimeEntry/FinancialEntry/ExpenseRequest) | Candidat classe générique |
| 4 | `perform_destroy` soft-delete à une ligne | 8 vues | Candidat mixin |
| 5 | `documents_info` SerializerMethodField | 4 serializers | Dérive possible du format de sortie |
| 6 | **Calcul coût/payé/restant d'un TimeEntry** | Modèle + 2 serializers (3 implémentations) | **Risque métier réel** — dérive de la règle financière possible |
| 7 | `_get_user_display_name` / `get_user_display_name` | `serializers.py` (privé) + `utils.py` (public) | Confusion, deux sources pour la même chose |
| 8 | `FolderTreeView` vs `FolderTargetTreeView` | 2 vues | Structure dupliquée, pas la logique métier critique |
| 9 | `validate_document_file`/`validate_profile_picture_file`, `upload_document_file`/`upload_profile_picture_file` | `services/storage.py` | ~90% identique |
| 10 | `filter_folder` par FilterSet | 5 FilterSet | Candidat mixin `FolderScopedFilterMixin` |
| 11 | Vérification "owner uniquement" | `ProjectDetailView`, `ProjectRestoreView`, `ProjectOwnerRateView` | Candidat permission dédiée `IsProjectOwner` |

### Frontend (Web)

| # | Duplication | Emplacements | Impact |
|---|---|---|---|
| 1 | Graphique financier (Recharts) | `FinanceBarChart` + inline dans `active-project-dashboard.tsx` | Double maintenance visuelle |
| 2 | `formatFinancePeriod`, `formatMoney`, `formatDuration` réimplémentés localement | `active-project-dashboard.tsx` vs `lib/task-utils.ts`/`finance-utils.ts` | Dérive de format possible |
| 3 | Avatar de membre (`DashboardMemberAvatar` / `MemberAvatar`) | dashboard vs settings | Duplication pixel-identique |
| 4 | `getInitials`/`getUserDisplayName` | `app-header.tsx` vs `dashboard-sidebar.tsx` | Petit, mais règle "zéro duplication" violée |
| 5 | `invalidateTasks`/`invalidateTimeQueries` | 1 par feature | Candidat helper générique |
| 6 | Agrégation de totaux temps | `time-filters.ts: summarizeTimeEntries` vs `folder-preview-panel.tsx: TimeTotals` | Risque de dérive du calcul |
| 7 | `FinancialEntryFormDialog`/`DetailDialog` vs `ExpenseRequestFormDialog`/`DetailDialog` | 2 paires de fichiers ~250-300 lignes chacun | Duplication structurelle la plus large du frontend |
| 8 | 3 fonctions `formatDate` incompatibles (2 portent le même nom) | `date-utils.ts`, `task-utils.ts`, `period-utils.ts` | **Footgun réel** — import du mauvais `formatDate` |
| 9 | `getStatusLabel`/`getPriorityLabel`/`*ClassName` vs config des badges | `lib/task-utils.ts` vs `components/badges/*` | Deux sources de vérité pour la même donnée de présentation |
| 10 | `TaskStatusBadge` local dans `tree-picker.tsx` | 1 occurrence | Violation explicite de la règle "jamais recoder un badge inline" |
| 11 | Menu compte fait main | `app-header.tsx` + `dashboard-sidebar.tsx` | Contourne `DropdownMenu` déjà utilisé ailleurs dans le même fichier |

### Mobile ↔ Web

| # | Duplication | Emplacements | Impact |
|---|---|---|---|
| 1 | `createQueryClient()` | Identique byte-for-byte, mobile + web | Le cas le plus simple à corriger de tout l'audit |
| 2 | `getErrorMessage`/`isEmailVerificationRequired`/`translateError` | mobile + web (web = sur-ensemble) | Violation directe de la règle "zéro duplication web/mobile" du CLAUDE.md racine |
| 3 | Tokens de couleur du thème | `packages/config`'s `theme` vs `apps/mobile/tailwind.config.js` codé en dur | Duplication de données, contrainte technique de build possible |

**Pattern transverse observé** : dans les deux stacks, les duplications les plus risquées ne sont pas des copier-coller de UI mais des **réimplémentations indépendantes d'une même règle de calcul/formatage** (argent en Python, dates/couleurs en TypeScript) — c'est la catégorie à traiter en priorité, pas le boilerplate de vue/dialogue qui, bien que répétitif, est mécaniquement sûr.

---

## 2. Code mort — vue consolidée

| Zone | Symbole(s) | Confiance |
|---|---|---|
| Backend | `storage.get_document_file`, `storage.delete_document_file` | Élevée — 0 appelant, cause directe du non-nettoyage du stockage |
| Backend | `services.projects.is_project_member` | Élevée |
| Backend | `services.roles.get_deleted_project_roles` | Élevée, mais **révèle une fonctionnalité incomplète** (routes trash/restore rôle jamais créées malgré des tests qui les attendent) |
| Backend | `api/schema.py: add_error_responses` | Élevée — hook explicitement désactivé dans les settings |
| Web packages | `summarizeFinancialEntries`, `sumFinancialEntries`, `getApiCount`, `getApiPageSize` (`packages/api`) | Moyenne — à revérifier côté mobile avant suppression |
| Web packages | `theme` (`packages/config`) | Moyenne — probablement mobile-only, mais mobile duplique déjà les valeurs en dur (voir §1) |
| Web packages | `queryKeys.auth.me` | Élevée |
| Web packages | 7 exports de `packages/permissions` sans consommateur externe | Faible-moyenne — surface d'API publique surdimensionnée plutôt que vraiment mort |
| Web app | `app/projects/page.tsx` (alias de `/dashboard`) | Moyenne |
| Web app | 8 exports de `app/time/lib/time-filters.ts` | Moyenne — à revérifier par grep élargi |

---

## 3. Dette technique — thèmes récurrents

### 3.1 Logique métier mal placée (backend)

Concentrée dans 4 zones : `ExpenseRequestApproveView` (crée un `FinancialEntry` sans `full_clean()`), `ProjectMemberDetailView` (autorisation fine + nettoyage cascadé en vue), `FinancialEntryChartView` (agrégation Python plutôt que SQL), absence de `services/financial_entries.py` et `services/expense_requests.py` alors que toutes les autres ressources majeures ont un module de service dédié. **Cause racine probable** : ces deux ressources ont été ajoutées plus tard ou plus rapidement que les autres, sans suivre la convention établie par `services/invitations.py` (la référence qualité du projet).

### 3.2 Sources de vérité multiples pour une même donnée de présentation (frontend)

Statuts/priorités de tâche, dates, argent — chacun a au moins 2 implémentations indépendantes. Le chantier en cours (`PrioritySelect` réutilisant `TASK_PRIORITY_OPTIONS`) montre que l'équipe sait résoudre ce problème quand elle le traite explicitement ; il reste à appliquer le même geste aux autres cas (`task-utils.ts`'s `getStatusLabel`/`getPriorityLabel` vs configs des badges).

### 3.3 Fichiers "grab-bag" mal nommés

`lib/task-utils.ts` (formatteurs génériques + logique tâche), `packages/api` (client HTTP + maths financières), `packages/permissions` (catalogue + graphe + logique UI de rôle) — tous mono-fichiers, contraire à la convention `AI_DIRECTIVES.md`.

### 3.4 Écarts de migration (chantier de factorisation en cours)

Le chantier `FormDialog`/`FormSubmitButton`/`DateRangeField`/`PrioritySelect`/`closeThenNotify` est **correctement adopté sur les 6 fichiers explicitement ciblés**, mais 3-4 fichiers hors périmètre immédiat (`create-project-dialog.tsx`, `app/time/page.tsx`'s dialogue de création, `project-files-page-content.tsx`'s dialogues rename/delete) restent sur l'ancien pattern. Risque : si le chantier s'arrête ici, ces fichiers deviendront la nouvelle exception à corriger plus tard.

### 3.5 Repli de stockage local backend — régression de sécurité en cours

Détail complet en [01-backend.md §5](01-backend.md#api-servicesstoragepy--analyse-approfondie-repli-de-stockage-local) et [04-business-flows.md (f)](04-business-flows.md#f--upload--rattachement-de-document). Point le plus critique de tout l'audit : le garde `if not settings.DEBUG: raise` a été retiré de la version en cours de modification (`git diff HEAD` sur `apps/backend/api/services/storage.py`), ce qui change le comportement en cas de panne S3 en production de "échec bruyant" à "dégradation silencieuse et données probablement inaccessibles". À traiter avant merge, indépendamment du reste du plan de refactorisation.

### 3.6 Incohérences de gestion d'erreur (backend)

Trois idiomes coexistent (exception DRF standard, `Response` manuelle, `PermissionDenied` avec message tantôt clé i18n tantôt phrase française brute) — détail en [01-backend.md §12](01-backend.md#12-dette-technique--points-faibles).

### 3.7 Écart documentation/réalité (frontend)

Deux conventions documentées (`AI_DIRECTIVES.md`'s structure `features/`, `apps/web/CLAUDE.md`'s pattern de formulaire shadcn `Form`/`FormField`) ne correspondent pas au code réel, qui est pourtant cohérent sur l'ensemble du repo. Ce n'est pas de la dette de code — c'est de la dette de documentation, avec un risque concret : un futur agent IA ou développeur qui suit la documentation à la lettre introduira une incohérence dans une base par ailleurs homogène.

---

## 4. Ce qui fonctionne bien (à ne pas casser en refactorisant)

- **`services/invitations.py: accept_project_invitation`** — le code le mieux conçu du projet (concurrence, idempotence). Modèle à suivre pour le reste de la couche services.
- **`services/expense_requests.py: _expense_request_qs`** — bon exemple local de déduplication de queryset malgré l'absence de module de service dédié pour cette ressource.
- **`packages/permissions`** — utilisé de façon cohérente côté web, aucun contournement significatif trouvé.
- **La fusion `TreePickerDialog`** (suppression de `target-tree-picker.tsx`) — la consolidation la plus réussie du changeset en cours, migration complète et vérifiée par grep.
- **Aucun usage de `any`** trouvé dans `components/`, `lib/`, `stores/`, `app/` côté web — discipline TypeScript bien maintenue.
- **`TrashSection<T>`** (`app/trash/page.tsx`) — bon pattern générique évitant de dupliquer le rendu de liste 7 fois pour les 7 types d'entités soft-deletable.
