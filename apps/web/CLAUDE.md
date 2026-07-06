@../../CLAUDE.md
@AGENTS.md

# Web App — Contexte IA (Next.js 16)

App Router, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui.

---

## Structure `src/` (actuelle)

```
src/
  app/
    <page>/
      components/       Composants propres à cette page uniquement
      page.tsx
  components/
    ui/                 Primitives shadcn — ne jamais modifier à la main
    badges/             Badges de statut/type (StatusBadge générique + configs)
    dialogs/            Dialogs réutilisables + shells FormDialog/DetailModal
    documents/          Affichage et upload de documents (FileAttachment, MultiDocumentAttachmentField)
    entries/            Composants d'affichage d'entrées
    filters/            FilterBar + sélecteurs de filtre
    forms/              Utilitaires formulaire (password-input, date-picker, form-error)
    pickers/            Sélecteurs arborescents (tree-picker, target-tree-picker)
    states/             États UI (no-project, access-denied, skeleton-loader)
    dashboard/          Shell workspace + sidebar (utilisés par toutes les pages)
    app-header.tsx      ┐
    auth-shell.tsx      │ Infrastructure globale
    protected-route.tsx │
    providers.tsx       ┘
    page-title.tsx
    member-avatar.tsx
  lib/                  Infrastructure app (clients, adapters, utils globaux)
  stores/               Zustand stores
```

### Règle de placement des composants

| Dossier | Critère |
|---|---|
| `components/ui/` | Shadcn auto-généré — jamais modifié à la main |
| `components/<categorie>/` | Composant réutilisable dans 2+ pages |
| `components/dashboard/` | Shell et sidebar (partagés par toutes les pages) |
| `app/<page>/components/` | Composant propre à une seule page |
| `components/` racine | Infrastructure globale : layout, providers, guards |

**Règles strictes :**
- `components/ui/` = shadcn seulement → `pnpm dlx shadcn@latest add <composant> --cwd apps/web`
- Nouveau composant utilisé par 1 seule page → `app/<page>/components/`
- Nouveau composant utilisé par 2+ pages → `components/<categorie>/`
- Nouveau badge de statut → utiliser `StatusBadge` + config dans `components/badges/`

### Convention de page (`app/<feature>/`)

Chaque route projet suit exactement le même découpage :
- `page.tsx` — mince, Server Component, `<Suspense fallback={<ProjectPageFallback />}>` autour du contenu.
- `<feature>-page-content.tsx` — export externe `<Feature>PageContent` (Client Component, encapsule `ProjectWorkspaceShell`) ; fonction interne `<Feature>View` qui reçoit l'état `ProjectWorkspaceState`.
- Utilitaires propres à la feature (parsing de filtres, invalidation de query) → `app/<feature>/lib/<feature>-filters.ts`.

### Convention Dialog / Modal

- Suffixe **`Modal`** réservé aux composants qui rendent le shell partagé `DetailModal` (`components/dialogs/detail-layout.tsx`) — vue détail en lecture.
- Suffixe **`Dialog`** pour tout le reste : formulaires, confirmations, pickers, previews.
- Wrapper de formulaire → toujours `FormDialog` (`components/dialogs/form-dialog.tsx`), jamais `Dialog`/`DialogHeader`/`DialogFooter` bruts.

### Convention `interface` vs `type`

- `interface` pour toute forme d'objet Props ou API publique.
- `type` uniquement pour unions, intersections, ou alias d'un type existant (`Omit<...>`, `ComponentProps<...>`).

---

## shadcn/ui — Règles d'usage

**Toujours utiliser shadcn/ui en premier.** Avant de créer un composant UI, vérifier si shadcn en a un.

### Composants shadcn installés

`Alert`, `AlertDialog`, `Avatar`, `Badge`, `Breadcrumb`, `Button`, `Calendar`,
`Card`, `Checkbox`, `ContextMenu`, `Dialog`, `DropdownMenu`, `Input`, `Label`,
`Popover`, `Progress`, `RadioGroup`, `ScrollArea`, `Select`, `Separator`,
`Sheet`, `Skeleton`, `Switch`, `Table`, `Tabs`, `Textarea`, `Toggle`, `Tooltip`,
`Sonner` (toasts), `Chart` (Recharts), `Combobox`, `DatePicker`, `Sidebar`.

### Règles shadcn

