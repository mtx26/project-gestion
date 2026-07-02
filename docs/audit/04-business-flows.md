# Parcours métier bout-en-bout (frontend → backend → DB)

> Ce document raccorde les traces frontend ([02-web.md](02-web.md)) et backend ([01-backend.md](01-backend.md))
> en parcours continus, du clic utilisateur jusqu'à la ligne en base de données et retour.
> Objectif : qu'un développeur comprenne un flux métier complet en quelques minutes.

---

## (a) Inscription + vérification email

**Objectif** : créer un compte, envoyer un email de confirmation, vérifier l'adresse.
**Résultat attendu** : `User` + `Profile` créés, `EmailAddress` allauth non-vérifiée, email envoyé et tracé via `EmailDelivery`.

1. **Frontend** — `apps/web/src/app/auth/register/page.tsx` : formulaire RHF + `zodResolver(registerSchema)` (`@project-gestion/validation`), état local `serverError`.
2. Soumission → `api.auth.register(payload)` (appel direct, pas de React Query — action ponctuelle) → `POST /api/accounts/register/`.
3. **Backend** — `accounts/urls.py` → `RegisterView` (`CreateAPIView`, `AllowAny`, throttle "register") → `RegisterSerializer`.
4. `validate_password` → `validate_email` → `validate_username` → `create()` (transaction atomique) : `User.objects.create_user`, `Profile.objects.get_or_create`, `EmailAddress.objects.get_or_create`, `send_confirmation()` (allauth) → `AccountAdapter.send_confirmation_mail` → `api/services/mail.py: send_email()` → crée une ligne `EmailDelivery` → `EmailMessage.send()` (Resend/Anymail ou console backend).
5. Réponse → `to_representation()` (enveloppe de message) → frontend affiche un message de succès et redirige vers `/auth/resend-verification` avec `registered: true`.
6. **Vérification** (requête séparée) : clic sur le lien de l'email → `apps/web/src/app/auth/verify-email/page.tsx` (lit `key` via `useSearchParams`, `Suspense`-wrappé) → `api.auth.verifyEmail(key)` → `POST /api/accounts/email/verify/` → `EmailVerificationConfirmView` → `EmailVerificationConfirmSerializer.validate/save` → `EmailConfirmationHMAC.confirm()` (allauth) → `EmailAddress.verified = True`.

**Fichiers traversés** : 2 (frontend) + 7 (backend) = 9. **Profondeur** : ~11 hops backend, appropriée pour un flux traversant 2 apps + une lib tierce (allauth).

---

## (b) Connexion + rafraîchissement JWT

1. **Frontend** — `apps/web/src/app/auth/login/page.tsx` : RHF + `loginSchema` → `api.auth.login(payload)` → `POST /api/accounts/login/`.
2. **Backend** — `LoginView` (étend `TokenObtainPairView`) → `LoginSerializer.validate()` : résout `identifier` (email ou username) → délègue à `TokenObtainPairSerializer.validate` (authentification + émission access/refresh) → vérifie `is_user_email_verified` si `ACCOUNT_EMAIL_VERIFICATION="mandatory"` → attache `user: UserSerializer(...).data`.
3. Réponse → frontend stocke les tokens (`webTokenStore`, `localStorage` + mémoire) via `useAuthStore.setTokens/setUser`.
4. **Refresh silencieux** : `RefreshTokenView` (étend `TokenRefreshView`, `AllowAny`) — comportement SimpleJWT par défaut, rotation désactivée par défaut (`ROTATE_REFRESH_TOKENS=False`).
5. Sur session invalide, `lib/api.ts`'s `onSessionInvalid` redirige vers `/auth/login` (`ProtectedRoute` prend le relais côté rendu).

**Fichiers traversés** : 2 + 4 = 6. **Profondeur** : ~6 hops. Simple, adapté.

---

## (c) Création de projet

