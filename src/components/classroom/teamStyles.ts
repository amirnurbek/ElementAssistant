import type { TeamColor } from "@/lib/game/teams";

/**
 * Full class names written out so Tailwind's scanner finds them.
 * Building names like `bg-${color}-500` at runtime would be purged from the CSS.
 */
export const TEAM_STYLES: Record<TeamColor, { chip: string; ring: string; banner: string; hex: string }> = {
  violet: { chip: "bg-violet-100 border-violet-500", ring: "ring-violet-400", banner: "bg-violet-600 text-white", hex: "#7c3aed" },
  orange: { chip: "bg-orange-100 border-orange-500", ring: "ring-orange-400", banner: "bg-orange-600 text-white", hex: "#ea580c" },
  blue: { chip: "bg-sky-100 border-sky-500", ring: "ring-sky-400", banner: "bg-sky-700 text-white", hex: "#0284c7" },
  green: { chip: "bg-lime-100 border-lime-600", ring: "ring-lime-500", banner: "bg-lime-700 text-white", hex: "#65a30d" },
  yellow: { chip: "bg-yellow-100 border-yellow-500", ring: "ring-yellow-400", banner: "bg-yellow-400 text-slate-900", hex: "#eab308" },
};
