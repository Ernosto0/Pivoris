import { useTranslation } from "react-i18next";
import { STATE_PRESENTATION, TONE_PILL, TONE_TEXT, type ChipState } from "./presentation";

export type { ChipState } from "./presentation";

/**
 * One status, worded (WCAG 1.4.1). `quiet` drops the pill for states that need no action, so a
 * long list of verified facts does not shout; anything that needs the owner keeps its pill.
 */
export function FactStatusChip({ state, quiet = false }: { state: ChipState; quiet?: boolean }) {
  const { t } = useTranslation();
  const { tone, icon: Icon } = STATE_PRESENTATION[state];
  return (
    <span
      data-state={state}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs leading-5 font-medium ${
        quiet ? TONE_TEXT[tone] : `rounded-md px-2 py-px ${TONE_PILL[tone]}`
      }`}
    >
      <Icon className="text-[0.8125rem]" />
      <span>{t(`knowledge.state.${state}`)}</span>
    </span>
  );
}
