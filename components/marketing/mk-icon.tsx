import {
  ArrowRight,
  Check,
  Link as LinkIcon,
  ShieldCheck,
  Syringe,
  Scales,
  CalendarBlank,
  Pill,
  FileText,
  Eye,
} from "@phosphor-icons/react/dist/ssr";

// Icons for the marketing surface come from Phosphor, not from the project's
// hand-drawn Lucide-alike set. Two reasons, and they point the same way:
// hand-rolled SVG paths are a maintenance liability and a design tell, and the
// brief rules Lucide out.
//
// The app keeps its own icon set for now. That is a deliberate boundary, not an
// oversight: migrating every product surface is a separate change, and the real
// product components embedded on this page render with the app's icons on
// purpose, because a real preview shows the product as it actually is.
//
// One family, one weight, one size scale.

const ICONS = {
  arrowRight: ArrowRight,
  check: Check,
  link: LinkIcon,
  shield: ShieldCheck,
  syringe: Syringe,
  scale: Scales,
  calendar: CalendarBlank,
  pill: Pill,
  fileText: FileText,
  eye: Eye,
} as const;

export type MkIconName = keyof typeof ICONS;

export function MkIcon({
  name,
  size = 16,
  className,
  style,
}: {
  name: MkIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      weight="regular"
      className={className}
      style={style}
      aria-hidden="true"
    />
  );
}