- Importer depuis `@/components/ui/<composant>` — jamais directement depuis radix-ui ou @base-ui dans les features.
- Pour les variantes : utiliser `class-variance-authority` (cva) + `cn()` de `@/lib/utils`.
- Pour les icônes : **Lucide uniquement** (`lucide-react`). Pas d'autres libs d'icônes.
- Pour les toasts : `sonner` via `import { toast } from "sonner"`.
- Pour les formulaires : `Field`, `FieldLabel`, `FieldError` de `components/ui/field.tsx` + react-hook-form (voir "Patterns de formulaires" plus bas) — **pas** le composant `Form`/`FormField` de shadcn, qui n'est pas installé dans ce repo.

### Ajouter un composant shadcn manquant

```bash
pnpm dlx shadcn@latest add <composant> --cwd apps/web
```

---

## Composants réutilisables existants

Ces composants existent déjà — **ne pas les recréer** :

**`components/badges/`** — pattern : `StatusBadge` générique + configs par fichier
`TaskStatusBadge`, `TaskPriorityBadge`, `PaymentStatusBadge`, `EntryTypeBadge`, `RequestStatusBadge`, `MemberTypeBadge`, `InvitationStatusBadge`
→ Nouveau badge : créer un `Record<Status, BadgeOption>` et passer à `<StatusBadge option={...} />`

**`components/dialogs/`**
`ConfirmDeleteDialog`, `DocumentPreviewDialog`, `TaskDetailModal`, `FormDialog` (shell), `DetailModal` (+ `ModalHero`/`ModalGrid`/`ModalFooter`/`ModalDocs`/`ModalSection`/`DetailField`/`DetailLabel`)

**`components/documents/`**
`FileAttachment`, `MultiDocumentAttachmentField`

**`components/entries/`**
`EntryMetadataRow`

**`components/filters/`**
`FilterBar`, `FilterSearch`, `FilterSelect`, `FilterToggle`, `FilterClear`, `FilterFolderPicker` — dans `filter-bar.tsx`
`MemberFilterSelect` — dans `member-filter-select.tsx`

**`components/forms/`**
`PasswordInput`, `DatePicker`, `DateTimePicker`, `FormError`, `FormErrorAlert`, `MoneyInput`, `FormSubmitButton`
→ `InputGroup` et ses sous-composants sont dans `components/ui/input-group.tsx` (shadcn)

**`components/pickers/`**
`TreePickerDialog` — dans `tree-picker.tsx` (mode `"folder"` ou `"target"`, couvre aussi le picker de cible)

**`components/states/`**
`SkeletonLoader`, `NoProjectState`, `AccessDeniedState`

**`components/dashboard/`** (partagé entre toutes les pages)
`ProjectWorkspaceShell`, `ProjectPageFallback`, `DashboardSidebar`, `CreateProjectDialog`

**`components/` racine**
`PageTitle`, `MemberAvatar`, `MutedInfoCard`, `AppHeader`, `AuthShell`, `ProtectedRoute`, `Providers`

---

## Anti-duplication — règles strictes

- **Avant de créer un composant**, chercher dans `components/shared/`, `components/ui/`, et dans le dossier de la feature courante.
- **Badges de statut** : utiliser les `*Badge` existants, ne jamais recoder un badge inline.
- **Dialogs de confirmation** : toujours `ConfirmDeleteDialog`, jamais de dialog custom pour la suppression.
- **Filtres** : toujours les composants `Filter*` de `filter-bar.tsx`.
- **États vides** : toujours `<Empty />` ou `<NoProjectState />` selon le contexte.
- **Skeletons** : toujours `<SkeletonLoader />` ou `<Skeleton />` de shadcn.
- **Toasts** : `toast.success()`, `toast.error()` de sonner — pas d'autre système de notification.
- **Erreurs formulaire** : `<FormErrorAlert />`/`<FormError />` pour les erreurs globales + `<FieldError />` (`components/ui/field.tsx`) pour les champs.

---

## Patterns de data fetching

```tsx
// 1. Clé React Query depuis packages/query-keys
import { queryKeys } from "@project-gestion/query-keys";

// 2. Client API depuis lib/api.ts
import { api } from "@/lib/api";

// 3. useQuery standard — la branche `enabled: false` utilise queryKeys.disabled(),
//    jamais un tableau littéral
const { data, isPending } = useQuery({
  queryKey: projectId ? queryKeys.tasks.list(projectId, filters) : queryKeys.disabled(),
  queryFn: () => api.tasks.list(projectId!, filters),
  enabled: Boolean(projectId),
});

// 4. Mutation create/update/delete → toujours useCrudMutation (@/lib/use-crud-mutation),
//    pas un useMutation ad hoc : il gère le toast de succès, l'invalidation (une clé
//    ou un tableau de clés) et l'erreur (toastError) de façon uniforme.
const createTask = useCrudMutation({
  mutationFn: (payload: TaskPayload) => api.tasks.create(projectId!, payload),
  invalidateKey: queryKeys.tasks.all(projectId!),
  successMessage: "Tâche créée",
  onSuccess: () => setCreateDialogOpen(false), // cleanup local propre au dialog
});
```

