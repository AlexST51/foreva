/**
 * Parlez.me speech bubble logo.
 * A simple, clean speech bubble icon in the app's accent color.
 */
export default function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Speech bubble */}
      <path
        d="M32 6C16.536 6 4 16.745 4 30c0 7.442 4.168 14.12 10.8 18.6L12 52l10.4-4.8C25.2 48.4 28.52 49 32 49c15.464 0 28-10.745 28-24S47.464 6 32 6z"
        fill="url(#bubble-gradient)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />
      {/* Three dots (typing indicator) */}
      <circle cx="22" cy="28" r="3.5" fill="rgba(255,255,255,0.9)" />
      <circle cx="32" cy="28" r="3.5" fill="rgba(255,255,255,0.9)" />
      <circle cx="42" cy="28" r="3.5" fill="rgba(255,255,255,0.9)" />
      <defs>
        <linearGradient id="bubble-gradient" x1="4" y1="6" x2="60" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6c5ce7" />
        </linearGradient>
      </defs>
    </svg>
  );
}
