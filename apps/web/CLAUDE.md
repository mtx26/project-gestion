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
    dialogs/            Modals réutilisables (confirm-delete, preview, task-detail)
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
    multi-document-attachment-field.tsx
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
- Pour les formulaires : `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` de shadcn + react-hook-form.

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
`ConfirmDeleteDialog`, `DocumentPreviewModal`, `TaskDetailModal`

**`components/entries/`**
`EntryDetailBody`, `EntryMetadataRow`

**`components/filters/`**
`FilterBar`, `FilterSearch`, `FilterSelect`, `FilterToggle`, `FilterClear`, `FilterFolderPicker` — dans `filter-bar.tsx`
`MemberFilterSelect` — dans `member-filter-select.tsx`

**`components/forms/`**
`PasswordInput`, `DatePicker`, `FormError`, `FormErrorAlert`
→ `InputGroup` et ses sous-composants sont dans `components/ui/input-group.tsx` (shadcn)

**`components/pickers/`**
`TreePickerDialog` — dans `tree-picker.tsx`
`TargetTreePicker` — dans `target-tree-picker.tsx`

**`components/states/`**
`SkeletonLoader`, `NoProjectState`, `AccessDeniedState`

**`components/dashboard/`** (partagé entre toutes les pages)
`ProjectWorkspaceShell`, `ProjectPageFallback`, `DashboardSidebar`, `CreateProjectDialog`, `ProjectForm`

**`components/` racine**
`PageTitle`, `MultiDocumentAttachmentField`, `AppHeader`, `AuthShell`, `ProtectedRoute`, `Providers`

---

## Anti-duplication — règles strictes

- **Avant de créer un composant**, chercher dans `components/shared/`, `components/ui/`, et dans le dossier de la feature courante.
- **Badges de statut** : utiliser les `*Badge` existants, ne jamais recoder un badge inline.
- **Dialogs de confirmation** : toujours `ConfirmDeleteDialog`, jamais de dialog custom pour la suppression.
- **Filtres** : toujours les composants `Filter*` de `filter-bar.tsx`.
- **États vides** : toujours `<Empty />` ou `<NoProjectState />` selon le contexte.
- **Skeletons** : toujours `<SkeletonLoader />` ou `<Skeleton />` de shadcn.
- **Toasts** : `toast.success()`, `toast.error()` de sonner — pas d'autre système de notification.
- **Erreurs formulaire** : `<FormErrorAlert />` pour les erreurs globales + `FormMessage` de shadcn pour les champs.

---

## Patterns de data fetching

```tsx
// 1. Clé React Query depuis packages/query-keys
import { queryKeys } from "@project-gestion/query-keys";

// 2. Client API depuis lib/api.ts
import { api } from "@/lib/api";

// 3. useQuery standard
const { data, isPending } = useQuery({
  queryKey: queryKeys.tasks.list(projectId, filters),
  queryFn: () => api.tasks.list(projectId, filters),
});

// 4. useMutation avec invalidation
const mutation = useMutation({
  mutationFn: api.tasks.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId) });
    toast.success("Tâche créée");
  },
  onError: (error) => toast.error(error.message),
});
```

---

## Patterns de formulaires

```tsx
// Toujours: react-hook-form + zod + shadcn Form
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
// Schema depuis packages/validation si partagé, sinon local
import { taskSchema, type TaskFormData } from "@project-gestion/validation";

const form = useForm<TaskFormData>({
  resolver: zodResolver(taskSchema),
  defaultValues: { ... },
});
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
