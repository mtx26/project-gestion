"use client";

import type { User } from "@project-gestion/types";
import type { ReactNode } from "react";
import { ArrowLeft, Bell, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type AppHeaderProps = {
  user: User | null | undefined;
  onLogout: () => void;
  backHref?: string;
  backLabel?: string;
  leading?: ReactNode;
};

export function AppHeader({ user, onLogout, backHref, backLabel = "Retour", leading }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div>
          {backHref ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={backHref}>
                <ArrowLeft className="size-4" />
                {backLabel}
              </Link>
            </Button>
          ) : leading}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
            <Bell className="size-4" />
          </Button>
          <AccountMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ user, onLogout }: { user: User | null | undefined; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = user?.first_name || user?.username || "Compte";
  const pictureUrl = user?.profile?.picture_url;
  const initials = getInitials(displayName);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold transition hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Menu du compte"
      >
        {pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pictureUrl} alt="" className="size-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {menuOpen ? (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-popover p-2 text-sm text-popover-foreground shadow-md">
          <div className="px-2 py-2">
            <p className="truncate font-medium">{displayName}</p>
            {user?.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
          </div>
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link href="/account" onClick={() => setMenuOpen(false)}>
              <Settings className="size-4" />
              Parametres du compte
            </Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
            <LogOut className="size-4" />
            Deconnexion
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return <UserRound className="size-4" />;
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
