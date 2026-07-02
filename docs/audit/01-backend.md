# Backend Django — Inventaire technique

> Périmètre : `apps/backend/` — Django 6 + DRF + SimpleJWT + django-allauth + Anymail(Resend) + S3(boto3).
> Fichiers de migration exclus. `api/tests.py` (5935 lignes) survolé par nom de classe uniquement (hors périmètre d'inventaire fonctionnel).
> Voir [00-overview.md](00-overview.md) pour le contexte général.

---

## 1. Cartographie des modules

| App | Responsabilité | Fichiers clés |
|---|---|---|
| **core** | Abstraction de base partagée (`BaseModel` soft-delete), pagination | `core/models.py`, `core/pagination.py` |
| **accounts** | Profil utilisateur, auth complète (register/login/JWT/reset/verify/Google OAuth), photo de profil | `accounts/{models,serializers,views,services,adapters,urls}.py` |
| **api** | Domaine métier complet : projets, rôles/permissions, membres, dossiers, documents, tâches, temps, finances, demandes, invitations, notifications, suivi email | `api/models.py`, `api/serializers.py`, `api/views/*.py` (11 fichiers), `api/services/*.py` (9 fichiers), `api/permissions.py`, `api/urls.py` |
| **config** | Configuration Django | `config/{settings,urls,wsgi,asgi}.py` |

**Sens des dépendances inter-apps** (vérifié par grep) :
- `core` ne dépend de rien — feuille correcte.
- `accounts → api.services.{mail,storage}` (accounts/adapters.py, accounts/services.py, accounts/views.py).
- `api → accounts.serializers.UserSerializer` (api/views/users.py).
- **Couplage bidirectionnel `accounts ↔ api`** : ce n'est pas un cycle d'import Python strict, mais les deux apps "pairs" se dépendent mutuellement au lieu d'être strictement superposées. `mail`/`storage` (utilisés par `accounts`) seraient mieux placés dans `core` ou un module de services transverse.
- `config` importe `accounts.urls` et `api.urls`, et référence par chaîne pointée `accounts.serializers.UserSerializer` / `accounts.adapters.AccountAdapter` dans les settings.

**Fait notable** : `django-guardian` figure dans `requirements.txt` mais est **absent d'`INSTALLED_APPS`** et **jamais importé** nulle part dans le code (confirmé par grep global). Le système d'autorisation est entièrement fait-maison (`Role`/`Permission`/`RolePermission`/`ProjectMember`). Dépendance morte — voir §11.

---

## 2. Inventaire des modèles

Tous héritent de `core.BaseModel` (soft-delete : `created_at`, `updated_at`, `deleted_at`, `deleted_by`, managers `objects`/`deleted_objects`/`all_objects`) **sauf** `Permission` et `ProjectOwnerRate` (tables de référence/singleton, pas de soft-delete).

### `accounts/models.py`
- **`Profile`** — `user` (O2O→User CASCADE), `picture_url`, `default_hourly_rate` (Decimal 10,2), `default_project` (FK→`api.Project` SET_NULL, `related_name="+"`).

### `api/models.py`
- **`Project`** — `owner` (FK→User CASCADE), `name`, `description`. Contrainte unique active `(owner, name)`.
- **`Role`** — `project` (FK CASCADE), `name`, `description`. Unique active `(project, name)`.
- **`Permission`** (pas de BaseModel) — `name`, `description`, `code` (unique). Catalogue statique.
- **`RolePermission`** — `role`/`permission` (FK CASCADE). Unique active `(role, permission)`.
- **`ProjectMember`** — `project`/`user`/`role` (FK CASCADE), `hourly_rate`. `clean()` : le rôle doit appartenir au même projet. Unique active `(project, user)`.
- **`ProjectOwnerRate`** (pas de BaseModel) — O2O→Project (`related_name="owner_rate"`), `hourly_rate`. Aucune trace d'audit (pas de `created_at`/`updated_at`).
- **`Folder`** — `project` (CASCADE), `parent_folder` (self-FK CASCADE), `created_by` (SET_NULL), `name`, `description`, `color`, `icon`. `clean()` : rejette l'auto-parenté, le parent cross-projet, les cycles (remontée avec `visited_ids`). Propriété `is_root`. Deux contraintes uniques conditionnelles (nom sous un parent donné / nom de racine).
- **`Document`** — `project` (CASCADE), `folder` (SET_NULL), `file_id` (unique — clé de stockage), `file_name`, `file_size`, `mime_type`. `clean()` : cohérence folder/projet.
- **`Task`** — `Status`/`Priority` en `TextChoices`. `project`, `folder` (SET_NULL), `created_by` (SET_NULL), `assigned_to` (M2M User), `documents` (M2M), dates indexées. `clean()` : cohérence folder/projet, `start_date <= end_date`.
- **`Invitation`** — `project`, `email`, `role`, `invited_by` (CASCADE), `token` (unique), `expires_at`, `accepted_at`. Unique active `(project, email)` scopée aux invitations non acceptées.
- **`Notification`** — `user` (CASCADE), `project` (SET_NULL), `created_by` (SET_NULL), `type`, `data` (JSON), `is_read` (indexé).
- **`EmailDelivery`** — `Status` (TextChoices, 9 valeurs), `provider` (défaut "resend"), `provider_message_id`, timestamps par événement (`sent_at`, `delivered_at`, `bounced_at`...).
- **`TimeEntry`** — `project`, `folder`/`task` (SET_NULL, **mutuellement exclusifs**), `user` (SET_NULL), `duration_minutes`, `hourly_rate`. `clean()` : exclusivité folder/task + cohérence projet.
- **`FinancialEntry`** — `FinancialType` (expense/refund). `project`, `folder`/`task` (exclusifs), `time_entry` (SET_NULL), `amount`, `type` (indexé). `clean()` : règle métier — si lié à un `time_entry` et type=expense, `paid_amount + amount <= cost_amount` via `_get_time_entry_cost_amount`/`_get_time_entry_paid_amount_excluding_self` (boucle Python, voir §12).
- **`ExpenseRequest`** — constantes de statut en attributs de classe (**pas** `TextChoices`, incohérent avec `Task`/`FinancialEntry`/`EmailDelivery`). `project`, `task`/`folder` (exclusifs), `status`, `requested_by`/`approved_by` (SET_NULL). Seul modèle avec `Meta.ordering` explicite (`["-created_at"]`).

---

## 3. Inventaire des serializers

Tous dans `api/serializers.py` (1122 lignes, fichier monolithique) et `accounts/serializers.py`. Constante partagée `BASE_READ_ONLY_FIELDS`.

### `accounts/serializers.py`
`ProfileSerializer`, `UserSerializer` (nest Profile + `email_verified` via `is_user_email_verified`), `LoginSerializer` (étend `TokenObtainPairSerializer` — résout `identifier` email/username, impose vérification email obligatoire), `CurrentUserUpdateProfileSerializer`/`CurrentUserUpdateSerializer` (update atomique User+Profile), `LogoutSerializer` (blacklist du refresh token), `PasswordResetSerializer` (anti-énumération, no-op silencieux), `PasswordResetConfirmSerializer`, `PasswordChangeSerializer` (les deux blacklistent tous les refresh tokens via `blacklist_user_refresh_tokens`), `EmailVerificationConfirmSerializer`, `ResendEmailVerificationSerializer`, `RegisterSerializer` (génération de username avec résolution de collision, création atomique User+Profile+EmailAddress), `ProfilePictureUploadSerializer`.

### `api/serializers.py`
`ProjectSerializer` (`get_current_user_permission_codes` → 1 requête permission **par ligne**, voir N+1 en §12), `PermissionSerializer`, `RoleSerializer` (`_set_permissions` : delete+recreate `RolePermission` avec expansion des dépendances), `ProjectMemberSerializer`, `FolderSerializer`/`DocumentSerializer`/`TaskSerializer`/`FinancialEntrySerializer`/`ExpenseRequestSerializer` (pattern `full_clean()` + traduction d'exception dupliqué 6× — voir §10), `FolderTreeNodeSerializer`/`FolderTreeSerializer`/`FolderTargetTreeSerializer` (délèguent entièrement à `services.folders.build_folder_tree`), `DocumentUploadSerializer`, `DocumentDownloadSerializer` (délègue à `get_document_download_url`), `TaskSerializer` (double `full_clean()`, transition `completed_at` en `update()` — logique métier dans le serializer), `InvitationSerializer`/`InvitationCreateSerializer`/`InvitationAcceptSerializer`, `NotificationSerializer`, `TimeEntrySerializer` (calcul `cost_amount`/`paid_amount`/`remaining_amount` dupliqué 3× dans le code base — voir §10 ; auto-dérivation du taux horaire dans `create()`), `TimeEntryPaymentSerializer` (3ᵉ copie du calcul de solde, catégorie "Main d'oeuvre" hardcodée en français), `FinancialEntrySerializer`, `ExpenseRequestSerializer`, 5 serializers de sortie pour le endpoint graphique financier.

---

## 4. Inventaire des vues

Toutes basées sur `generics.*APIView` (**aucun ViewSet/Router** dans tout le projet). Chaque vue projet-scopée utilise `[IsAuthenticated, HasProjectPermission]` avec `permission_code` positionné dynamiquement dans `get_permissions()` selon la méthode HTTP — pattern répété dans ~25 classes (voir §10).

- **`accounts/views.py`** : `RegisterView`, `LoginView`, `RefreshTokenView`, `LogoutView` (pas d'authentification requise, juste un refresh token valide), `PasswordResetView`/`PasswordResetConfirmView`/`PasswordChangeView`, `EmailVerificationConfirmView`/`ResendEmailVerificationView`, `GoogleLoginView` (force la vérification email OAuth), `CurrentUserDetailView`, `CurrentUserProfilePictureView` (upload + nettoyage best-effort de l'ancienne photo, échecs avalés silencieusement).
- **`api/views/projects.py`** : `ProjectListCreateView`, `ProjectDetailView` (vérification de propriété dupliquée en dur dans `perform_destroy`), `ProjectRestoreView`, `ProjectTrashListView`.
- **`api/views/roles.py`** : `RoleListCreateView`, `RoleDetailView`, `PermissionListView`. **Pas de trash/restore pour les rôles** — incohérence avec toutes les autres ressources (voir §11).
- **`api/views/members.py`** : `ProjectMemberListView` (synthétise une ligne "owner" virtuelle via `_build_owner_entry`, dupliquée dans le code paginé/non-paginé), `ProjectMemberDetailView` (`perform_update` contient ~30 lignes de logique d'autorisation fine ; `perform_destroy` fait un nettoyage cascadé multi-modèles de 4 FK), `ProjectOwnerRateView` (`APIView` brut, validation manuelle sans serializer).
- **`api/views/users.py`** : `UserListView` — **aucune restriction projet**, tout utilisateur authentifié peut lister tous les utilisateurs du système (à valider côté produit).
- **`api/views/invitations.py`** : `InvitationListCreateView`, `InvitationDetailView`, `InvitationAcceptView` (délègue entièrement au service).
- **`api/views/notifications.py`** : `NotificationListView`, `NotificationUnreadCountView`, `NotificationMarkReadView`, `NotificationMarkAllReadView` (mutations directes sans service).
- **`api/views/folders.py`** : CRUD standard + `FolderTreeView`/`FolderTargetTreeView` (logique dupliquée entre les deux, voir §10).
- **`api/views/documents.py`** : `DocumentListCreateView.create()` (override complet, mélange raise/Response manuelle, helper `_get_folder` qui retourne soit un `Folder` soit une `Response` — anti-pattern), `DocumentDetailView.perform_destroy` (soft-delete uniquement — **ne nettoie jamais le stockage**), `DocumentDownloadView`.
- **`api/views/tasks.py`** : `TaskFilter` (couplage fragile entre `filter_date_from`/`filter_date_to`, dépendant de l'ordre d'évaluation django-filter), `TaskListCreateView` (annotations `Case/When` pour tri stable, prefetch correct).
- **`api/views/time_entries.py`** : fonctions de niveau module `_annotate_financial_fields`/`apply_time_entry_financial_filters` (logique métier hors service), restriction "propres entrées seulement" dupliquée 3× (list/detail/stats).
- **`api/views/financial_entries.py`** : `FinancialEntryChartView` — la vue la plus complexe du projet (6 méthodes privées, agrégation **en Python** plutôt qu'en SQL).
- **`api/views/expense_requests.py`** : `_expense_request_qs` (bon exemple de dédup interne). `ExpenseRequestApproveView.post()` crée directement un `FinancialEntry` dans la vue, **sans `full_clean()`** (seule écriture de ce type dans tout le code base à contourner la validation modèle).

---

## 5. Inventaire des services (`api/services/*.py`)

| Fichier | Fonctions | Observations |
|---|---|---|
| `permissions.py` | `get_permissions`, `expand_permission_codes`, `expand_permissions`, `has_project_permission` (~10+ appelants, primitive centrale), `get_project_permission_codes` | Cœur de l'autorisation |
| `projects.py` | `get_accessible_projects` (~30+ appelants, primitive la plus utilisée du code base), `get_accessible_deleted_projects`, `is_project_member` (**0 appelant — mort**) | |
| `roles.py` | `get_project_roles`, `get_deleted_project_roles` (**0 appelant — mort**, corrélé à l'absence de vues trash/restore rôles) | Feature incomplète probable |
| `members.py` | `get_project_members`, `get_project_assignable_users` (importé localement dans les serializers plutôt qu'en haut de fichier) | |
| `invitations.py` | `normalize_invitation_email`, `get_project_invitations`, `create_project_invitation` (complexe, transactionnel), `accept_project_invitation` (**la fonction la mieux conçue du projet** — `select_for_update`, idempotence, gestion de race condition), 4 helpers privés | Référence qualité |
| `folders.py` | `get_descendant_folder_ids` (BFS, 6 appelants), `build_document_tree_node`/`build_task_tree_node`, `build_folder_tree` | |
| `notifications.py` | `notify` (seulement 2 appelants, tous deux dans `invitations.py` — sous-utilisé, voir §13i) | |
| `mail.py` | `send_email` (crée une ligne `EmailDelivery`, gère templates Resend, ré-lève l'exception en cas d'échec), `_sanitize_resend_tag_value` | |
| `time_entries.py` | `compute_time_entry_stats` (agrégation SQL correcte, contraste avec les calculs Python dupliqués côté serializers) | |
| **`storage.py`** | Voir détail dédié ci-dessous | Fichier modifié récemment (git status) |
| — | **Aucun `services/financial_entries.py` ni `services/expense_requests.py`** | Incohérence structurelle : toutes les autres ressources majeures ont un module de service dédié |

### `api/services/storage.py` — analyse approfondie (repli de stockage local)

**Constantes** : `LOCAL_STORAGE_PREFIX = "local://"`.

**Fonctions publiques** : `get_s3_client()` (lève `ImproperlyConfigured` si config S3 incomplète, pas de mise en cache du client), `build_document_file_id`/`build_profile_picture_file_id` (clés UUID namespacées, assainissement du nom de fichier via `PurePosixPath(...).name`), `build_s3_object_url` (URL directe, **profil uniquement** — les documents utilisent toujours des URLs présignées), `validate_document_file`/`validate_profile_picture_file` (quasi-identiques, voir §10), `upload_document_file`/`upload_profile_picture_file`, `get_document_file` (**mort, 0 appelant, non compatible `local://`**), `delete_document_file` (**mort, 0 appelant**), `delete_profile_picture_file` (utilisé), `get_document_download_url` (compatible local/S3).

**Comportement du repli, étape par étape** :
1. Upload : lecture intégrale du fichier en mémoire (`file.read()`), tentative S3 via `upload_fileobj`.
2. Sur `ImproperlyConfigured` ou `botocore.exceptions.ConnectionError` (**pas** la famille plus large `ClientError` — une erreur d'accès refusé ou de bucket inexistant sur un S3 pourtant joignable ne déclenche PAS le repli et remonte en 500 non gérée) : écriture sur disque local (`MEDIA_ROOT/{file_id}`), préfixage `local://`.
3. Toutes les opérations aval (`delete_*`, `get_document_download_url`) branchent sur le préfixe.
4. Le fichier n'est servi que si `DEBUG=True` (`config/urls.py` monte `static(MEDIA_URL, ...)`, qui est un no-op en production).

**Risque critique confirmé par `git diff HEAD`** : la version committée à `3f4faa4` avait un garde `if not settings.DEBUG: raise` après le repli — le repli ne s'activait qu'en dev, et en production une panne S3 faisait échouer l'upload bruyamment. **Le garde a été supprimé dans la version en cours de modification.** Effet net : une panne S3 en production fera désormais échouer silencieusement vers le disque local plutôt que d'échouer proprement.

**Risques identifiés** :
1. **Dégradation silencieuse en production** — fichiers écrits sur le disque local du conteneur, invisibles aux autres instances, perdus au redéploiement (stockage éphémère typique).
2. **`MEDIA_URL` non servi en production** — même sur l'instance qui a écrit le fichier, l'URL de téléchargement renverra un 404 permanent.
3. **Aucune tâche de réconciliation** — aucun mécanisme ne re-uploade vers S3 une fois disponible ; les fichiers restent en local indéfiniment.
4. **Pas d'atomicité** entre écriture du fichier et écriture DB — un échec de sauvegarde du modèle après upload laisse un fichier orphelin (aggravé par le fait que `delete_document_file` est mort).
5. **Catch d'exception trop étroit** — masque des modes d'échec S3 réels (permissions, bucket manquant) qui devraient être traités différemment d'une simple indisponibilité réseau.
6. **Aucune alerte** — seul un `logger.warning` signale le repli ; aucune métrique, aucun tracking d'erreur (pas de Sentry configuré dans ce projet).

**Recommandation d'audit** (ne constitue pas une modification) : réintroduire le garde `if not settings.DEBUG: raise` (ou un flag de fonctionnalité explicite) avant la mise en production de ce changement, sauf si un stockage partagé et persistant a été provisionné séparément pour `MEDIA_ROOT` — rien dans les settings/urls actuels n'indique que c'est le cas.

---

## 6. Permissions

**`api/permissions.py: HasProjectPermission`** — seule classe de permission DRF personnalisée du projet.
- `has_permission()` : résout `project_id` depuis `view.kwargs`, autorise si absent (pas de scoping projet) ; sinon résout le projet via `get_accessible_projects(include_deleted=True)` (permet aux endpoints de restauration de fonctionner sur un projet soft-deleted) ; si `permission_code` est `None`, accès accordé dès que le projet est accessible ; sinon délègue à `has_project_permission`.
- `has_object_permission()` : même logique au niveau objet.

**Modèle** : `Project.owner` est **implicitement super-utilisateur** (court-circuite le système de rôle) — codé en dur dans `has_project_permission` ET `get_project_permission_codes`. L'owner n'apparaît jamais dans `ProjectMember` sauf ajout explicite (d'où la nécessité de `_build_owner_entry` pour la liste des membres).

**`django-guardian`** : présent dans `requirements.txt`, absent d'`INSTALLED_APPS`, jamais importé — dépendance totalement inutilisée. À signaler pour suppression ou clarification (migration abandonnée ?). La table CLAUDE.md du dépôt liste pourtant `django-guardian` comme faisant partie de la stack active — écart de documentation à corriger.

---

## 7. URLs

Deux fichiers `urls.py` plats, **aucun DRF router** (`DefaultRouter`/`SimpleRouter`) nulle part — chaque endpoint est un `path()` explicite. Convention cohérente et uniforme (`projects/<id>/<ressource>/`, `.../trash/`, `.../<pk>/restore/`).

**Bug de nommage confirmé** : `FolderListCreateView`, `FolderDetailView`, `FolderTrashListView` et `FolderRestoreView` partagent **tous les quatre** le même `name="project-folders"` dans `api/urls.py` (lignes 99-104). `reverse("project-folders")` est ambigu (Django résout au dernier enregistré). Toutes les autres familles de ressources nomment chaque route distinctement — Folders est l'exception. **Risque fonctionnel réel, pas seulement cosmétique.**

**Gap de fonctionnalité** : pas de routes trash/restore pour `Role`, alors que `get_deleted_project_roles` existe en service et que des classes de test `RoleTrashRoutePermissionTests`/`RoleRestoreRoutePermissionTests` existent dans `api/tests.py` — indique une fonctionnalité commencée puis jamais branchée (ou retirée sans nettoyage).

---

## 8. Commandes de management

Une seule : **`seed_project`** (`api/management/commands/seed_project.py`). Génère des données de démo réalistes en français (dossiers, tâches, temps, finances, demandes) pour un projet donné, via `bulk_create` + passe `update(created_at=...)` post-hoc (contournement nécessaire de la limitation `bulk_create`/`auto_now_add`, répété 3× — acceptable pour un outil dev). Outil de développement pur, aucune dépendance runtime.

---

## 9. Settings / configuration

`config/settings.py` — `django-environ`, lit `.env` à la racine du monorepo. Apps installées standard + `rest_framework`, `simplejwt.token_blacklist`, `drf_spectacular`, `anymail`, `corsheaders`, `allauth` (+google), `dj_rest_auth`, `django_filters`. **`guardian` absent** (voir §6).

**Sécurité par défaut** : `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]` — posture "secure by default", les endpoints doivent explicitement opter pour `AllowAny`.

**Throttling** : 9 scopes nommés (login/register/password reset-confirm-change/email verify-resend/google login/photo de profil), chacun configurable par variable d'environnement.

**JWT** : access 15 min, refresh 7 jours, rotation désactivée par défaut (`ROTATE_REFRESH_TOKENS=False`) mais `BLACKLIST_AFTER_ROTATION=True` — ce dernier réglage est inerte tant que la rotation n'est pas activée.

**drf-spectacular** : `POSTPROCESSING_HOOKS` **commenté** dans `SPECTACULAR_SETTINGS` — `api/schema.py: add_error_responses` est écrit et correct mais jamais exécuté (code mort par désactivation explicite, voir §11).

**Garde fail-fast** : lève `ImproperlyConfigured` au chargement si `EMAIL_BACKEND` pointe vers Resend sans `RESEND_API_KEY` — bonne pratique.

---

## 10. Duplications identifiées

1. **Switch `permission_code` par méthode HTTP dans `get_permissions()`** — répété quasi à l'identique dans ~25 classes de vues à travers `roles.py`, `members.py`, `invitations.py`, `folders.py`, `documents.py`, `tasks.py`, `time_entries.py`, `financial_entries.py`, `expense_requests.py`, `projects.py`. Candidat fort pour un attribut déclaratif de classe consommé par un mixin partagé.
2. **`if getattr(self, "swagger_fake_view", False): return X.objects.none()`** — 30+ occurrences en tête de `get_queryset()`.
3. **Vue de restauration en 3 lignes** (`get_object()` → `restore()` → `Response`) — dupliquée verbatim dans 7 vues (Project, Folder, Document, Task, TimeEntry, FinancialEntry, ExpenseRequest). Candidat pour une classe générique `RestoreAPIView`.
4. **`perform_destroy(self, instance): instance.soft_delete(self.request.user)`** — dupliqué verbatim dans 8 vues.
5. **`documents_info` SerializerMethodField** — même comprehension de liste dupliquée dans 4 serializers (Task, TimeEntry, FinancialEntry, ExpenseRequest).
6. **Calcul argent (coût/payé/restant d'un `TimeEntry`)** — implémenté **3 fois indépendamment** : `FinancialEntry` (modèle), `TimeEntrySerializer`, `TimeEntryPaymentSerializer`. Risque de dérive si la formule change (ex. règles d'arrondi).
7. **`_get_user_display_name`** — dupliqué entre `api/serializers.py` (privé) et `api/utils.py` (public, `get_user_display_name`) — deux fonctions identiques, deux modules différents, utilisées à des endroits différents.
8. **`FolderTreeView` vs `FolderTargetTreeView`** — structure de fetch/serialize très similaire.
9. **`ProjectMemberListView.list()`** — logique `_build_owner_entry` dupliquée entre branche paginée et non-paginée dans la même méthode.
10. **`validate_document_file`/`validate_profile_picture_file`** et **`upload_document_file`/`upload_profile_picture_file`** — structure quasi-identique (voir §5).
11. **`filter_folder` dans 5 FilterSet** (Document, Task, TimeEntry, FinancialEntry, ExpenseRequest) — même 4 lignes de délégation à `get_descendant_folder_ids`. Candidat pour un mixin `FolderScopedFilterMixin`.
12. **Motif "fetch projet accessible + vérification manuelle d'ownership"** — répété indépendamment dans `ProjectDetailView.perform_destroy`, `ProjectRestoreView.post`, `ProjectOwnerRateView._get_project`.

---

## 11. Code mort identifié

*(Confirmé par grep global, sans appelant trouvé en dehors de la définition ; hypothèse conservative — pourrait théoriquement être appelé dynamiquement, mais aucun mécanisme du framework ne le justifie ici.)*

| Symbole | Fichier | Constat |
|---|---|---|
| `get_document_file` | `api/services/storage.py` | 0 appelant. Également non compatible `local://` — incohérent avec ses fonctions sœurs. |
| `delete_document_file` | `api/services/storage.py` | 0 appelant. Cause directe du non-nettoyage du stockage lors des suppressions. |
| `is_project_member` | `api/services/projects.py` | 0 appelant. Probablement supplanté par `has_project_permission`. |
| `get_deleted_project_roles` | `api/services/roles.py` | 0 appelant — aucune vue trash/restore rôle n'existe. Corrélé à des classes de test orphelines (`RoleTrashRoutePermissionTests`). **Fonctionnalité incomplète plus que code mort ordinaire.** |
| `add_error_responses` | `api/schema.py` | Écrit correctement mais son hook d'enregistrement est commenté dans `settings.py` — jamais exécuté. |

---

## 12. Dette technique / points faibles

**Risques N+1 / performance** :
- `ProjectSerializer.get_current_user_permission_codes` — 1 requête permission par ligne de projet sérialisé (jusqu'à 50 requêtes supplémentaires par page).
- `FinancialEntry._get_time_entry_paid_amount_excluding_self` — boucle Python plutôt qu'agrégat SQL, exécutée à chaque `clean()` d'une `FinancialEntry` liée à un `TimeEntry`.
- `TimeEntrySerializer`/`TimeEntryPaymentSerializer` — même calcul en Python par ligne sérialisée (mitigé par prefetch mais toujours recalculé côté application plutôt qu'annoté en base).
- `FinancialEntryChartView._build_chart_data` — agrégation entièrement en Python sur toutes les lignes correspondantes, pas de `GROUP BY` SQL.

**Logique métier dans les vues** (à extraire vers `services/`) :
- `ExpenseRequestApproveView.post` — crée un `FinancialEntry` directement, sans `full_clean()` (seule dérogation du projet à cette validation systématique).
- `ProjectMemberDetailView.perform_update`/`perform_destroy` — autorisation fine et nettoyage cascadé multi-modèles, tous deux en ligne dans la vue.
- Transition `completed_at` de `Task` — dans le serializer plutôt que le modèle (un futur `.update()` en masse la contournerait silencieusement).
- **Aucun `services/financial_entries.py` ni `services/expense_requests.py`** — incohérence structurelle par rapport aux autres ressources majeures.

**Gestion d'erreur incohérente** : le projet mélange 3 idiomes — (A) `serializers.ValidationError` standard DRF, (B) `Response(..., status=400)` construite à la main (`DocumentListCreateView`, `CurrentUserProfilePictureView`, `ProjectOwnerRateView.patch` — ce dernier sans serializer du tout), (C) `PermissionDenied` avec des messages tantôt en clé i18n (`"errors.member.no_permission_edit"`) tantôt en phrase française brute (`"Seul le proprietaire du projet peut le supprimer."`) — incohérent même au sein du même mécanisme d'exception.

**Incohérences de nommage** : `get_user_display_name` (public) vs `_get_user_display_name` (privé, doublon) ; `ExpenseRequest` utilise des constantes de classe plutôt que `TextChoices` (seul modèle à déroger) ; collision de `name=` sur les routes Folder (voir §7).

---

## 13. Parcours métier bout-en-bout (backend)

Résumé condensé — voir [04-business-flows.md](04-business-flows.md) pour les parcours complets incluant le frontend.

| Flux | Fichiers traversés | Profondeur (hops) | Évaluation |
|---|---|---|---|
| (a) Inscription + vérification email | 7 | ~11 | Profondeur justifiée (2 apps + allauth) |
| (b) Login + refresh JWT | 4 | ~6 | Simple, approprié |
| (c) Création de projet | 6 | ~5 | Simple, approprié. Pas de `ProjectMember` créé pour l'owner (modélisation par FK `owner`) |
| (d) Acceptation d'invitation | 6 | ~10 | Le flux le plus profond mais **justifié** — sécurité de concurrence (`select_for_update`), idempotence |
| (e) Upload de document (S3 + repli) | 8 | ~13 | **Dépasse les deux seuils** — profondeur partiellement évitable (`create()` outrepasse `perform_create`, helper au type de retour mixte) |
| (f) Création de tâche | 8 | ~10 | À la limite des seuils ; second `full_clean()` redondant |
| (g) Création d'entrée de temps | 8 | ~9 | Logique de dérivation du taux horaire dans le serializer plutôt qu'un service |
| (h) Finance/Demande de remboursement + approbation | 6-7 | ~6-8 | Approbation : contourne `full_clean()`, logique en vue plutôt qu'en service |
| (i) Notification | 3 | ~3 | Le plus court, mais **sous-utilisé** — seuls 2 déclencheurs (invitation créée/acceptée) alors que l'infra est générique |

---

## Couverture / réserves

- `api/tests.py` (5935 lignes, ~40 classes `*RoutePermissionTests`) survolé par nom de classe uniquement, hors périmètre de l'inventaire fonctionnel demandé.
- `accounts/tests.py` (561 lignes) lu intégralement.
- Tous les fichiers de migration exclus, comme demandé.
- Le reste (modèles/serializers/vues/services/permissions/urls/settings/commande de management) a été lu intégralement.
