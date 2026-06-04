# AI Directives

This file defines the project-wide implementation rules for every AI-assisted
change. It is not feature-specific. Apply it to every new page, screen, module,
package, API integration, and refactor.

## Goal

Build a large, maintainable application from the start. Every implementation
must be organized, scalable, explicit, and easy to extend without rewriting the
same logic later.

## Non-Negotiable Rules

- Build only what the user explicitly asks for.
- Do not add UI, text, styles, routes, dependencies, features, or flows without
  a direct request.
- Keep route files thin.
- Keep `app` folders as routing trees only, not implementation folders.
- Keep one React component per file.
- Keep one clear responsibility per file.
- Keep shared logic out of app-specific UI.
- Keep platform-specific rendering inside the platform app.
- Keep generated files out of `src`.
- Do not put everything in one file.
- Do not duplicate logic across web and mobile when a shared package can own it.
- Do not run browser-only APIs at module top level.
- Do not create broad abstractions before a real shared pattern exists.

## Monorepo Structure

Use this repository model:

```txt
apps/
  <application>/
packages/
  <shared-library>/
supabase/
```

Rules:

- `apps/*` are deployable applications.
- `packages/*` are shared libraries.
- Apps may depend on packages.
- Packages must not depend on apps.
- Apps must not import from other apps.
- A package must have a clear purpose and public API.
- Do not create nested workspace packages like `apps/**/package.json` or
  `packages/**/package.json` below an existing package.

## App Structure

Each app should follow this pattern:

```txt
src/
  app/
  features/
    <feature>/
      screens/
      components/
      hooks/
      lib/
      services/
      types.ts
  lib/
```

Folder responsibilities:

- `app`: routing tree only. It may contain route groups, route files, layouts,
  loading/error boundaries, and route metadata. It must not contain feature
  implementation.
- `app/(section)`: route groups for large product areas. The group name does not
  affect the URL. Use groups to separate product areas, access scopes, or layout
  ownership.
- `app/(section)/layout.tsx`: layout ownership for that section only.
- `features`: app-specific product features.
- `features/<feature>/screens`: route-level screen/container components.
- `features/<feature>/components`: presentational components for that feature.
- `features/<feature>/hooks`: app/platform-specific feature hooks.
- `features/<feature>/lib`: feature helpers that are not shared globally.
- `features/<feature>/services`: feature-side calls to external systems or
  app-level adapters.
- `features/<feature>/types.ts`: feature-specific local types.
- `lib`: app infrastructure such as clients, environment helpers, adapters, and
  global app utilities.

For a project with many pages, never place all routes flat in `app`. Use route
groups and feature folders so the file tree remains readable.

Every route should map to a feature screen. The route owns navigation placement;
the feature owns composition and behavior.

Route files are adapters. They should import a screen from `features` and return
it. Any form, section, hook, service call, or non-trivial composition belongs in
the feature tree, not in `app`.

## Package Structure

Shared packages should follow this pattern:

```txt
src/
  index.ts
  <module>.ts
  types.ts
```

Rules:

- `index.ts` only exports the public API.
- Keep package internals split by responsibility.
- Export explicit types at package boundaries.
- Do not expose internal helpers unless another package or app really needs
  them.
- Do not place UI in a non-UI package.
- Do not place domain/business logic in a generic utility package.

## Feature Implementation Flow

For every new feature:

1. Create a feature folder.
2. Create a route file that only renders the feature screen.
3. Create a screen/container component for composition.
4. Split distinct UI sections into separate components.
5. Put stateful or side-effect logic in hooks or services.
6. Move reusable logic to a package only when it is shared or clearly domain-wide.
7. Add or update types close to their real ownership.
8. Run verification commands.

## File Tree Growth Rules

When the app grows, organize by product area first, then by technical role.

Create a new `features/<feature>` folder when:

- A page has its own business concept.
- Multiple pages share the same domain logic.
- The code would otherwise mix unrelated concepts in one folder.
- A route section needs screens, components, hooks, and services of its own.

Inside a feature:

