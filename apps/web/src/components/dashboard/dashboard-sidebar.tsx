import type { Project, User } from "@project-gestion/types";
import { hasProjectPermission, permissionCodes } from "@project-gestion/permissions";
import { queryKeys } from "@project-gestion/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Bell, ChevronsUpDown, Clock3, ClipboardList, FolderKanban, LayoutDashboard, ListTodo, Lock, LogOut, Moon, Plus, Settings, SquareLibrary, Sun, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const themeChangeEventName = "project-gestion-theme-change";

type DashboardSidebarProps = {
  projects: Project[];
  selectedProjectId: string;
  userId: number | null;
  user: User | null | undefined;
  activeItem: "dashboard" | "settings" | "files" | "tasks" | "time" | "finance" | "requests" | "trash" | "account" | "notifications";
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
  const trashHref = selectedProjectId ? `/trash?project=${selectedProjectId}` : "/trash";
  const financeHref = selectedProjectId ? `/finance?project=${selectedProjectId}` : "/finance";
  const requestsHref = selectedProjectId ? `/requests?project=${selectedProjectId}` : "/requests";
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
    {
      key: "finance",
      href: financeHref,
      label: "Finances",
      icon: Banknote,
      locked: Boolean(selectedProject && !hasProjectPermission(selectedProject, userId, permissionCodes.financeView)),
    },
    {
      key: "requests",
      href: requestsHref,
      label: "Remboursements",
      icon: ClipboardList,
      locked: Boolean(selectedProject && !hasProjectPermission(selectedProject, userId, permissionCodes.expenseRequestView)),
    },
    {
      key: "trash",
      href: trashHref,
      label: "Corbeille",
      icon: Trash2,
      locked: false,
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
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      className="h-12 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                      aria-label="Selectionner un projet"
                    >
                      <ProjectAvatar name={isLoading ? "" : (selectedProject?.name ?? "")} isLoading={isLoading} />
                      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[state=collapsed]/sidebar:lg:hidden">
                        <span className="truncate font-medium">
                          {isLoading ? "Chargement..." : (selectedProject?.name ?? "Aucun projet")}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {selectedProject && userId !== null && selectedProject.owner !== userId
                            ? `Partage par ${selectedProject.owner_display_name}`
                            : "Mon projet"}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4 shrink-0 group-data-[state=collapsed]/sidebar:lg:hidden" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                    side="bottom"
                    align="start"
                  >
                    <DropdownMenuLabel>Projets</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {projects.map((project, index) => (
                        <DropdownMenuItem
                          key={project.id}
                          className="gap-2 p-2"
                          onClick={() => onSelectProject(project.id)}
                        >
                          <ProjectAvatar name={project.name} />
                          <span className="truncate">{project.name}</span>
                          {index < 9 ? (
                            <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 p-2" onClick={onCreateProject}>
                      <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                        <Plus className="size-4" />
                      </div>
                      <span className="text-muted-foreground">Ajouter un projet</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

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

function ProjectAvatar({ name, isLoading = false }: { name: string; isLoading?: boolean }) {
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : "?";
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
        isLoading ? "animate-pulse bg-muted text-transparent" : "bg-primary/10 text-primary",
      )}
    >
      {initial}
    </div>
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
