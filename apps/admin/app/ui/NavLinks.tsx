"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "../../lib/i18n";

const LINKS = [
  { href: "/", label: t.nav.dashboard },
  { href: "/alimentos", label: t.nav.foods },
  { href: "/areas", label: t.nav.areas },
  { href: "/revisao", label: t.nav.review },
  { href: "/adicionar", label: t.nav.add },
  { href: "/ia", label: t.nav.ai },
  { href: "/fontes", label: t.nav.sources },
  { href: "/definicoes", label: t.nav.settings },
] as const;

/** Primary navigation with active-route highlighting. */
export function NavLinks(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="site-nav" aria-label="Navegação principal">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "site-nav__link is-active" : "site-nav__link"}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
