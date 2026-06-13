"use client";

import type { Project } from "@project-gestion/types";
import { projectSchema, type ProjectFormValues } from "@project-gestion/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryKeys } from "@project-gestion/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, LogOut, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ProtectedRoute } from "@/components/protected-route";
import { FormError } from "@/components/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth-store";

function normalizeProjects(data: Project[] | { results: Project[] } | undefined) {
  if (!data) {
    return [];
  }
  return Array.isArray(data) ? data : data.results;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: api.projects.list,
  });

  const createProject = useMutation({
    mutationFn: api.projects.create,
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const deleteProject = useMutation({
    mutationFn: api.projects.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  async function onLogout() {
    await logout();
    queryClient.clear();
    window.location.assign("/auth/login");
  }

  function onSubmit(values: ProjectFormValues) {
    createProject.mutate({
      name: values.name,
      description: values.description?.trim() || null,
    });
  }

  const projects = normalizeProjects(projectsQuery.data);

  return (
    <ProtectedRoute>
      <main className="min-h-dvh bg-slate-50 text-slate-950">
        <header className="border-b bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <FolderKanban className="size-5 text-teal-700" />
              Project Gestion
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">Projets</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">Parametres</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[360px_1fr]">
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nouveau projet</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input id="name" {...form.register("name")} />
                    <FormError message={form.formState.errors.name?.message} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" rows={4} {...form.register("description")} />
                  </div>
                  <FormError message={createProject.error ? getErrorMessage(createProject.error) : null} />
                  <Button className="w-full" type="submit" disabled={createProject.isPending}>
                    <Plus className="size-4" />
                    Creer
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
                <p className="text-sm text-slate-600">
                  {user ? `${user.first_name || user.username}, voici tes projets accessibles.` : "Chargement de la session..."}
                </p>
              </div>
              <Badge variant="secondary">{projects.length} projet(s)</Badge>
            </div>

            {projectsQuery.error ? (
              <Alert variant="destructive">
                <AlertDescription>{getErrorMessage(projectsQuery.error)}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3">
              {projectsQuery.isLoading ? (
                <Card>
                  <CardContent className="py-6 text-sm text-slate-600">Chargement des projets...</CardContent>
                </Card>
              ) : null}
              {!projectsQuery.isLoading && projects.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-slate-600">
                    Aucun projet pour le moment.
                  </CardContent>
                </Card>
              ) : null}
              {projects.map((project) => (
                <Card key={project.id}>
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-medium">{project.name}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {project.description || "Sans description"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Supprimer ${project.name}`}
                      onClick={() => deleteProject.mutate(project.id)}
                      disabled={deleteProject.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

