import {
  Anchor,
  Apple,
  Atom,
  Bird,
  Bike,
  Bone,
  BookOpen,
  Bug,
  Building2,
  Car,
  Castle,
  Clapperboard,
  Cpu,
  Crown,
  Dog,
  Dumbbell,
  Factory,
  Fish,
  Flag,
  FlaskConical,
  Gamepad2,
  Globe2,
  GraduationCap,
  HeartPulse,
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
  PawPrint,
  SquareStack,
  Stethoscope,
  Sword,
  Swords,
  Syringe,
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
  castle: Castle,
  book: BookOpen,
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
  paw: PawPrint,
  fish: Fish,
  bug: Bug,
  apple: Apple,
  utensils: Utensils,
  // medicine
  stethoscope: Stethoscope,
  heart: HeartPulse,
  pill: Pill,
  syringe: Syringe,
  bone: Bone,
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
  box = "h-12 w-12",
}: {
  name?: string;
  size?: number;
  className?: string;
  /** container size (override for bigger catalog tiles) */
  box?: string;
}) {
  const Icon = (name && ICONS[name]) || SquareStack;
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent ${className}`}
    >
      <Icon size={size} />
    </span>
  );
}
