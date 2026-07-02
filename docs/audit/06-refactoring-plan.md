# Plan de refactorisation priorisé

> Aucune de ces actions n'a été exécutée pendant l'audit. Priorités : critique > élevée > moyenne > faible.
> Chaque item cite les fichiers/fonctions concernés (voir [01-backend.md](01-backend.md), [02-web.md](02-web.md), [05-duplication-dead-code-tech-debt.md](05-duplication-dead-code-tech-debt.md) pour le détail complet).

---

## Priorité critique

### R1 — Réinstaurer le garde production sur le repli de stockage S3→local
- **Fichiers** : `apps/backend/api/services/storage.py` (`upload_document_file`, `upload_profile_picture_file`)
- **Constat** : le garde `if not settings.DEBUG: raise` présent dans le commit `3f4faa4` a été retiré dans la version en cours de modification. Une panne S3 en production dégradera désormais silencieusement vers un stockage local non durable et non servi (`MEDIA_URL` n'est monté qu'en `DEBUG=True`).
- **Difficulté** : faible (réintroduire ~2 lignes, ou remplacer par un flag de fonctionnalité explicite `ALLOW_LOCAL_STORAGE_FALLBACK`).
- **Impact** : évite une perte de données silencieuse et des documents définitivement inaccessibles en production.
- **Risque à ne pas agir** : élevé — incident de production difficile à diagnostiquer (upload "réussi" côté API, fichier introuvable au téléchargement).
- **Bénéfice attendu** : comportement prévisible en cas de panne S3, cohérent avec le commentaire du code lui-même ("en secours quand S3/MinIO est injoignable **en dev**").

### R2 — Corriger la collision de noms de route Folder
- **Fichiers** : `apps/backend/api/urls.py` (lignes ~99-104)
- **Constat** : `FolderListCreateView`, `FolderDetailView`, `FolderTrashListView`, `FolderRestoreView` partagent tous `name="project-folders"`.
- **Difficulté** : triviale (renommer 3 des 4 `name=`).
- **Impact** : élimine un risque de résolution `reverse()` ambiguë.
- **Risque à ne pas agir** : faible en usage actuel (aucun appel `reverse()` identifié qui en dépendrait), mais latent et gratuit à corriger.

---

## Priorité élevée

### R3 — Unifier le calcul coût/payé/restant d'une entrée de temps
- **Fichiers/fonctions** : `api/models.py: FinancialEntry._get_time_entry_cost_amount/_get_time_entry_paid_amount_excluding_self`, `api/serializers.py: TimeEntrySerializer._get_cost_amount/_get_paid_amount`, `TimeEntryPaymentSerializer._get_remaining_amount`
- **Proposition** : extraire une seule fonction (méthode de modèle `TimeEntry.get_financial_summary()` ou service `services/time_entries.py: compute_entry_financials(time_entry)`), consommée par les 3 sites actuels.
- **Difficulté** : moyenne (nécessite des tests de non-régression sur la règle financière).
- **Impact** : élimine le risque de dérive de la règle métier la plus sensible du projet (argent).
- **Bénéfice** : un seul point de modification si la règle d'arrondi/plafond change.

### R4 — Créer `services/financial_entries.py` et `services/expense_requests.py`
- **Fichiers concernés** : `api/views/financial_entries.py` (`FinancialEntryChartView._build_chart_data` et 5 helpers), `api/views/expense_requests.py` (`ExpenseRequestApproveView.post`)
- **Proposition** : déplacer `_build_chart_data` (idéalement reformulé en agrégation SQL `.values().annotate()`) et la création de `FinancialEntry` depuis l'approbation vers ces nouveaux modules de service, en cohérence avec le pattern déjà établi pour `folders`/`invitations`/`members`/`roles`/`projects`/`time_entries`.
- **Difficulté** : moyenne-élevée (le passage Python→SQL pour le graphique demande une vérification de résultats identiques).
- **Impact** : cohérence structurelle, testabilité, et corrige au passage le contournement de `full_clean()` lors de l'approbation d'une demande.
- **Risque** : régression du graphique financier si la réécriture SQL diverge sur les cas limites (buckets vides, fuseaux horaires).

