"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useContentBasePath } from "@/lib/admin/base-path";

/**
 * `<Link>` qui réécrit un href commençant par `/admin/` vers le préfixe
 * courant (`/studio` ou `/admin`) via `useContentBasePath()`. Ça garde
 * l'EDITOR sous /studio pendant la navigation inter-pages content.
 *
 * Tout href non préfixé `/admin/` passe inchangé.
 */
type LinkProps = ComponentProps<typeof Link>;

function rewrite(href: LinkProps["href"], base: "/studio" | "/admin"): LinkProps["href"] {
  if (base === "/admin") return href;
  if (typeof href === "string") {
    if (href === "/admin") return "/studio";
    if (href.startsWith("/admin/")) return `/studio${href.slice("/admin".length)}`;
    return href;
  }
  if (href && typeof href === "object" && typeof href.pathname === "string") {
    const p = href.pathname;
    if (p === "/admin") return { ...href, pathname: "/studio" };
    if (p.startsWith("/admin/")) return { ...href, pathname: `/studio${p.slice("/admin".length)}` };
  }
  return href;
}

export function ContentLink(props: LinkProps) {
  const base = useContentBasePath();
  const { href, ...rest } = props;
  return <Link href={rewrite(href, base)} {...rest} />;
}
