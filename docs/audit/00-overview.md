# Audit technique — Vue d'ensemble

> Documentation de référence générée par audit statique en lecture seule (juillet 2026).
> Périmètre : `apps/backend` (Django), `apps/web` (Next.js), `apps/mobile` (Expo), `packages/*`.
> Aucune modification de code n'a été effectuée pendant cet audit.

Sommaire de la série de documents :

- [00-overview.md](00-overview.md) — ce document (architecture, cartographie, scores)
- [01-backend.md](01-backend.md) — inventaire Django (modèles, serializers, vues, services, permissions)
- [02-web.md](02-web.md) — inventaire Next.js (routes `app/`, composants partagés, packages)
- [03-mobile.md](03-mobile.md) — inventaire Expo
- [04-business-flows.md](04-business-flows.md) — parcours métier bout-en-bout (frontend → backend → DB)
- [05-duplication-dead-code-tech-debt.md](05-duplication-dead-code-tech-debt.md) — duplications, code mort, dette technique
- [06-refactoring-plan.md](06-refactoring-plan.md) — plan de refactorisation priorisé + notation qualité

---

## 1. Compréhension globale du projet

### 1.1 Nature du projet

`project-gestion` est une application de gestion de projet multi-tenant (à l'échelle "projet" — chaque `Project` a un `owner`, des membres, des rôles/permissions). Elle couvre : gestion de tâches, suivi du temps (avec facturation horaire), entrées financières (dépenses/remboursements), demandes de remboursement avec workflow d'approbation, gestion documentaire (dossiers/fichiers avec stockage S3), invitations de membres, notifications in-app, et une corbeille (soft-delete) transverse à toutes les entités.

### 1.2 Architecture générale

Monorepo pnpm/turborepo à 3 applications déployables + 6 packages partagés :

```
apps/
  backend/   Django 6 + DRF + SimpleJWT + django-allauth + Anymail(Resend) + S3(boto3)
  web/       Next.js 16 (App Router) + React 19 + TypeScript strict + shadcn/ui + Tailwind 4
  mobile/    Expo 56 + React Native 0.85 + Nativewind — squelette auth-only
packages/
  api/           client HTTP factory (createApiClient) — 13 domaines d'endpoints
  config/        API_BASE_URL, clés de stockage token, tokens de thème
  permissions/   catalogue de permissions + graphe de dépendances + helpers RBAC
  query-keys/    clés React Query centralisées
  types/         types de domaine partagés (miroir des serializers DRF)
  validation/    schémas Zod (auth + projet uniquement, FR)
```

**Règle de dépendance respectée** : `apps/* → packages/*` uniquement. Aucune importation `packages/* → apps/*` ni `apps/web ↔ apps/mobile` n'a été trouvée — la règle du monorepo est effectivement respectée dans le code (vérifié par grep dans les 3 audits applicatifs).

### 1.3 Pattern d'architecture backend

Django REST "generics-based" pur : **aucun `ViewSet`/`DefaultRouter`** n'existe dans le projet — chaque endpoint est une vue `generics.*APIView` déclarée à la main dans `api/urls.py` (60 routes) et `accounts/urls.py`. L'autorisation est un RBAC entièrement fait-maison (`Role` → `RolePermission` → `Permission`, scoping par `ProjectMember`), avec `django-guardian` présent dans `requirements.txt` mais **jamais utilisé** (absent d'`INSTALLED_APPS`, jamais importé — voir [01-backend.md](01-backend.md#6-permissions)).

Couches (quand elles existent) : `urls.py` → `views/*.py` (permission_classes + get_queryset) → `serializers.py` (validation + `full_clean()` + method fields de présentation) → `services/*.py` (logique métier réutilisable) → `models.py` (contraintes DB + `clean()`) → PostgreSQL. Le soft-delete est géré uniformément par `core.BaseModel` (`objects`/`deleted_objects`/`all_objects`).

**Écart notable** : une quantité significative de logique métier n'est pas dans `services/` mais directement dans les vues ou les serializers (ex. calcul de graphique financier dans la vue, création de `FinancialEntry` depuis l'approbation d'une demande de remboursement dans la vue, résolution du taux horaire par défaut dans le serializer). Détail complet en [01-backend.md](01-backend.md) et [05-duplication-dead-code-tech-debt.md](05-duplication-dead-code-tech-debt.md).

### 1.4 Pattern d'architecture web

Next.js App Router avec une convention **différente de celle documentée** dans `AI_DIRECTIVES.md` (qui décrit un modèle `features/<feature>/{screens,components,hooks,lib,services}`). Le code réel suit plutôt le modèle documenté dans `apps/web/CLAUDE.md` : `app/<page>/page.tsx` (fin ou parfois porteur de toute la logique) + `app/<page>/components/` + `app/<page>/lib/` + `src/components/<catégorie>/` pour le partagé (2+ pages) + `src/lib/` pour l'infrastructure. C'est un conflit de documentation, pas un défaut de code — voir [02-web.md §Conventions](02-web.md).

Data fetching : TanStack React Query v5 avec clés centralisées dans `packages/query-keys`. Formulaires : React Hook Form + Zod, mais **pas** via le wrapper shadcn `Form`/`FormField` documenté dans `apps/web/CLAUDE.md` — le pattern réel utilise `Field`/`FieldLabel`/`FieldError` (shadcn `field.tsx`) + `form.register()`/`Controller` directement. Autre écart documentation/réalité, cohérent sur tout le repo (donc à corriger dans la doc plutôt que dans le code).

Un chantier de factorisation est en cours au moment de l'audit (fichiers en `git status` modifiés/ajoutés) : 5 nouvelles abstractions partagées (`FormDialog`, `FormSubmitButton`, `DateRangeField`, `PrioritySelect`, `closeThenNotify`) ont été extraites et adoptées avec un taux de succès élevé — détail complet en [05-duplication-dead-code-tech-debt.md](05-duplication-dead-code-tech-debt.md).

### 1.5 Pattern d'architecture mobile

Expo/React Native, état embryonnaire : authentification complète (login/register/verify/reset) + CRUD projet minimal. Aucun des domaines métier riches (tâches, temps, finance, demandes, fichiers, paramètres, notifications) n'existe côté mobile. Consomme correctement `packages/api`, `packages/query-keys`, `packages/validation`, `packages/types`, mais duplique (au lieu de partager) 3 petits utilitaires avec le web (`errors.ts`, `query-client.ts`, tokens de thème) — détail en [03-mobile.md](03-mobile.md).

### 1.6 Bibliothèques clés

| Domaine | Bibliothèque |
|---|---|
| Backend web framework | Django 6, Django REST Framework |
| Auth backend | `rest_framework_simplejwt` (+ blacklist), `django-allauth` (+`dj-rest-auth`), Google OAuth |
| Email | `django-anymail` → Resend (avec repli console backend si pas de clé API) |
| Stockage fichiers | `boto3` (S3/MinIO) avec repli disque local (voir §1.3, détail en 01-backend.md) |
| Filtrage backend | `django-filter` |
| Doc API | `drf-spectacular` |
| Frontend UI | shadcn/ui (Radix UI + Tailwind CSS 4 + `class-variance-authority`), Lucide icônes |
| State serveur | TanStack React Query v5 |
| State client | Zustand (un seul store : `useAuthStore`) |
| Formulaires | React Hook Form + Zod (+`@hookform/resolvers`) |
| Graphiques | Recharts (via shadcn `chart.tsx`) |
| Calendrier | FullCalendar (`@fullcalendar/react`) |
| Mobile | Expo 56, React Native 0.85, Nativewind, React Navigation |

### 1.7 Points d'entrée principaux

- **Backend** : `apps/backend/config/wsgi.py`/`asgi.py`, routes racine dans `apps/backend/config/urls.py` (monte `accounts.urls` sous `/api/accounts/`, `api.urls` sous `/api/`, `anymail.urls` sous `/anymail/` pour les webhooks Resend).
- **Web** : `apps/web/src/app/layout.tsx` (racine), `apps/web/src/app/page.tsx` (redirige vers `/dashboard`), `apps/web/src/components/providers.tsx` (React Query, Tooltip, Toaster, restauration de session).
- **Mobile** : `apps/mobile/App.tsx` (bascule Auth/App stack selon `useAuthStore`), `apps/mobile/index.ts`.

---

## 2. Cartographie de l'architecture (couches)

| Couche | Rôle | Emplacement | Dépendances | Problèmes identifiés |
|---|---|---|---|---|
| Frontend (routing) | Adaptateurs de route, layouts | `apps/web/src/app/**/page.tsx` | `app/**/components`, `app/**/lib` | Plusieurs `page.tsx` portent toute la logique métier (finance, requests, time, trash) au lieu de délégueur — voir 02-web.md |
| Frontend (composants partagés) | UI réutilisable, primitives shadcn | `apps/web/src/components/**` | `packages/types`, `packages/permissions` | `DashboardSidebar`/`ProjectWorkspaceShell` ont une surface de responsabilité large ; quelques doublons shadcn contournés (dropdown compte, badge statut) |
| Frontend (infra) | Client API, erreurs, hooks transverses | `apps/web/src/lib/**`, `apps/web/src/stores/**` | `packages/api`, `packages/config` | 3 fonctions `formatDate` différentes, grab-bag `task-utils.ts` |
| Packages partagés | Contrats domaine, client HTTP, permissions | `packages/*/src/index.ts` | aucune (sauf `zod`) | Tous mono-fichiers, contraire à la convention `AI_DIRECTIVES.md` |
| API (routing) | Déclaration des endpoints | `apps/backend/api/urls.py`, `accounts/urls.py` | `views/*.py` | Collision de `name=` sur les routes Folder |
| Vues | Permission + queryset + orchestration | `apps/backend/api/views/*.py`, `accounts/views.py` | `permissions.py`, `services/*.py`, `serializers.py` | Logique métier significative dans plusieurs vues (voir §1.3) |
| Serializers | Validation + shaping de sortie | `apps/backend/api/serializers.py`, `accounts/serializers.py` | `models.py`, `services/*.py` | Pattern `full_clean()` dupliqué 6×, logique de taux horaire par défaut dans un `create()` |
| Services | Logique métier réutilisable | `apps/backend/api/services/*.py`, `accounts/services.py` | `models.py` | Couverture inégale — certains domaines (finance chart, cleanup membre) n'ont pas de service dédié |
| Modèles | Contraintes DB, `clean()`, soft-delete | `apps/backend/api/models.py`, `accounts/models.py`, `core/models.py` | — | Calcul de solde temps dupliqué avec les serializers |
| Base de données | PostgreSQL | — | — | — |

**Dépendances circulaires** : aucune au niveau `packages ↔ apps`. Au niveau applicatif Django, `accounts` et `api` sont mutuellement couplés (`accounts/views.py` importe `api.services.storage` ; `api/views/users.py` importe `accounts.serializers.UserSerializer`) — pas un cycle d'import Python strict mais un couplage architectural bidirectionnel entre deux apps qui devraient être plus indépendantes (détail en 01-backend.md §1).

---

## 3. Conventions et écarts de documentation

Deux désaccords **documentation vs code réel** ont été identifiés — à traiter comme des décisions à prendre (mettre à jour la doc ou migrer le code), pas comme des bugs :

1. **Structure de features web** : `AI_DIRECTIVES.md` décrit `apps/*/src/features/<feature>/{screens,components,hooks,lib,services}` ; le code réel suit `apps/web/CLAUDE.md`'s modèle `app/<page>/components` + `app/<page>/lib` + `src/components/<catégorie>`. Le code est cohérent sur l'ensemble du repo avec le second modèle.
2. **Pattern de formulaire shadcn** : `apps/web/CLAUDE.md` documente `Form`/`FormField`/`FormControl`/`FormMessage`. Aucun fichier `components/ui/form.tsx` n'existe et aucun formulaire audité ne l'utilise — tous utilisent `Field`/`FieldLabel`/`FieldError` + `register()`/`Controller`. Cohérent sur tout le repo.

Recommandation : mettre à jour `AI_DIRECTIVES.md` et `apps/web/CLAUDE.md` pour refléter la pratique réelle, plutôt que de migrer un code cohérent et fonctionnel vers une convention non appliquée.

---

## 4. Score de qualité

Voir la justification détaillée dans [06-refactoring-plan.md §Score de qualité](06-refactoring-plan.md#score-de-qualité).

| Critère | Note /10 |
|---|---|
| Lisibilité | 7 |
| Simplicité | 6 |
| DRY | 6 |
| KISS | 6.5 |
| SOLID | 6 |
| Découplage | 7 |
| Architecture | 6.5 |
| Performance | 7 |
| Maintenabilité | 6.5 |
| Documentation | 5 |
