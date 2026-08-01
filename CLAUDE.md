# project-gestion — Contexte IA

Monorepo full-stack : **Django REST** (backend) + **Next.js 16** (web) + **Expo** (mobile).  
Toujours lire `AI_DIRECTIVES.md` en complément — les règles ci-dessous s'y ajoutent.

---

## Stack & packages partagés

| Couche | Tech |
|---|---|
| Backend | Django 6, DRF, django-allauth (headless, sessions), django-guardian, Resend, S3 |
| Web | Next.js 16 App Router, React 19, TypeScript |
| Mobile | Expo 56, React Native 0.85, Nativewind |
| UI web | **shadcn/ui** + Tailwind CSS 4 + Radix UI + Lucide |
| Formulaires | React Hook Form + Zod + `@hookform/resolvers` |
| Data | TanStack React Query v5 + `packages/api` + `packages/query-keys` |
| État global | Zustand |
| Validation | `packages/validation` (schémas Zod partagés) |
| Types | `packages/types` (types domaine partagés) |
| Permissions | `packages/permissions` |
| Config | `packages/config` (API_BASE_URL, theme tokens) |

**Règle packages :** apps → packages OK. packages → apps INTERDIT. apps → autres apps INTERDIT.

---

## Structure monorepo

```
apps/
  backend/        Django REST API
  web/            Next.js — voir apps/web/CLAUDE.md
  mobile/         Expo React Native — voir apps/mobile/CLAUDE.md
packages/
  api/            Client API factory + types endpoints
  config/         Constantes partagées
  permissions/    Logique permissions/rôles
  query-keys/     Clés React Query
  types/          Types TypeScript domaine
  validation/     Schémas Zod (français)
```

---

## Modèle de données (Django)

Soft-delete sur toutes les entités via `core.BaseModel` :
- `objects` → actifs seulement
- `deleted_objects` → supprimés
- `all_objects` → tout

Entités clés : `Project`, `Role`, `Permission`, `RolePermission`, `ProjectMember`,
`Folder`, `Document`, `Task`, `TimeEntry`, `FinancialEntry`, `ExpenseRequest`,
`Invitation`, `Notification`, `EmailDelivery`.

---

## Installation de dépendances

Quand on installe une nouvelle librairie :
1. **Vérifier si un package existant couvre déjà le besoin** avant d'en ajouter un.
2. **Toujours chercher et exécuter les commandes de setup/init officielles** après `pnpm add` — par exemple `pnpm dlx shadcn@latest add <composant>`, `npx <lib> init`, etc. Ne pas se contenter du `pnpm add` si la lib fournit une CLI de configuration.
---

## Règles non-négociables

1. **Ne construire que ce qui est explicitement demandé.**
2. **Zéro duplication** entre web et mobile : extraire dans `packages/` dès qu'une logique est partagée.
3. **shadcn/ui en priorité** pour tout composant UI web (voir `apps/web/CLAUDE.md`).
4. **Un composant = un fichier.** Un fichier = une responsabilité.
5. **Route files minces** : ils importent un screen depuis `features/`, c'est tout.
6. **Types partagés dans `packages/types`**, locaux dans `features/<feature>/types.ts`.
7. **Schémas Zod dans `packages/validation`** quand utilisés par web ET mobile.
8. **Clés React Query depuis `packages/query-keys`** uniquement.
9. Vérifier avant tout ajout de dépendance qu'un package existant ne couvre pas déjà le besoin.

---

## Commandes vérification

```bash
# TypeScript web
pnpm --filter web typecheck

# Build web
pnpm --filter web build

# Build package modifié
pnpm --filter @project-gestion/<package> build

# Lint tout
pnpm lint
```