- Put route-level components in `screens`.
- Put reusable sections in `components`.
- Put custom hooks in `hooks`.
- Put API/external calls in `services`.
- Put pure feature helpers in `lib`.
- Put local feature types in `types.ts`.

If a feature becomes large, add narrower subfolders under the existing role
folders. Keep the subfolder names based on product sections or domain concepts,
not vague technical names.

Do not create a global `components` folder for feature-specific components.
Global components are allowed only for truly reusable primitives.

## Component Rules

- One component per file.
- File name must match the component name.
- Components should be small enough to understand without scrolling through
  unrelated responsibilities.
- A screen/container composes logic and sections.
- A presentational component receives props and renders UI.
- A presentational component must not know about routing, Supabase, environment
  variables, or package internals.
- Split forms into field components, message components, action buttons, and
  screen composition when they grow.
- Avoid mixing unrelated sections in one component.
- Avoid large anonymous inline render blocks when a named component would be
  clearer.

## Logic Rules

- Shared cross-platform logic belongs in `packages/*`.
- App-specific logic belongs in `apps/*/src/features/<feature>`.
- Pure helpers should be plain functions.
- Stateful logic should be in hooks.
- External calls should be in services or client adapters.
- Normalize external API results before exposing them to UI.
- Do not duplicate validation, parsing, formatting, or state machines across
  apps.
- Keep side effects in event handlers, effects, services, or explicit actions.
- Keep render logic pure and deterministic.

## Data And Client Rules

- App-level clients belong in `apps/*/src/lib`.
- Shared client factories may live in packages.
- Environment variables must be read in app infrastructure, not in UI components.
- Never expose server-only secrets to client apps.
- Keep database migrations and database configuration under `supabase`.
- When backend authorization is added, enforce it at the data layer, not only in
  frontend checks.

## Routing Rules

- Routes should represent navigation, not business logic.
- Route files must not contain large forms, complex state, or direct external
  service logic.
- Route files must not define feature components inline.
- Route files must not contain reusable UI.
- Use route groups only when they improve organization or layout ownership.
- Keep empty routes empty until the user asks for content.
- Do not add redirects or protected route behavior unless requested.

## TypeScript Rules

- Keep shared compiler defaults in the root `tsconfig.json`.
- Keep app/package-specific compiler options only when required by that runtime
  or build target.
- `compilerOptions` is valid TypeScript config. Do not remove it just because it
  exists; remove only options that are unnecessary or wrong.
- Avoid `any`.
- Prefer explicit interfaces for public package APIs.
- Keep local types close to the feature using them.
- Promote types to `packages/types` only when multiple packages/apps need them.

## Dependency Rules

- Install dependencies in the app or package that uses them.
- Avoid root dependencies unless they are truly workspace-wide.
- Prefer official SDKs for external platforms.
- Do not add dependencies for simple local logic.
- Update the lockfile when package manifests change.
- Before adding a dependency, check whether the project already has an existing
  package or helper that solves the problem.

## Naming Rules

- Components: `PascalCase.tsx`
- Hooks: `useThing.ts`
- Services: `thingService.ts`
- Clients/adapters: `thingClient.ts` or precise platform names like
  `supabase.ts`
- Pure helpers: `camelCase.ts`
- Types-only files: `types.ts`
- Avoid vague files like `utils.ts`, `helpers.ts`, or `common.ts` unless the
  scope is already narrow inside a feature folder.

## Verification Rules

After TypeScript or React changes:

```txt
npm run type-check
```

After Next.js route/build changes:

```txt
npm run build --workspace @project-gestion/web
```

After changing a compiled shared package used by apps:

```txt
npm run build --workspace <package-name>
```

Run the narrowest relevant command first, then a broader check when the change
touches shared behavior.

## Implementation Checklist

Before finishing any change, verify:

- The user explicitly asked for what was added.
- The route files are thin.
- Each component file contains one component.
- Logic is in the right owner: app feature, app lib, or package.
- Shared logic is not duplicated across apps.
- Platform-specific code is not in shared packages.
- No generated files were written into `src`.
- No browser-only code runs during server/module initialization.
- TypeScript checks pass or the failure is clearly reported.
