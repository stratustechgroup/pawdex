// Pawdex brand mark — a paw cut from a shield.
//
// The shield reads as protection and trusted custody (medical records that
// travel with the animal); the paw makes it unmistakably about pets. Drawn as
// a SINGLE evenodd path filled with `color`, so the paw is true negative space:
// whatever sits behind the mark shows through. That keeps it monochrome and
// theme-correct on any surface (cream, forest green, dark) with no baked-in
// fill colors. The public API (size + color) is unchanged.

export function PawdexMark({
  size = 24,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 3L26 5.5Q27 5.75 27 7L27 15.5C27 21.8 22.4 26.4 16 29C9.6 26.4 5 21.8 5 15.5L5 7Q5 5.75 6 5.5Z
           M8.9 12.6a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0 -3.4 0Z
           M11.9 10a1.8 2.1 0 1 0 3.6 0a1.8 2.1 0 1 0 -3.6 0Z
           M16.5 10a1.8 2.1 0 1 0 3.6 0a1.8 2.1 0 1 0 -3.6 0Z
           M19.7 12.6a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0 -3.4 0Z
           M11.8 18.4a4.2 3.5 0 1 0 8.4 0a4.2 3.5 0 1 0 -8.4 0Z"
        fill={color}
      />
    </svg>
  );
}
