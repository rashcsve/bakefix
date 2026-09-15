import { Croissant } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Croissant className="size-5 text-action" aria-hidden="true" />
          <span className="font-display text-base font-semibold text-text-primary">
            BakeFix
          </span>
          <span className="ml-2 hidden text-sm text-text-muted sm:inline">
            AI pastry troubleshooting
          </span>
        </div>
        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 text-sm font-medium text-text-primary sm:flex"
        >
          <a
            href="#bake-form"
            className="rounded-control transition-colors hover:text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            How it works
          </a>
          <a
            href="#about"
            className="rounded-control transition-colors hover:text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            About
          </a>
        </nav>
      </div>
    </header>
  );
}
