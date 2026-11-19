import { ContentLink as Link } from "@/components/admin/content-link";
import { ChevronRight, Home } from "lucide-react";

/**
 * Breadcrumbs pour les pages admin de contenu pédagogique.
 * Aide à naviguer Cours → Chapitre → Leçon en un clic.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string; // si absent → noeud terminal (pas cliquable)
}

export function ContentBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
    >
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-muted hover:text-foreground"
      >
        <Home className="h-3 w-3" aria-hidden />
        Admin
      </Link>
      {items.map((item, idx) => (
        <span key={idx} className="inline-flex items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          {item.href ? (
            <Link
              href={item.href}
              className="rounded-sm px-1 py-0.5 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span className="rounded-sm px-1 py-0.5 text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
