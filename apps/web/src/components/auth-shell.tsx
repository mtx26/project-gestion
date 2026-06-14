import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f5_100%)] px-6 py-10 text-slate-950">
      <div className="mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <p className="text-sm font-semibold uppercase text-teal-700">
            Project Gestion
          </p>
          <h2 className="mt-5 max-w-xl text-4xl font-semibold tracking-normal text-slate-950">
            Un espace clair pour piloter tes projets, dossiers et priorites.
          </h2>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border bg-white/75 p-4">
              <p className="font-semibold text-slate-950">Projets</p>
              <p className="mt-1 text-slate-600">Vue centrale</p>
            </div>
            <div className="rounded-md border bg-white/75 p-4">
              <p className="font-semibold text-slate-950">Dossiers</p>
              <p className="mt-1 text-slate-600">Structure</p>
            </div>
            <div className="rounded-md border bg-white/75 p-4">
              <p className="font-semibold text-slate-950">Equipe</p>
              <p className="mt-1 text-slate-600">Acces</p>
            </div>
          </div>
        </section>

        <div className="w-full">
          <div className="mb-6">
            <p className="text-sm font-semibold text-teal-700">Project Gestion</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h1>
            <p className="mt-2 text-[15px] leading-7 text-slate-600">{description}</p>
          </div>
          <div className="[&_.rounded-xl]:rounded-lg [&_input]:h-11 [&_input]:bg-white [&_label]:text-slate-700">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