1. **Frontend** — `components/dashboard/create-project-dialog.tsx` + `project-form.tsx` (déclenché depuis `ProjectWorkspaceShell`) — **seul dialogue du projet à ne pas avoir migré vers `FormDialog`/`FormSubmitButton`**, voir [02-web.md §5](02-web.md#5-duplications-identifiées).
2. `createProject.mutate(payload)` → `api.projects.create` → `POST /api/projects/`.
3. **Backend** — `ProjectListCreateView` (`IsAuthenticated` seul, pas de `HasProjectPermission` — l'accès est la queryset elle-même) → `ProjectSerializer` (validation simple) → `perform_create` force `owner=request.user` → `Project.objects.create(...)` (contrainte unique active `(owner, name)` en base).
4. Réponse sérialisée → `get_current_user_permission_codes` → `get_project_permission_codes` → court-circuit owner → tous les codes de permission renvoyés.
5. **Note de modélisation** : aucune ligne `ProjectMember` n'est créée pour l'owner — l'appartenance de l'owner est portée uniquement par la FK `Project.owner`. C'est pourquoi `ProjectMemberListView` doit synthétiser une ligne "owner" virtuelle (`_build_owner_entry`) pour l'affichage de la liste des membres.
6. Frontend : `onSuccess` invalide `queryKeys.projects.all`, ferme le dialogue, toast.

**Fichiers traversés** : 2 + 6 = 8. **Profondeur** : ~5 hops backend. Simple et approprié.

---

## (d) Création/édition de tâche

1. **Frontend** — `app/tasks/project-tasks-page-content.tsx` → ouverture de `TaskFormDialog` (`app/tasks/components/task-form-dialog.tsx`) — **fichier de référence de l'adoption des nouvelles abstractions** (`FormDialog`, `FormSubmitButton`, `DateRangeField`, `PrioritySelect` tous utilisés).
2. Champs : titre, dossier (`TreePickerDialog` mode folder), priorité (`PrioritySelect`), plage de dates (`DateRangeField`), assignés (`MemberCombobox` local), description, documents (`MultiDocumentAttachmentField` + `useDocumentAttachment`).
3. Soumission → upload des fichiers en attente (`docs.uploadPending` → `api.documents.upload` par fichier — voir flux (f) ci-dessous) → `onSubmit(payload)` → `createTask.mutate(payload)` / `updateTask.mutate(...)` → `api.tasks.create`/`.update` → `POST/PUT /api/projects/<id>/tasks/(<pk>/)`.
4. **Backend** — `TaskListCreateView`/`TaskDetailView` → `get_permissions()` → `permission_code="task.edit"` → `HasProjectPermission` → `get_accessible_projects` + `has_project_permission`.
5. `get_serializer_context()` résout le projet, injecté dans le contexte → `TaskSerializer.validate_assigned_to` → `services/members.py: get_project_assignable_users(project)` (restreint aux membres/owner).
6. `perform_create`/`perform_update` → `serializer.save(...)` → `TaskSerializer.create/update` → `Task(**validated_data)` → `full_clean()` → `.save()` → `assigned_to.set(...)`, `documents.set(...)` → **second `full_clean()` redondant** (voir [01-backend.md §12](01-backend.md#12-dette-technique--points-faibles)).
7. Réponse → frontend : `toast.success`, fermeture dialogue, `invalidateTasks(queryClient, projectId)` (`app/tasks/lib/filters.ts`) → invalide `queryKeys.tasks.all(projectId)`, rafraîchit `tasksQuery` et `myTasksQuery`.

**Fichiers traversés** : ~5 (frontend) + 8 (backend) = 13. **Profondeur totale** : ~19 hops. Point de complexité évitable identifié : le second `full_clean()` côté backend (redondant, voir §12 backend).

---

## (e) Création d'entrée de temps

1. **Frontend** — `app/time/page.tsx` → dialogue **manuel** `Dialog`/`DialogContent` (pas `FormDialog` — écart de migration identifié en [02-web.md §5](02-web.md#5-duplications-identifiées)) contenant `TimeEntryForm` (`app/time/components/time-entry-form.tsx`, état contrôlé par le parent, pas RHF).
2. `DateRangeField`, `TreePickerDialog` mode target (projet/dossier/tâche cible), upload de documents **réimplémenté localement** plutôt que via `useDocumentAttachment` (incohérence relevée dans l'audit web).
3. Soumission → `createTimeEntry.mutate(documentIds)` → calcule `duration_minutes` depuis la plage de dates → `api.timeEntries.create` → `POST /api/projects/<id>/time-entries/`.
4. **Backend** — `TimeEntryListCreateView` → `permission_code="time_entry.edit"` → chaîne `HasProjectPermission` habituelle → `TimeEntrySerializer.validate_user` → `get_project_assignable_users`.
5. `TimeEntrySerializer.create()` : si `hourly_rate` non fourni explicitement, résout via `ProjectMember.hourly_rate` puis repli `ProjectOwnerRate.hourly_rate` (**logique métier dans le serializer**, 2 requêtes conditionnelles) → `full_clean()` → `.save()` → `documents.set(...)`.
6. Réponse → frontend : `toast.success`, reset du formulaire, fermeture, `invalidateTimeQueries(queryClient, projectId)` → invalide `queryKeys.timeEntries.all(projectId)`.

**Fichiers traversés** : ~4 + 8 = 12. **Profondeur** : ~9 hops backend. Deux points de dette identifiés : dialogue non-migré côté frontend, dérivation de taux dans le serializer côté backend.

---

## (f) Upload / rattachement de document

Deux chemins distincts côté frontend, un seul chemin backend :

**Chemin A — via un champ de pièce jointe dans un formulaire** (tâches, finance, requêtes, édition de temps) :
1. `useDocumentAttachment(existingDocs)` (`lib/use-document-attachment.ts`) suit `pendingFiles`/`existingDocs`.
2. À la soumission : `docs.uploadPending(projectId, folder)` boucle sur `api.documents.upload(projectId, {file, folder})` par fichier.
3. `docs.getAllDocIds(newDocIds)` fusionne avec les IDs existants → payload `documents: number[]` envoyé avec la création/mise à jour de l'entité parente.
4. UI : `MultiDocumentAttachmentField` (composant partagé).

**Chemin B — upload direct dans l'arborescence de fichiers** (`app/files/project-files-page-content.tsx`) :
1. `<input type="file">` caché → `uploadDocument.mutate({file, folder: targetFolderId})` → `api.documents.upload` directement.
2. `onSuccess` : toast + `treeQuery.refetch()` (**refetch direct plutôt qu'invalidation `queryKeys`** — incohérence avec le reste de l'app).

**Backend (commun aux deux chemins)** — `POST /api/projects/<id>/documents/` → `DocumentListCreateView.create()` (override complet, pas `perform_create`) :
1. Vérifie `request.FILES.get("file")` (400 manuel si absent).
2. `get_object_or_404(get_accessible_projects(...), pk=project_id)`.
3. `_get_folder(request, project)` — helper au **type de retour mixte** (`Folder` ou `Response` d'erreur) — anti-pattern relevé en [01-backend.md §12](01-backend.md#12-dette-technique--points-faibles).
4. `api/services/storage.py: upload_document_file(file, project_id)` :
   - `validate_document_file` (taille/extension/mime) → `build_document_file_id` → `file.read()` en mémoire → tentative S3 (`upload_fileobj`).
   - **Sur échec de connexion S3/mauvaise config** : repli disque local, préfixe `local://` — voir l'analyse de risque complète en [01-backend.md §5](01-backend.md#api-servicesstoragepy--analyse-approfondie-repli-de-stockage-local).
5. Construction d'un **second** `DocumentSerializer` à partir des métadonnées retournées → validation → `save(project=project, **metadata)` → `Document.full_clean()` → `.save()`.

**Téléchargement** : `GET /.../documents/<pk>/download/` → `DocumentDownloadView` → `DocumentDownloadSerializer.to_representation` → `get_document_download_url` (URL locale ou présignée S3 selon le préfixe).

**Fichiers traversés** : ~4 (frontend) + 8 (backend) = 12. **Profondeur backend** : ~13 hops — **dépasse les seuils habituels**, en partie de façon justifiée (validation + double backend de stockage) et en partie évitable (double sérialisation, helper au type de retour mixte). Voir aussi le risque de production du repli de stockage local, documenté en détail dans [01-backend.md](01-backend.md).

---

## (g) Création/approbation de finance et de demande de remboursement

**Entrée financière (directe)** :
1. **Frontend** — `app/finance/page.tsx` → `FinancialEntryFormDialog` (`app/finance/components/finance-entry-dialogs.tsx`, schéma Zod local, `FormDialog`/`FormSubmitButton`/`TreePickerDialog`/`useDocumentAttachment`) → `createEntry.mutate` → `api.financialEntries.create` → `POST /api/projects/<id>/financial-entries/`.
2. **Backend** — `FinancialEntryListCreateView` → chaîne `HasProjectPermission` → `FinancialEntrySerializer.create()` → `full_clean()` (déclenche `FinancialEntry.clean()`, qui applique la règle "ne peut pas dépasser le solde de l'entrée de temps liée" via un calcul dupliqué 3× dans le code base, voir [01-backend.md §10](01-backend.md#10-duplications-identifiées)) → `.save()` → `documents.set(...)`.
3. Frontend : `toast.success`, invalide `queryKeys.financialEntries.all(projectId)`.

**Demande de remboursement — création** : chemin identique via `ExpenseRequestFormDialog`/`ExpenseRequestListCreateView`/`ExpenseRequestSerializer` — **structure quasi-identique** à l'entrée financière côté frontend (candidat à un composant générique, voir [02-web.md §5](02-web.md#5-duplications-identifiées)).

**Demande de remboursement — approbation** (le sous-flux le plus intéressant) :
1. **Frontend** — bouton "Approuver" (visible si `canApproveRequests`) → `approveRequest.mutate(req.id)` → `api.expenseRequests.approve` → `POST /.../expense-requests/<pk>/approve/`.
2. **Backend** — `ExpenseRequestApproveView` → `permission_code="expense_request.approve"` → `get_queryset()` restreint à `status=PENDING` (une demande déjà traitée renvoie 404 via `get_object()`, façon élégante d'imposer la machine à états).
3. `post()` (transaction atomique) : mute `status`/`approved_by`/`approved_at`, `.save()` — **sans passer par `full_clean()`**, seule dérogation du projet à cette validation systématique.
4. **Crée directement un `FinancialEntry`** via `.objects.create()` (copie folder/task/amount/category/title), copie le M2M `documents` — **logique métier en vue plutôt qu'en service** (aucun `services/expense_requests.py` n'existe).
5. Frontend : `onSuccess` invalide **à la fois** `queryKeys.expenseRequests.all` et `queryKeys.financialEntries.all` (invalidation cross-entité correctement câblée côté frontend malgré l'absence de service backend dédié).

**Fichiers traversés (approbation)** : ~2 + 6 = 8. **Profondeur** : ~6 hops backend, mais avec un problème de fond (contournement de `full_clean()`) plus important que la profondeur elle-même.

---

## (h) Réponse à une invitation

1. **Frontend** — notification (`app/notifications/page.tsx`) avec `type="project_invitation"` → `getInvitationToken(notification)` extrait `notification.data.token` → lien vers `/invitations/accept?token=...`.
2. `app/invitations/accept/page.tsx` (Suspense + `InvitationAcceptContent` + `InvitationAcceptPanel`) → `useEffect` (garde `hasStartedAccept` anti double-déclenchement) → `acceptInvitation.mutate(token)` → `api.invitations.accept(token)` → `POST /api/invitations/accept/`.
3. **Backend** — `InvitationAcceptView` → `InvitationAcceptSerializer.create()` → `services/invitations.py: accept_project_invitation(token, user)` :
   - Pré-vérification hors transaction (lookup, branche invitation annulée/expirée/email non-correspondant, chacune avec `_dismiss_invitation_notification`).
   - `transaction.atomic()` : re-fetch avec **`select_for_update()`** (verrou de ligne, protection contre les races d'acceptation concurrente), re-validation, branche d'idempotence (déjà acceptée → retour sans erreur).
   - `_get_or_create_project_member` → `ProjectMember.objects.get_or_create` → `full_clean()`.
   - `invitation.accepted_at` défini, sauvegardé.
   - `_dismiss_invitation_notification` (marque l'invite comme traitée) + `notify(user=invitation.invited_by, type="project_invitation_accepted", ...)` → `Notification.objects.create`.
4. Réponse `{invitation, member}` re-sérialisée → frontend invalide `queryKeys.projects.all` (nouveau projet visible) et `queryKeys.notifications.all`, affiche une carte de succès.

**Fichiers traversés** : ~2 + 6 = 8. **Profondeur** : ~10 hops backend — **le flux le plus profond du projet, mais explicitement justifié** par de vraies exigences de sécurité de concurrence (races d'acceptation) et d'idempotence. Ce n'est pas un exemple de sur-ingénierie ; c'est l'exemple à suivre pour le reste du code base.

**Côté création d'invitation** (owner/admin) : `MembersSettingsTab` → `inviteMember.mutate()` → `api.invitations.create` → `InvitationListCreateView` → `InvitationCreateSerializer.create` → `services/invitations.py: create_project_invitation` (nettoyage des invitations périmées, re-vérification anti-doublon, branche email-existant→notification / email-inconnu→email).

---

## (i) Gestion des rôles/permissions dans les paramètres

1. **Frontend** — `/settings?tab=roles` → `ProjectSettingsPage` → `ProjectSettingsContent` → `RolesSettingsTab` (`useQuery(queryKeys.roles.list)`) + `permissionsQuery` (`queryKeys.permissions.list`, chargée une fois au niveau parent, passée en prop pour éviter une double requête).
2. "Nouveau rôle" → `RoleFormDialog` (`FormDialog`/`FormSubmitButton`, entièrement contrôlé par le parent — pas de RHF/Zod interne). Cases à cocher de permission groupées par portée via `groupPermissionsByScope` (`@project-gestion/permissions`), logique de dépendance via `normalizePermissionIds`/`removePermissionIdWithDependents` — **correctement extraite dans le package partagé, pas dupliquée côté app**.
3. Soumission → `createRole.mutate()`/`updateRole.mutate()` → `api.roles.create`/`.update(projectId, roleId, buildRolePayload(name, normalizedIds))` → `POST/PUT /api/projects/<id>/roles/(<pk>/)`.
4. **Backend** — `RoleListCreateView`/`RoleDetailView` → chaîne `HasProjectPermission` habituelle → `RoleSerializer.create/update` (transaction atomique) → `_set_permissions()` : supprime toutes les `RolePermission` existantes et les recrée après expansion des dépendances via `services/permissions.py: expand_permissions`.
5. Frontend : `onSuccess` invalide `queryKeys.roles.list(projectId)`.
6. **Suppression de rôle** : `deleteRole.mutate(roleId)` → invalide **à la fois** `queryKeys.roles.list` et `queryKeys.members.list` (les membres utilisant le rôle supprimé deviennent "sans rôle" — invalidation croisée correcte).
7. **Assignation de rôle à un membre** (chemin séparé) : `MembersSettingsTab` → `updateMemberRole.mutate({memberId, roleId})` → `api.members.update` → `ProjectMemberDetailView.perform_update` — **contient ~30 lignes de logique d'autorisation fine embarquée dans la vue** (branches `changing_role`/`changing_rate`/`is_own`), voir [01-backend.md §12](01-backend.md#12-dette-technique--points-faibles).

**Note backend** : **pas de routes trash/restore pour les rôles** malgré l'existence du service `get_deleted_project_roles` — fonctionnalité probablement incomplète (voir [01-backend.md §11](01-backend.md#11-code-mort-identifié)).

**Fichiers traversés** : ~4 + 6 = 10. **Profondeur** : ~7 hops backend pour la mutation de rôle simple ; le sous-flux d'autorisation de membre est significativement plus complexe que sa profondeur ne le suggère.

---

## (j) Notifications — création et livraison

**Chemin de création — seulement 2 déclencheurs dans tout le projet, tous deux dans `services/invitations.py`** :
1. Invitation créée vers un email déjà associé à un `User` → `notify(type="project_invitation", ...)`.
2. Invitation acceptée → `notify(type="project_invitation_accepted", ...)`.

`notify()` (`services/notifications.py`) → `Notification.objects.create(...)`. Aucun autre flux métier (assignation de tâche, paiement de temps, création/approbation financière) ne déclenche de notification, malgré une infrastructure générique (`type`/`data` JSONField) qui le permettrait. **Gap fonctionnel plutôt que défaut de code** — voir [01-backend.md §13(i)](01-backend.md#13-parcours-métier-bout-en-bout-backend).

**Lecture** : `NotificationListView` (filtre `unread`), `NotificationUnreadCountView`, `NotificationMarkReadView`/`NotificationMarkAllReadView` (mutations directes `.update()`, pas de service).

**Pas de mécanisme de livraison temps réel** (pas de websocket/push trouvé) — modèle in-app, pull uniquement, interrogé par le frontend. `EmailDelivery`/Resend est un concept **séparé** (email transactionnel), non connecté à `Notification`.

---

## Synthèse des profondeurs de flux

| Flux | Fichiers (FE+BE) | Hops (BE) | Statut |
|---|---|---|---|
| (a) Inscription + vérification | 9 | ~11 | Justifié |
| (b) Login + refresh | 6 | ~6 | Simple |
| (c) Création de projet | 8 | ~5 | Simple |
| (d) Création de tâche | 13 | ~10 | À la limite — `full_clean()` redondant |
| (e) Entrée de temps | 12 | ~9 | Dialogue non-migré (FE) + logique de taux dans serializer (BE) |
| (f) Upload de document | 12 | ~13 | **Dépasse les seuils** — double sérialisation, helper mixte |
| (g) Approbation de demande | 8 | ~6 | Contournement `full_clean()` — problème de fond |
| (h) Acceptation d'invitation | 8 | ~10 | Le plus profond, **mais justifié** (concurrence) |
| (i) Gestion rôles/permissions | 10 | ~7 | Feature rôles trash/restore incomplète |
| (j) Notifications | 3 | ~3 | Sous-utilisé fonctionnellement |
