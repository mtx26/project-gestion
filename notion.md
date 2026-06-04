# Phase 1 — Architecture

1. Initialiser le monorepo Turborepo
2. Créer apps/web
3. Créer apps/mobile
4. Créer packages/ui
5. Créer packages/types
6. Créer packages/supabase
7. Créer packages/utils
8. Configurer TypeScript
9. Vérifier que web et mobile démarrent

# Phase 2 — Supabase

1. Créer le projet Supabase
2. Configurer Auth
3. Configurer Storage
4. Connecter web à Supabase
5. Connecter mobile à Supabase
6. Créer le package partagé Supabase

# Phase 3 — Base de données

1. Créer profiles
2. Créer projects
3. Créer project_members
4. Créer roles
5. Créer role_permissions
6. Créer folders
7. Créer folder_permissions
8. Créer documents
9. Créer tasks
10. Créer time_entries
11. Créer financial_entries
12. Créer comments
13. Créer notifications

Toutes les tables métier utilisent deleted_at et deleted_by.

# Phase 4 — Auth

1. Inscription
2. Connexion
3. Mot de passe oublié
4. Création automatique du profile
5. Protection des routes

# Phase 5 — Projet

1. Création projet
2. Liste projets
3. Modification projet
4. Archivage projet
5. Gestion membres

# Phase 6 — Permissions

1. Création rôles
2. Attribution rôles
3. Permissions par module
4. Fonction has_folder_access()
5. Inclusion utilisateur
6. Exclusion utilisateur
7. Inclusion rôle
8. Exclusion rôle
9. RLS Supabase

# Phase 7 — Dossiers

1. Création dossier
2. Sous-dossiers
3. Arborescence
4. Permissions dossiers

# Phase 8 — Documents

1. Upload
2. Téléchargement
3. Prévisualisation
4. Permissions documents

# Phase 9 — Tâches

1. Création tâche
2. Assignation
3. Priorité
4. Statut
5. Échéances
6. Vue calendrier basée sur les tâches

# Phase 10 — Horaires

1. Encodage heures
2. Validation heures
3. Totaux

# Phase 11 — Finances

1. Dépenses
2. Factures
3. Budgets
4. Permissions finances

# Phase 12 — Commentaires

1. Commentaires projets
2. Commentaires dossiers
3. Commentaires documents
4. Commentaires tâches

# Phase 13 — Notifications

1. Notifications internes
2. Realtime Supabase

# Phase 14 — Mobile

1. Auth mobile
2. Projets mobile
3. Dossiers mobile
4. Documents mobile
5. Tâches mobile

# Phase 15 — Déploiement

1. Déploiement web
2. Configuration production
3. Tests complets
4. Publication MVP