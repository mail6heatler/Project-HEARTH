type P = { className?: string };
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconOverview = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconDatabase = (p: P) => (
  <svg {...base} className={p.className}><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
);
export const IconTable = (p: P) => (
  <svg {...base} className={p.className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
);
export const IconCompare = (p: P) => (
  <svg {...base} className={p.className}><path d="M6 20V10M12 20V4M18 20v-7" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconLab = (p: P) => (
  <svg {...base} className={p.className}><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
);
export const IconSend = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 12l16-8-6 16-2-6z" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base} className={p.className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
);
export const IconAudit = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 3c1 3.5 6 5.5 6 11a6 6 0 01-12 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3-.5-3 .5-6 1.5-9z" /></svg>
);
export const IconRank = (p: P) => (
  <svg {...base} className={p.className}><path d="M5 6h14M5 12h9M5 18h5" /></svg>
);
export const IconGap = (p: P) => (
  <svg {...base} className={p.className}><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21M11 8v3.5M11 14v.2" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base} className={p.className}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base} className={p.className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
);
export const IconPin = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 17v4M8 3h8l-1 6 3 3H6l3-3z" /></svg>
);
export const IconFlame = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 3c.5 3.5 4.5 5.5 4.5 10a4.5 4.5 0 01-9 0c0-2.2 1.2-3.6 2.2-4.6.2 1.6 1 2.6 1.8 3 .2-3.3-.6-5.8.5-8.4z" /></svg>
);
export const IconGauge = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 17a8 8 0 1116 0" /><path d="M12 17l4-5" /><path d="M7 17h10" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base} className={p.className}><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
);
export const IconChevron = (p: P) => (
  <svg {...base} className={p.className}><path d="M6 9l6 6 6-6" /></svg>
);
export const IconBolt = (p: P) => (
  <svg {...base} className={p.className}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base} className={p.className}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg>
);
export const IconExpand = (p: P) => (
  <svg {...base} className={p.className}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
);
export const IconShrink = (p: P) => (
  <svg {...base} className={p.className}><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>
);
export const IconPopOut = (p: P) => (
  <svg {...base} className={p.className}><rect x="3" y="7" width="13" height="13" rx="2" /><path d="M10 3h11v11" /></svg>
);
export const IconDock = (p: P) => (
  <svg {...base} className={p.className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M14 4v16" /></svg>
);
export const IconHideMini = (p: P) => (
  <svg {...base} className={p.className}><circle cx="17.5" cy="17.5" r="3" /><path d="M4 4l9 9M13 7v6H7" /></svg>
);
export const IconGrip = (p: P) => (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden className={p.className}><circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" /><circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" /><circle cx="2.5" cy="13.5" r="1.4" /><circle cx="7.5" cy="13.5" r="1.4" /></svg>
);
