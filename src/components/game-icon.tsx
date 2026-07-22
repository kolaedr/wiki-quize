import {
  Car,
  Flag,
  Globe2,
  Landmark,
  Languages,
  LayoutGrid,
  Scale,
  Shield,
  SquareStack,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Game cover icons — lucide only, NO emoji (product rule).
 * games.style = { icon: "flag" | ... } maps here.
 */
const ICONS: Record<string, LucideIcon> = {
  flag: Flag,
  shield: Shield,
  languages: Languages,
  car: Car,
  globe: Globe2,
  users: Users,
  scale: Scale,
  landmark: Landmark,
  grid: LayoutGrid,
  deck: SquareStack,
};

export function GameIcon({
  name,
  size = 26,
  className = "",
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  const Icon = (name && ICONS[name]) || SquareStack;
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent ${className}`}
    >
      <Icon size={size} />
    </span>
  );
}
