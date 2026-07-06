"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterBar, FilterClear } from "./filter-bar";

interface CollapsibleFilterBarProps {
  /** Filtre principal, toujours visible sur mobile (ex: recherche ou sélecteur de période). */
  primary: React.ReactNode;
  /** Filtres secondaires — inline sur desktop, dans le Sheet sur mobile. */
  children: React.ReactNode;
  /** Nombre de filtres secondaires actifs, affichés dans le badge. */
  activeCount: number;
  /** Chemin de la page pour FilterClear (ex: "/tasks"). */
  clearPath: string;
  /** Clés de paramètres URL à effacer. */
  clearKeys: string[];
  /** Titre du Sheet mobile. Défaut : "Filtres". */
  sheetTitle?: string;
}

export function CollapsibleFilterBar({
  primary,
  children,
  activeCount,
  clearPath,
  clearKeys,
  sheetTitle = "Filtres",
}: CollapsibleFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Mobile */}
      <div className="flex gap-2 sm:hidden">
        <div className="flex-1">{primary}</div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative shrink-0" aria-label="Ouvrir les filtres">
              <SlidersHorizontal className="size-4" />
              {activeCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3 overflow-y-auto pb-6">
              {children}
              <FilterClear path={clearPath} removeKeys={clearKeys} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block">
        <FilterBar>
          {primary}
          {children}
          <FilterClear path={clearPath} removeKeys={clearKeys} />
        </FilterBar>
      </div>
    </>
  );
}