### R5 — Finir ou retirer la fonctionnalité trash/restore des rôles
- **Fichiers** : `api/services/roles.py: get_deleted_project_roles`, `api/tests.py` (`RoleTrashRoutePermissionTests`, `RoleRestoreRoutePermissionTests`)
- **Proposition** : soit ajouter `RoleTrashListView`/`RoleRestoreView` + routes dans `api/urls.py` (cohérence avec les 6 autres ressources qui ont ce pattern), soit supprimer le service et les tests orphelins.
- **Difficulté** : faible si on complète (le pattern des 6 autres ressources est un copier-quasi-coller), triviale si on supprime.
- **Impact** : lève une incohérence visible dans les tests et dans l'inventaire d'URLs.

### R6 — Extraire les 3 utilitaires dupliqués mobile/web dans un package partagé
- **Fichiers** : `apps/web/src/lib/{errors,query-client}.ts` ↔ `apps/mobile/src/lib/{errors,query-client}.ts`
- **Proposition** : créer (ou étendre `packages/api`) une fonction `createQueryClient()` partagée et un cœur de traduction d'erreur partagé (`getErrorMessage`/`isEmailVerificationRequired`/`translateError`), avec `toastError` (dépendance `sonner`) gardé comme wrapper web-only.
- **Difficulté** : faible pour `query-client` (copie identique), moyenne pour `errors` (le web a un dictionnaire plus riche à fusionner sans régression).
- **Impact** : conformité directe à la règle explicite du CLAUDE.md racine ("Zéro duplication entre web et mobile").
- **Bénéfice** : futur ajout d'un message d'erreur profite aux deux plateformes automatiquement.

### R7 — Finaliser la migration vers `FormDialog`/`FormSubmitButton` sur les fichiers restants
- **Fichiers** : `components/dashboard/create-project-dialog.tsx` + `project-form.tsx`, `app/time/page.tsx` (dialogue de création, lignes ~412-440), `app/files/project-files-page-content.tsx` (dialogues rename/delete, lignes ~629-684 — utiliser `ConfirmDeleteDialog` pour delete)
- **Difficulté** : faible (pattern déjà prouvé sur 6 fichiers).
- **Impact** : termine le chantier en cours au lieu de laisser une frontière permanente ancien/nouveau pattern.

### R8 — Consolider les 3 fonctions `formatDate` en une seule source
- **Fichiers** : `lib/date-utils.ts`, `lib/task-utils.ts`, `lib/period-utils.ts`
- **Proposition** : un module `lib/format.ts` neutre exposant des fonctions nommées explicitement par format de sortie (`formatDateDisplay`, `formatDateISO`, `formatDateTime`, `formatTimeOnly`) — élimine la collision de noms.
- **Difficulté** : faible-moyenne (nécessite de retracer tous les call sites).
- **Impact** : supprime un footgun réel (deux fonctions `formatDate` incompatibles portant le même nom dans le même dossier `lib/`).

---

## Priorité moyenne

