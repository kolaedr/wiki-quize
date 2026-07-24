import {
  Anchor,
  Apple,
  Atom,
  Bird,
  Bike,
  Bug,
  Building2,
  Car,
  Clapperboard,
  Cpu,
  Crown,
  Dog,
  Dumbbell,
  Factory,
  Flag,
  FlaskConical,
  Gamepad2,
  Globe2,
  GraduationCap,
  Landmark,
  Languages,
  LayoutGrid,
  Leaf,
  Lightbulb,
  Medal,
  Microscope,
  Mountain,
  Music,
  Palette,
  Pill,
  Plane,
  Radiation,
  Rocket,
  Scale,
  Ship,
  Shield,
  Smartphone,
  Sprout,
  SquareStack,
  Stethoscope,
  Sword,
  Swords,
  Target,
  TrainFront,
  TreePine,
  Trophy,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/**
 * Cover icons for games & categories — lucide only, NO emoji (product rule).
 * `style.icon` / category.icon / sourceConfig.icon maps to a name here.
 */
const ICONS: Record<string, LucideIcon> = {
  // generic
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
  // geography
  mountain: Mountain,
  crown: Crown,
  // transport
  bike: Bike,
  plane: Plane,
  train: TrainFront,
  ship: Ship,
  anchor: Anchor,
  // military
  sword: Sword,
  swords: Swords,
  target: Target,
  medal: Medal,
  radiation: Radiation,
  // history
  scroll: Scale,
  // science
  atom: Atom,
  flask: FlaskConical,
  microscope: Microscope,
  rocket: Rocket,
  lightbulb: Lightbulb,
  graduation: GraduationCap,
  // nature
  leaf: Leaf,
  tree: TreePine,
  sprout: Sprout,
  bird: Bird,
  dog: Dog,
  bug: Bug,
  apple: Apple,
  utensils: Utensils,
  // medicine
  stethoscope: Stethoscope,
  pill: Pill,
  // culture
  movie: Clapperboard,
  music: Music,
  game: Gamepad2,
  trophy: Trophy,
  dumbbell: Dumbbell,
  art: Palette,
  // technology
  building: Building2,
  factory: Factory,
  cpu: Cpu,
  phone: Smartphone,
};

/** Names available in the icon picker (admin forms). */
export const ICON_NAMES = Object.keys(ICONS);

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
