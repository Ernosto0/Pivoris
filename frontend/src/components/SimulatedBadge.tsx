import { useTranslation } from "react-i18next";

/**
 * Mandatory wherever simulated data is shown (INV-09). Purple outline, appended to any status.
 * The word is the signal; colour only reinforces it. `compact` keeps the word but suits dense rows.
 */
export function SimulatedBadge({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const size = compact ? "px-1.5 py-px text-[11px] leading-4" : "px-2 py-0.5 text-xs leading-5";
  return (
    <span
      data-testid="simulated-badge"
      className={`inline-flex shrink-0 items-center rounded-md bg-simulation-subtle font-semibold tracking-wide text-simulation ring-1 ring-simulation/40 ring-inset ${size} ${className}`}
    >
      {t("badge.simulated")}
    </span>
  );
}