### R9 — Introduire une classe de vue générique `RestoreAPIView` et un mixin `SoftDeleteDestroyMixin`
- **Fichiers** : 7 vues de restauration + 8 `perform_destroy` (voir [01-backend.md §10](01-backend.md#10-duplications-identifiées))
- **Difficulté** : moyenne (toucher toutes les vues concernées, mais changement mécanique et bien testé par la suite de tests existante).
- **Impact** : réduit le boilerplate de ~15 vues, aucun changement de comportement attendu.

### R10 — Déclaratif pour `permission_code` par méthode HTTP
- **Fichiers** : ~25 classes de vues avec `get_permissions()` répétitif
- **Proposition** : attribut de classe `permission_codes_by_method = {"GET": "task.view", "POST": "task.edit"}` consommé par un mixin partagé.
- **Difficulté** : moyenne-élevée (surface large, risque de régression sur les permissions si mal exécuté — **nécessite une couverture de test complète avant/après**, ce que `api/tests.py` fournit déjà largement).
- **Impact** : lisibilité et cohérence, réduit le risque d'oubli lors de l'ajout d'une nouvelle ressource.

### R11 — Consolider `_get_user_display_name`/`get_user_display_name`
- **Fichiers** : `api/serializers.py`, `api/utils.py`
- **Difficulté** : triviale.
- **Impact** : une seule source, import cohérent.

### R12 — Extraire un composant générique `TargetedEntryFormDialog`/`TargetedEntryDetailDialog`
- **Fichiers** : `app/finance/components/finance-entry-dialogs.tsx`, `app/requests/components/request-dialogs.tsx`
- **Difficulté** : moyenne (les deux domaines ont des champs légèrement différents — nécessite une API de composition, ex. `fields` en slot ou en config).
- **Impact** : élimine la plus grosse duplication structurelle du frontend (~250-300 lignes × 2 quasi-identiques).
- **Risque** : sur-abstraction si un 3ᵉ cas d'usage significativement différent apparaît plus tard — à valider par l'équipe avant d'investir.

### R13 — Consolider les sources de vérité statut/priorité de tâche
- **Fichiers** : `lib/task-utils.ts` (`getStatusLabel`, `getPriorityLabel`, `getStatusClassName`, `getPriorityClassName`) vs `components/badges/task-{status,priority}-badge.tsx`
- **Proposition** : suivre le modèle déjà prouvé par `PrioritySelect` (réutilisation de `TASK_PRIORITY_OPTIONS`) — faire pointer `task-utils.ts` vers les mêmes objets de configuration plutôt que de les redéfinir.
- **Difficulté** : faible-moyenne.
- **Impact** : évite une dérive visuelle entre badge et texte/couleur utilisés ailleurs (filtres, calendrier).

### R14 — Dédupliquer `filter_folder` dans les 5 FilterSet backend
- **Fichiers** : `documents.py`, `tasks.py`, `time_entries.py`, `financial_entries.py`, `expense_requests.py`
- **Proposition** : mixin `FolderScopedFilterMixin` partagé.
- **Difficulté** : faible.
- **Impact** : réduit 5 copies à 1.

### R15 — Scinder `lib/task-utils.ts` en un module de formatage générique + un module tâche
- **Fichiers** : `lib/task-utils.ts` → `lib/format.ts` (dates/durée/octets/argent) + `lib/task-utils.ts` réduit (statut/priorité uniquement)
- **Difficulté** : faible (déplacement + mise à jour des imports).
- **Impact** : nom de fichier cohérent avec son contenu, conforme à la règle AI_DIRECTIVES "éviter les fichiers vagues".

### R16 — Documenter/déprécier `django-guardian`
- **Fichiers** : `apps/backend/requirements.txt`, `CLAUDE.md` (racine, table stack)
- **Proposition** : retirer la dépendance (si confirmé définitivement inutilisée) et corriger la documentation de stack, ou documenter explicitement pourquoi elle est conservée si une migration future est prévue.
- **Difficulté** : triviale (suppression) à faible (si tests de non-régression sur `pip install`/CI).
- **Impact** : réduit la surface de dépendances, aligne la documentation sur la réalité.

---

## Priorité faible

### R17 — Renommer le type `File` de `packages/types`
- **Proposition** : `File` → `DocumentFile` pour éviter la collision avec le `File` DOM global (actuellement contournée par un alias `File as ApiFile` à chaque site d'import).
- **Difficulté** : faible mais mécaniquement large (tous les call sites à mettre à jour).
- **Impact** : confort de développement, pas de bug actuel.

### R18 — Extraire un hook `useTheme()` depuis `DashboardSidebar`
- **Fichiers** : `components/dashboard/dashboard-sidebar.tsx`
- **Difficulté** : faible.
- **Impact** : testabilité, réduction de la responsabilité du composant.

### R19 — Consolider le menu compte dupliqué (`app-header.tsx` / `dashboard-sidebar.tsx`)
- **Difficulté** : faible-moyenne (unifier vers `DropdownMenu` shadcn, déjà utilisé ailleurs dans le même fichier).
- **Impact** : cohérence UI, suppression d'un contournement shadcn.

### R20 — Scinder les packages mono-fichiers selon la convention `AI_DIRECTIVES.md`
- **Fichiers** : `packages/api/src/index.ts` (736 lignes → un fichier par domaine + `types.ts` + `index.ts` fin), `packages/permissions/src/index.ts` (265 lignes → catalogue / graphe / helpers UI)
- **Difficulté** : moyenne (mécanique mais large surface, aucun changement de comportement).
- **Impact** : conformité à la convention documentée, meilleure navigabilité pour un dépôt qui continue de grossir.
- **Note** : `packages/config`, `packages/query-keys`, `packages/validation` sont encore trop petits pour justifier un découpage (`AI_DIRECTIVES.md`: "ne pas créer d'abstraction large avant qu'un vrai pattern partagé existe").

### R21 — Réconcilier documentation vs réalité (structure `features/`, pattern de formulaire shadcn)
- **Fichiers** : `AI_DIRECTIVES.md`, `apps/web/CLAUDE.md`
- **Proposition** : mettre à jour la documentation pour refléter le pattern réellement utilisé (`app/<page>/components` + `Field`/`FieldLabel`/`FieldError`) plutôt que de migrer un code cohérent et fonctionnel.
- **Difficulté** : triviale (documentation uniquement).
- **Impact** : évite qu'un futur contributeur (humain ou agent IA) introduise une incohérence en suivant la documentation à la lettre.

### R22 — Nettoyer les exports morts identifiés
- **Fichiers** : voir la liste complète en [05-duplication-dead-code-tech-debt.md §2](05-duplication-dead-code-tech-debt.md#2-code-mort--vue-consolidée)
- **Difficulté** : triviale, mais **revérifier chaque symbole par grep élargi (y compris mobile) juste avant suppression**, certains ayant une confiance "moyenne" seulement.
- **Impact** : réduction de surface, aucun changement de comportement si les grep sont corrects.

---

## Score de qualité

*(Justifications ; voir [00-overview.md §4](00-overview.md#4-score-de-qualité) pour le tableau récapitulatif.)*

| Critère | Note | Justification |
|---|---|---|
| **Lisibilité** | 7/10 | Noms de fonctions/variables explicites dans les deux stacks ; convention `errors.<domaine>.<raison>` bien tenue côté backend. Pénalisé par les fichiers `*-dialogs.tsx` multi-composants et les fichiers `page.tsx` de 400-700 lignes côté frontend. |
| **Simplicité** | 6/10 | Flux (h) (invitation) et (a) (inscription) ont une profondeur justifiée ; flux (f) (upload document) et (d) (tâche) ont une profondeur en partie évitable (double sérialisation, `full_clean()` redondant). |
| **DRY** | 6/10 | Duplications identifiées nombreuses mais rarement critiques à l'exception du calcul financier (3× backend) et des dates (3× frontend, incompatibles). Le chantier de factorisation en cours montre une trajectoire positive. |
| **KISS** | 6.5/10 | La plupart des fonctions restent courtes ; la complexité se concentre au niveau classe (`FinancialEntryChartView`) plutôt qu'au niveau fonction. |
| **SOLID** | 6/10 | Responsabilité unique globalement respectée côté modèles/serializers ; violée de façon localisée dans certaines vues (`ProjectMemberDetailView`) et certains composants (`ProjectWorkspaceShell`, `DashboardSidebar`, `active-project-dashboard.tsx`). |
| **Découplage** | 7/10 | Règle `packages → apps interdit` et `apps ↔ apps interdit` respectée dans le code réel (vérifiée par grep). Couplage `accounts ↔ api` bidirectionnel côté backend est le principal accroc. |
| **Architecture** | 6.5/10 | Séparation view/serializer/service/model globalement cohérente côté backend (à l'exception de finance/expense_requests) ; convention de routing frontend cohérente mais divergente de la documentation. |
| **Performance** | 7/10 | Pas de vrai N+1 classique trouvé (prefetch correctement appliqué) ; les points faibles sont des agrégations faites en Python plutôt qu'en SQL (chart financier, calcul de solde de temps), pas des requêtes en boucle non maîtrisées. |
| **Maintenabilité** | 6.5/10 | Base de code globalement navigable et testée (suite de tests backend large : ~40 classes de permissions par route). Pénalisée par les fichiers mono-package, les fichiers frontend de 400-700 lignes, et 2 fonctionnalités visiblement incomplètes (trash rôles, notifications sous-utilisées). |
| **Documentation** | 5/10 | `CLAUDE.md`/`AI_DIRECTIVES.md` existent et sont détaillés, mais divergent du code réel sur 2 points structurants (structure de dossiers frontend, pattern de formulaire) et listent une dépendance backend inutilisée (`django-guardian`) comme active. |