---

## Patterns de formulaires

```tsx
// Toujours: react-hook-form + zod + les primitives Field (pas le Form de shadcn,
// qui n'est pas installé dans ce repo — voir "Règles shadcn" plus haut)
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
// Schema depuis packages/validation si partagé (web + mobile, ou simplement métier
// et réutilisable), sinon local au composant
import { taskSchema, type TaskFormValues } from "@project-gestion/validation";

const form = useForm<TaskFormValues>({
  resolver: zodResolver(taskSchema),
  defaultValues: { ... },
});

// Champ simple : register + FieldError
<Field>
  <FieldLabel htmlFor="title">Titre</FieldLabel>
  <Input id="title" {...form.register("title")} />
  <FieldError errors={[form.formState.errors.title]} />
</Field>

// Champ composé (Select, DatePicker, combobox) : Controller
<Controller control={form.control} name="priority" render={({ field }) => (
  <PrioritySelect value={field.value} onChange={field.onChange} />
)} />

// Erreurs serveur (400 API) → mappées aux champs via useServerFieldErrors,
// jamais un message générique seul
import { useServerFieldErrors } from "@/lib/use-server-field-errors";
useServerFieldErrors(form, mutation.error, ["title", "priority"]);
```

---

## Patterns de composants

### Composant présentationnel (`components/ui/` ou `components/<feature>/`)

```tsx
interface MonComposantProps {
  value: string;
  onChange: (value: string) => void;
  className?: string; // toujours accepter className
}

export function MonComposant({ value, onChange, className }: MonComposantProps) {
  return (
    <div className={cn("...", className)}>
      {/* shadcn + Tailwind uniquement */}
    </div>
  );
}
```

### Composant avec variantes (shadcn pattern)

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const monComposantVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "md" },
});

interface MonComposantProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof monComposantVariants> {}

export function MonComposant({ className, variant, size, ...props }: MonComposantProps) {
  return <div className={cn(monComposantVariants({ variant, size }), className)} {...props} />;
}
```

---

## Règles de style Tailwind

- **Responsive** : mobile-first (`sm:`, `md:`, `lg:`).
- **Dark mode** : utiliser les variables CSS (`bg-background`, `text-foreground`, `text-muted-foreground`, etc.) — pas de classes `dark:` manuelles sauf exception.
  - Exception documentée : `components/badges/*` (couleurs sémantiques de statut — sky/emerald/red/amber...) n'ont pas d'équivalent en variable CSS de thème, donc chaque `BadgeOption.className` porte sa propre paire `bg-X-50 dark:bg-X-950`.
- **Spacing** : suivre la grille Tailwind (4, 6, 8, 12, 16...).
- **`cn()`** toujours pour fusionner les classes (jamais de concaténation string).
- **Jamais de style inline** sauf pour des valeurs dynamiques impossibles à faire en Tailwind.

---

## Règles TypeScript

- `any` interdit.
- Types domaine → `packages/types`. Types locaux → fichier co-localisé.
- Props explicites pour tout composant exporté.
- Préférer `interface` pour les props et APIs publiques, `type` pour les unions/intersections.
- `import type` pour les imports de types purs.

---

## Règles Next.js App Router

- `"use client"` uniquement si le composant utilise des hooks, des événements, ou des APIs browser.
- Garder les Server Components quand possible pour les layouts et pages statiques.
- `useRouter`, `useSearchParams`, `usePathname` → toujours dans `"use client"`.
- Pas de logique métier dans `app/` — la page importe des composants depuis `components/`.

---

## Checklist avant de livrer

- [ ] Aucun composant shadcn recréé manuellement
- [ ] Aucun badge/dialog/état vide dupliqué
- [ ] Composant placé au bon endroit (`shared/`, `ui/`, `<feature>/`, racine, ou co-localisé)
- [ ] `cn()` utilisé pour toutes les classes conditionnelles
- [ ] `queryKeys.*` utilisé pour toutes les clés React Query
- [ ] `toast.*` de sonner pour tous les feedbacks
- [ ] `"use client"` ajouté uniquement si nécessaire
- [ ] Types explicites, pas de `any`
- [ ] Un composant par fichier
