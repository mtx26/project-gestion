"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";
import { Slot } from "radix-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(true);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      onOpenChange?.(value);
      if (controlledOpen === undefined) {
        setUncontrolledOpen(value);
      }
    },
    [controlledOpen, onOpenChange],
  );

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      toggleSidebar: () => setOpen(!open),
      mobileOpen,
      setMobileOpen,
    }),
    [open, setOpen, mobileOpen],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        data-state={open ? "expanded" : "collapsed"}
        className={cn("flex min-h-dvh w-full flex-col bg-background text-foreground lg:flex-row", className)}
        style={{
          "--sidebar-width": "17.5rem",
          "--sidebar-width-icon": "4.25rem",
          ...style,
        } as React.CSSProperties}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  className,
  children,
}: React.ComponentProps<"aside"> & {
  collapsible?: "icon" | "none";
}) {
  const { open, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {/* Desktop: collapsible sidebar */}
      <aside
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        className={cn(
          "group/sidebar hidden lg:flex lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:bg-sidebar lg:text-sidebar-foreground lg:transition-[width]",
          open ? "lg:w-[--sidebar-width]" : "lg:w-[--sidebar-width-icon]",
          className,
        )}
      >
        {children}
      </aside>

      {/* Mobile: slide-in overlay drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            data-slot="sidebar"
            data-state="expanded"
            className={cn(
              "group/sidebar absolute inset-y-0 left-0 flex w-[--sidebar-width] flex-col overflow-y-auto border-r bg-sidebar text-sidebar-foreground shadow-xl",
              className,
            )}
          >
            {children}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main data-slot="sidebar-inset" className={cn("min-w-0 flex-1", className)} {...props} />;
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("p-4", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto p-3", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("p-3", className)} {...props} />;
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <section data-slot="sidebar-group" className={cn("space-y-2 py-2", className)} {...props} />;
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn("px-2 text-xs font-medium uppercase text-sidebar-foreground/60 group-data-[state=collapsed]/sidebar:lg:hidden", className)}
      {...props}
    />
  );
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("space-y-2", className)} {...props} />;
}

function SidebarGroupAction({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      data-slot="sidebar-group-action"
      className={cn("inline-flex size-7 items-center justify-center rounded-md hover:bg-sidebar-accent", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("space-y-1", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("relative", className)} {...props} />;
}

function SidebarMenuButton({
  className,
  isActive = false,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground group-data-[state=collapsed]/sidebar:lg:justify-center group-data-[state=collapsed]/sidebar:lg:px-0 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-label="Basculer la sidebar"
      className={cn("hidden lg:block", className)}
      onClick={toggleSidebar}
      {...props}
    />
  );
}

function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, mobileOpen, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={isMobile ? () => setMobileOpen(!mobileOpen) : toggleSidebar}
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Basculer la sidebar</span>
    </Button>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
};
