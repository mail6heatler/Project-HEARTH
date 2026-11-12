"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAudit, IconCompare, IconDatabase, IconInfo, IconLab, IconOverview, IconShield, IconTable } from "@/components/ui/Icons";
import { PolarisMark } from "@/components/ui/Polaris";

export const NAV = [
  { href: "/", label: "Mission overview", Icon: IconOverview },
  { href: "/explorer", label: "Test explorer", Icon: IconTable },
  { href: "/compare", label: "Compare", Icon: IconCompare },
  { href: "/safety", label: "Safety & gaps", Icon: IconShield },
  { href: "/lab", label: "My data lab", Icon: IconLab },
  { href: "/dataset", label: "Dataset", Icon: IconDatabase },
  { href: "/simulator", label: "Flame simulator", Icon: IconAudit },
  { href: "/about", label: "About", Icon: IconInfo },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="border-b border-line vesta:w-56 vesta:shrink-0 vesta:border-b-0 vesta:border-r">
      <div className="shell-side vesta:sticky vesta:top-[49px] vesta:flex vesta:h-[calc(100vh-49px)] vesta:flex-col">
        <ul className="flex gap-1 overflow-x-auto px-3 py-2 vesta:flex-col vesta:px-3 vesta:py-4">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                    active ? "bg-gradient-to-r from-ember/20 to-raised text-text shadow-[inset_2px_0_0_var(--ember),0_0_16px_rgba(255,122,47,0.14)]" : "text-muted hover:bg-panel hover:text-text"
                  }`}
                >
                  <Icon className={`transition-transform group-hover:scale-110 ${active ? "text-ember" : ""}`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        {/* Team card: the star above it is Polaris, drawn by the backdrop */}
        <Link href="/about" className="m-3 mt-auto hidden rounded-lg border border-star/25 bg-panel/80 p-3 transition hover:border-star/60 vesta:block">
          <span className="flex items-center gap-1.5 font-head text-sm font-bold tracking-wider text-star">
            <PolarisMark size={14} className="animate-twinkle" />
            Team Polaris
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">NASA Space Apps Challenge 2026</span>
        </Link>
      </div>
    </nav>
  );
}
