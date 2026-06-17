import type { Project, User } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronsUpDown, Clock3, FolderKanban, LayoutDashboard, ListTodo, Lock, LogOut, Moon, Plus, Settings, SquareLibrary, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";

type Theme = "light" | "dark";

const themeChangeEventName = "project-gestion-theme-change";

type DashboardSidebarProps = {
  projects: Project[];
  selectedProjectId: string;
  userId: number | null;
  user: User | null | undefined;
  activeItem: "dashboard" | "settings" | "files" | "tasks" | "time" | "account" | "notifications";
  isLoading: boolean;
  onSelectProject: (id: number) => void;
  onCreateProject: () => void;
  onLogout: () => void;
};

export function DashboardSidebar({
  projects,
  selectedProjectId,
  userId,
  user,
  activeItem,
  isLoading,
  onSelectProject,
  onCreateProject,
  onLogout,
}: DashboardSidebarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const unreadNotificationsQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: api.notifications.unreadCount,
    refetchInterval: 60_000,
  });
  const unreadNotifications = unreadNotificationsQuery.data?.count ?? 0;
  const settingsHref = selectedProjectId ? `/settings?project=${selectedProjectId}` : "/settings";
  const filesHref = selectedProjectId ? `/files?project=${selectedProjectId}` : "/files";
  const tasksHref = selectedProjectId ? `/tasks?project=${selectedProjectId}` : "/tasks";
  const timeHref = selectedProjectId ? `/time?project=${selectedProjectId}` : "/time";
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId) ?? null;

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  }

  const navigation = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, locked: false },
    {
      key: "files",
      href: filesHref,
      label: "Projet",
      icon: SquareLibrary,
      locked: Boolean(selectedProject && !hasProjectPermission(selectedProject, userId, permissionCodes.fileView)),
    },
    {
      key: "tasks",
      href: tasksHref,
      label: "Taches",
      icon: ListTodo,
      locked: Boolean(selectedProject && !hasProjectPermission(selectedProject, userId, permissionCodes.taskView)),
    },
    {
      key: "time",
      href: timeHref,
      label: "Temps",
      icon: Clock3,
      locked: Boolean(selectedProject && !hasProjectPermission(selectedProject, userId, permissionCodes.timeEntryView)),
    },
    { key: "settings", href: settingsHref, label: "Parametres projet", icon: Settings, locked: false },
  ] as const;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2 px-2">
          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-base font-semibold group-data-[state=collapsed]/sidebar:lg:justify-center">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FolderKanban className="size-5" />
            </span>
            <span className="truncate group-data-[state=collapsed]/sidebar:lg:hidden">Project Gestion</span>
          </Link>
          <Button
            asChild
            variant={activeItem === "notifications" ? "secondary" : "ghost"}
            size="icon-sm"
            className="relative group-data-[state=collapsed]/sidebar:lg:hidden"
          >
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="size-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="group-data-[state=collapsed]/sidebar:lg:hidden"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"}
            title={theme === "dark" ? "Mode jour" : "Mode nuit"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between gap-2 px-2 group-data-[state=collapsed]/sidebar:lg:justify-center">
            <SidebarGroupLabel className="px-0 normal-case">
              Projet
            </SidebarGroupLabel>
            <SidebarGroupAction onClick={onCreateProject} aria-label="Ajouter un projet">
              <Plus className="size-4" />
            </SidebarGroupAction>
          </div>

          <SidebarGroupContent className="group-data-[state=collapsed]/sidebar:lg:hidden">
            <Select
              value={selectedProjectId}
              onValueChange={(value) => onSelectProject(Number(value))}
              disabled={isLoading || projects.length === 0}
            >
              <SelectTrigger className="h-9 w-full bg-background">
                <SelectValue placeholder={isLoading ? "Chargement..." : "Choisir un projet"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => {
                  const isShared = userId !== null && project.owner !== userId;

                  return (
                    <SelectItem key={project.id} value={String(project.id)}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{project.name}</span>
                        {isShared ? (
                          <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                            Partage par {project.owner_display_name}
                          </Badge>
                        ) : null}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </SidebarGroupContent>
        </SidebarGroup>

      <Separator className="my-6" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
        {navigation.map((item) => (
          <SidebarMenuItem key={item.label}>
            {item.locked ? (
              <SidebarMenuButton
                disabled
                title={`${item.label} verrouille`}
                className="cursor-not-allowed opacity-50 hover:bg-transparent hover:text-inherit"
              >
                <item.icon className="size-4" />
                <span className="group-data-[state=collapsed]/sidebar:lg:hidden">{item.label}</span>
                <Lock className="ml-auto size-3 group-data-[state=collapsed]/sidebar:lg:hidden" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild isActive={item.key === activeItem}>
                <Link href={item.href} title={item.label}>
                  <item.icon className="size-4" />
                  <span className="group-data-[state=collapsed]/sidebar:lg:hidden">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="relative">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent group-data-[state=collapsed]/sidebar:lg:justify-center"
            onClick={() => setAccountMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
          >
            <UserAvatar user={user} />
            <span className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:lg:hidden">
              <span className="block truncate text-sm font-medium">{getUserDisplayName(user)}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email ?? "Parametres"}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground group-data-[state=collapsed]/sidebar:lg:hidden" />
          </button>

          {accountMenuOpen ? (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border bg-popover p-2 text-sm text-popover-foreground shadow-md">
              <div className="flex items-center gap-3 px-2 py-2">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{getUserDisplayName(user)}</p>
                  {user?.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
                </div>
              </div>
              <Button asChild variant="ghost" className="w-full justify-start">
                <Link href="/account" onClick={() => setAccountMenuOpen(false)}>
                  <UserRound className="size-4" />
                  Parametres
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
                <LogOut className="size-4" />
                Deconnexion
              </Button>
            </div>
          ) : null}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UserAvatar({ user }: { user: User | null | undefined }) {
  const displayName = getUserDisplayName(user);

  return (
    <Avatar className="size-9 border">
      {user?.profile?.picture_url ? <AvatarImage src={user.profile.picture_url} alt="" /> : null}
      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
    </Avatar>
  );
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener(themeChangeEventName, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(themeChangeEventName, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemeSnapshot(): Theme {
  const storedTheme = window.localStorage.getItem("theme");
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  window.localStorage.setItem("theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(themeChangeEventName));
}

function getUserDisplayName(user: User | null | undefined) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Parametres";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
