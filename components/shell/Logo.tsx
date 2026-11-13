import { cn } from "@/lib/utils";

// Marca do Nexo: um "N" feito de nós ligados (nexo = ligação entre as coisas).
// O degradê acompanha a cor de destaque escolhida (--matiz e --croma, ver lib/aparencia.ts).
export function Logo({ className, tamanho = 28 }: { className?: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="nexo-g" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "oklch(0.62 calc(0.21 * var(--croma, 1)) calc(var(--matiz, 275) + 10))" }} />
          <stop offset="1" style={{ stopColor: "oklch(0.47 calc(0.22 * var(--croma, 1)) calc(var(--matiz, 275) - 7))" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill="url(#nexo-g)" />
      <path d="M10.5 22V10l11 12V10" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
      <circle cx="10.5" cy="10" r="2.3" fill="white" />
      <circle cx="21.5" cy="22" r="2.3" fill="white" />
    </svg>
  );
}
