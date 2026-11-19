"use client";

import { usePathname, useRouter } from "next/navigation";

interface NavEntry {
  href: string;
  label: string;
  section?: string;
}

/**
 * Nav mobile pour /admin — la sidebar est `hidden md:block`, donc sans ce
 * dropdown les utilisateurs mobiles ne pouvaient atteindre aucune sous-page.
 */
export function AdminMobileNav({ items }: { items: NavEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();

  // Regroupe par section pour afficher des <optgroup>.
  const groups = new Map<string, NavEntry[]>();
  let currentSection = "Navigation";
  for (const item of items) {
    if (item.section) currentSection = item.section;
    const arr = groups.get(currentSection) ?? [];
    arr.push(item);
    groups.set(currentSection, arr);
  }

  return (
    <div className="border-b bg-card md:hidden">
      <div className="mx-auto w-full max-w-6xl px-4 py-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Section :</span>
          <select
            value={pathname}
            onChange={(e) => router.push(e.target.value)}
            className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            aria-label="Changer de section admin"
          >
            {Array.from(groups.entries()).map(([section, entries]) => (
              <optgroup key={section} label={section}>
                {entries.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
