// Pawdex brand mark — abstract "ear-arch" inside a soft tag silhouette.
// Dog/cat agnostic; reads as a smooth pet-tag shape.

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
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M14 2.5c-5.8 0-10.5 4.4-10.5 10.2 0 6 4 9.5 6.4 11.1 1.4.95 2.5 1.7 2.7 2.5.2.6.6.9 1.4.9.8 0 1.2-.3 1.4-.9.2-.8 1.3-1.55 2.7-2.5C20.5 22.2 24.5 18.7 24.5 12.7 24.5 6.9 19.8 2.5 14 2.5z"
        fill={color}
      />
      <path
        d="M9.5 9.4c1.4 0 2.4 1.2 2.4 2.5 0 .9-.5 1.6-1.1 2.1-.6-.6-1.5-1.4-2.4-1.4-.7 0-1.2.3-1.5.5C6.8 11 7.9 9.4 9.5 9.4zM18.5 9.4c-1.4 0-2.4 1.2-2.4 2.5 0 .9.5 1.6 1.1 2.1.6-.6 1.5-1.4 2.4-1.4.7 0 1.2.3 1.5.5-.1-2.1-1.2-3.7-2.6-3.7z"
        fill="#FAF9F6"
      />
      <circle cx="14" cy="17" r="1.5" fill="#FAF9F6" />
    </svg>
  );
}
