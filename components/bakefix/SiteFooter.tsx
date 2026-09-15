export function SiteFooter() {
  return (
    <footer id="about" className="mt-auto scroll-mt-20 border-t border-border">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-2 px-4 py-6 text-center sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 text-xs font-medium text-text-muted">
          <span className="h-px w-8 bg-border" aria-hidden="true" />
          <span>AI guidance, grounded in pastry technique.</span>
          <span className="h-px w-8 bg-border" aria-hidden="true" />
        </div>
        <p className="max-w-xl text-xs text-text-muted">
          Not professional food-safety advice. Use your judgment, especially
          around raw eggs, dairy, and temperature-sensitive fillings.
        </p>
      </div>
    </footer>
  );
}
