import { cn } from "@/lib/utils";

/* ============ Identité BitQuest ============
 * Charte graphique — Édition 2026
 * - L'Orbite : planète pleine (#F7931A), anneau incliné à 24°, satellite.
 *   L'anneau hérite de la couleur du texte (currentColor) : encre sur fond
 *   clair, blanc sur fond sombre — conformément à la charte.
 * - Le wordmark : « BIT » en Orange Bitcoin, « QUEST » en encre/blanc,
 *   composé en Orbitron (font-display).
 * - Dans l'app, le lockup se réduit au logo + une bulle « Quest »
 *   (même pattern que la bulle « Lab » de BitLab).
 */

export function OrbiteMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("h-9 w-9 text-current", className)}
      role="img"
      aria-label="Symbole BitQuest : l'Orbite"
      fill="none"
    >
      <ellipse
        cx="256"
        cy="258"
        rx="200"
        ry="72"
        stroke="currentColor"
        strokeWidth="15"
        transform="rotate(-24 256 258)"
      />
      <circle cx="256" cy="258" r="112" fill="#F7931A" />
      <path
        d="M 440.8 192.1 L 438.6 201.7 L 434.0 212.1 L 427.1 223.0 L 418.0 234.4 L 406.8 246.1 L 393.7 257.9 L 378.9 269.8 L 362.4 281.5 L 344.6 292.8 L 325.6 303.8 L 305.8 314.1 L 285.3 323.8 L 264.4 332.6 L 243.4 340.4 L 222.6 347.2 L 202.2 352.8 L 182.5 357.2 L 163.8 360.3 L 146.2 362.1 L 130.1 362.6 L 115.5 361.7 L 102.8 359.5 L 92.0 356.0 L 83.4 351.2"
        stroke="currentColor"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <circle cx="393.3" cy="154" r="16" fill="currentColor" />
    </svg>
  );
}

export function BitQuestWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-extrabold tracking-wide", className)}>
      <span className="text-primary">BIT</span>
      <span className="text-foreground">QUEST</span>
    </span>
  );
}

/* Bulle « Quest » — même pattern que la bulle « Lab » de BitLab */
export function QuestBubble({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border border-primary/40 bg-primary/10 px-2 py-px text-[11px] font-medium text-primary",
        className
      )}
    >
      Quest
    </span>
  );
}

export function BitQuestLockup({
  markClassName,
  wordmarkClassName,
  className,
}: {
  markClassName?: string;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <OrbiteMark className={markClassName} />
      <BitQuestWordmark className={wordmarkClassName} />
    </span>
  );
}
