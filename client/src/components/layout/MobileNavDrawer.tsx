import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";

import Nav, { type LayoutNavProps } from "@/components/layout/Nav";

type MobileNavDrawerProps = LayoutNavProps & {
  buttonClassName?: string;
};

export default function MobileNavDrawer({
  buttonClassName,
  onBookServiceClick,
  onNavigateToHomepage,
  onNavigateToMarketplace,
  onNavigateToSettings,
  onNavigateToServiceRequests,
  onNavigateToOrdinaryFlow,
  currentPage,
  defaultExpanded,
  forceCollapsed,
}: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const wrappedProps = useMemo<LayoutNavProps>(() => {
    const wrap = (fn?: () => void) =>
      fn
        ? () => {
            setOpen(false);
            fn();
          }
        : undefined;

    return {
      onBookServiceClick: wrap(onBookServiceClick),
      onNavigateToHomepage: wrap(onNavigateToHomepage),
      onNavigateToMarketplace: wrap(onNavigateToMarketplace),
      onNavigateToSettings: wrap(onNavigateToSettings),
      onNavigateToServiceRequests: wrap(onNavigateToServiceRequests),
      onNavigateToOrdinaryFlow: wrap(onNavigateToOrdinaryFlow),
      currentPage,
      defaultExpanded,
      forceCollapsed,
    };
  }, [
    onBookServiceClick,
    onNavigateToHomepage,
    onNavigateToMarketplace,
    onNavigateToSettings,
    onNavigateToServiceRequests,
    onNavigateToOrdinaryFlow,
    currentPage,
    defaultExpanded,
    forceCollapsed,
  ]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          "fixed left-2 top-2 sm:left-4 sm:top-4 z-50 inline-flex items-center justify-center rounded-full bg-[#054f31] p-2 text-white shadow-md"
        }
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-[280px] bg-[#054f31] shadow-xl">
            <div className="flex justify-end p-3">
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>

            <Nav
              {...wrappedProps}
              // Always render as a drawer on mobile; do not force icon-only.
              disableAutoCollapse
              defaultExpanded={defaultExpanded ?? true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
