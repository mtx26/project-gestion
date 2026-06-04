Pour un projet comme MediTime mais orienté **gestion de projet / GED / ERP léger**, je découperais beaucoup plus finement afin d'éviter les blocages.

# Phase 0 — Conception

## 0.1 Analyse métier

* Définir les types d'utilisateurs

  * Administrateur
  * Chef de projet
  * Collaborateur
  * Client
* Définir les modules

  * Projets
  * Dossiers
  * Documents
  * Tâches
  * Temps
  * Finances
* Définir les permissions
* Définir les cas d'usage

## 0.2 Architecture technique

* Choix :

  * React Web
  * React Native Expo
  * Supabase
  * Turborepo
  * TypeScript
* Définir la structure du monorepo
* Définir les conventions de nommage
* Définir les types partagés

---

# Phase 1 — Monorepo

## 1.1 Création Turborepo

```bash
npx create-turbo@latest
```

## 1.2 Applications

### apps/web

* React
* Vite
* React Router

### apps/mobile

* Expo
* Expo Router

## 1.3 Packages

### packages/ui

Composants partagés :

* Button
* Input
* Modal
* Card
* Table

### packages/types

Interfaces :

```ts
Project
Folder
Document
Task
Role
Permission
User
```

### packages/supabase

Client Supabase partagé

### packages/utils

Fonctions :

```ts
formatDate()
formatMoney()
slugify()
```

## 1.4 Configuration

* ESLint
* Prettier
* TypeScript
* Path aliases

## 1.5 Validation

* Web démarre
* Mobile démarre
* Package partagé fonctionne

---

# Phase 2 — Supabase

## 2.1 Création projet

* Région Europe
* Activer PITR

## 2.2 Auth

* Email/password
* OAuth Google

## 2.3 Storage

Créer buckets :

### avatars

```txt
avatars/
```

### documents

```txt
projects/{projectId}/
```

### previews

```txt
previews/
```

## 2.4 Package partagé

Créer :

```ts
createClient()
```

pour :

* Web
* Mobile

## 2.5 Variables d'environnement

Web :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Mobile :

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

---

# Phase 3 — Base de données

## 3.1 Tables système

### profiles

```sql
id uuid
email
fullname
avatar_url
created_at
updated_at
```

---

### notifications

```sql
id
user_id
title
message
read_at
created_at
```

---

# Phase 4 — Gestion des projets

## projects

```sql
id
name
description
status
owner_id
created_at
updated_at
deleted_at
deleted_by
```

Fonctionnalités :

* créer
* modifier
* archiver
* supprimer logiquement

---

## project_members

```sql
project_id
user_id
role_id
joined_at
```

Fonctionnalités :

* invitation
* retrait
* changement rôle

---

# Phase 5 — Permissions

## roles

```sql
id
project_id
name
```

Exemples :

```txt
Admin
Manager
Collaborateur
Client
```

---

## role_permissions

```sql
role_id
permission
```

Exemple :

```txt
project.read
project.write
task.read
task.write
finance.read
finance.write
```

---

## Fonctions SQL

### has_project_permission()

```sql
has_project_permission(
  user_id,
  project_id,
  permission
)
```

---

### has_folder_access()

```sql
has_folder_access(
  user_id,
  folder_id
)
```

---

# Phase 6 — Arborescence documentaire

## folders

```sql
id
project_id
parent_id
name
deleted_at
deleted_by
```

Permet :

```txt
Projet
 ├─ Administratif
 ├─ Plans
 │   ├─ Version A
 │   ├─ Version B
 └─ Factures
```

---

## folder_permissions

```sql
folder_id
role_id
allow
```

---

# Phase 7 — Documents

## documents

```sql
id
folder_id
storage_path
filename
mime_type
size
version
created_by
deleted_at
deleted_by
```

Fonctionnalités :

### MVP

* upload
* download
* aperçu PDF
* suppression logique

### V2

* versioning
* OCR
* signatures

---

# Phase 8 — Tâches

## tasks

```sql
id
project_id
title
description
status
priority
assigned_to
start_date
due_date
completed_at
deleted_at
deleted_by
```

Statuts :

```txt
Todo
In Progress
Review
Done
```

Priorités :

```txt
Low
Medium
High
Critical
```

---

# Phase 9 — Temps

## time_entries

```sql
id
task_id
user_id
duration
date
validated
deleted_at
deleted_by
```

Fonctionnalités :

* encodage
* validation
* total projet
* total utilisateur

---

# Phase 10 — Finances

## financial_entries

```sql
id
project_id
type
amount
description
date
deleted_at
deleted_by
```

Types :

```txt
Expense
Invoice
Budget
```

---

# Phase 11 — Commentaires

## comments

```sql
id
author_id

project_id nullable
folder_id nullable
document_id nullable
task_id nullable

content

created_at
updated_at
deleted_at
deleted_by
```

---

# Phase 12 — Auth

## Fonctionnalités

* inscription
* connexion
* déconnexion
* reset password
* refresh token

## Middleware

Web :

```txt
PublicRoute
ProtectedRoute
AdminRoute
```

Mobile :

```txt
AuthGuard
```

---

# Phase 13 — Realtime

## Supabase Realtime

Canaux :

```txt
projects
tasks
comments
notifications
```

Événements :

```txt
INSERT
UPDATE
DELETE
```

---

# Phase 14 — Mobile MVP

## Écrans

### Auth

* Login
* Register

### Dashboard

* Mes projets

### Projet

* Arborescence

### Documents

* Liste
* Upload photo/PDF

### Tâches

* Liste
* Modification statut

---

# Phase 15 — Déploiement

## Web

Frontend :

* Vercel

Backend :

* [Supabase](https://supabase.com?utm_source=chatgpt.com)

---

## Mobile

* Android
* iOS

via [Expo EAS](https://expo.dev/eas?utm_source=chatgpt.com)

---

# Phase 16 — MVP terminé

À ce stade tu as déjà :

✅ Auth
✅ Gestion des projets
✅ Gestion des membres
✅ Permissions granulaires
✅ Dossiers hiérarchiques
✅ Documents
✅ Tâches
✅ Temps passé
✅ Finances
✅ Commentaires
✅ Notifications temps réel
✅ Application mobile

Pour MediTime, je ferais même une étape supplémentaire avant de coder : un schéma complet PostgreSQL + RLS + diagramme des permissions. Ça évite de devoir refaire toute la sécurité plus tard.
