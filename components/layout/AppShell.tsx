"use client";
import { useEffect, useRef } from "react";
import { loadAchievementState, loadPrefs, saveAchievementState, savePrefs, SKINS, useHearth } from "@/lib/store";
import { EmberTrail } from "@/components/fx/EmberTrail";
import { ScrollReveal } from "@/components/fx/ScrollReveal";
import { AchievementToasts } from "@/components/vesta/AchievementToasts";
import { AskSelection } from "@/components/vesta/AskSelection";
import { Hyperspace } from "@/components/fx/Hyperspace";
import { SpaceBackdrop } from "@/components/fx/SpaceBackdrop";
import { VestaPanel } from "@/components/vesta/VestaPanel";
import { postMissionAlert } from "@/components/vesta/useVesta";
import { TestDrawer } from "@/components/ui/TestDrawer";
import { Tour } from "@/components/ui/Tour";
import { LaunchScreen } from "./LaunchScreen";
import { SideNav } from "./SideNav";
import { SiteFooter } from "./SiteFooter";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const missionId = useHearth((s) => s.missionId);
  const engine = useHearth((s) => s.engine);
  const level = useHearth((s) => s.level);
  const skin = useHearth((s) => s.skin);
  const starfield = useHearth((s) => s.starfield);
  const trail = useHearth((s) => s.trail);
  const reveal = useHearth((s) => s.reveal);
  const achStats = useHearth((s) => s.achStats);
  const unlocked = useHearth((s) => s.unlocked);
  const loaded = useRef(false);
  const lastMission = useRef<string | null>(null);

  // restore preferences once
  useEffect(() => {
    const p = loadPrefs();
    const s = useHearth.getState();
    const ach = loadAchievementState();
    s.loadAchievements(ach.stats, ach.unlocked);
    if (p.missionId) s.setMission(p.missionId);
    if (p.engine) s.setEngine(p.engine);
    if (p.level) s.setLevel(p.level);
    if (p.skin && p.skin in SKINS) s.setSkin(p.skin);
    if (typeof p.starfield === "boolean") s.setStarfield(p.starfield);
    if (typeof p.trail === "boolean") s.setTrail(p.trail);
    if (typeof p.reveal === "boolean") s.setReveal(p.reveal);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) savePrefs({ missionId, engine, level, skin, starfield, trail, reveal });
  }, [missionId, engine, level, skin, starfield, trail, reveal]);

  useEffect(() => {
    if (loaded.current) saveAchievementState(achStats, unlocked);
  }, [achStats, unlocked]);

  // the accent skin applies to the whole site through CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (skin === "ember") delete root.dataset.skin;
    else root.dataset.skin = skin;
  }, [skin]);

  // VESTA speaks first when the mission changes (and once on arrival)
  useEffect(() => {
    if (lastMission.current === missionId) return;
    const t = setTimeout(() => {
      lastMission.current = missionId;
      postMissionAlert(missionId);
    }, 150);
    return () => clearTimeout(t);
  }, [missionId]);

  return (
    <div className="relative min-h-screen text-text">
      <SpaceBackdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ember focus:px-3 focus:py-1 focus:text-bg">
        Skip to content
      </a>
      <TopBar />
      <div className="relative z-10 mx-auto flex max-w-[1800px] flex-col vesta:flex-row">
        <SideNav />
        <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6 vesta:order-2">
          {children}
          <SiteFooter />
        </main>
        <VestaPanel />
      </div>
      <TestDrawer />
      <Hyperspace />
      <LaunchScreen />
      <AskSelection />
      <AchievementToasts />
      <EmberTrail />
      <ScrollReveal />
      <Tour />
    </div>
  );
}
