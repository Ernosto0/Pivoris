import { useTranslation } from "react-i18next";
import { AlertIcon, CheckIcon, CriticalIcon } from "@/components/icons";

const TONES: Record<string, { box: string; Icon: typeof CheckIcon | null }> = {
  connected: {
    box: "bg-success-subtle text-success ring-success/40",
    Icon: CheckIcon,
  },
  degraded: {
    box: "bg-attention-subtle text-attention ring-attention/40",
    Icon: AlertIcon,
  },
  needs_reauth: {
    box: "bg-danger-subtle text-danger ring-danger/40",
    Icon: CriticalIcon,
  },
  disconnected: {
    box: "bg-surface-subtle text-secondary ring-border",
    Icon: null,
  },
};

/** The account status in the shared vocabulary (automation.accountStatus.*): the word, then the colour. */
export function AccountStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone = TONES[status] ?? TONES.disconnected!;
  return (
    <span
      data-testid="account-status-badge"
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs leading-5 font-medium ring-1 ring-inset ${tone.box}`}
    >
      {tone.Icon ? <tone.Icon className="text-sm" /> : null}
      {t(`automation.accountStatus.${status}`, { defaultValue: status })}
    </span>
  );
}
