"use client";

import * as React from "react";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TabsListProps = React.ComponentProps<typeof TabsList>;

export function ScrollableTabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsList
      className={cn(
        "max-w-full overflow-x-auto no-scrollbar justify-start **:data-[slot=tabs-trigger]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}
