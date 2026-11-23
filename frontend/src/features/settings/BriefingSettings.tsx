import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { useDirtyForm } from "@/components/DirtyForms";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Notice } from "@/components/Feedback";
import { ChoiceField, SelectField } from "@/components/FormFields";
import { ClockIcon } from "@/components/icons";
import { useCurrentWorkspace } from "@/features/workspaces/context";
import { useUpdateWorkspace } from "@/features/workspaces/hooks";
import { PanelTitle, SettingsPanel } from "./SettingsParts";

const MORNING_HOURS = [5, 6, 7, 8, 9, 10, 11, 12] as const;
const EVENING_HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function BriefingSettings() {
  const { t } = useTranslation();
  const { workspace, role } = useCurrentWorkspace();
  const canEdit = role === "owner";
  const update = useUpdateWorkspace(workspace.id);

  const initialMorningEnabled = workspace.settings.morning_briefing_enabled ?? true;
  const initialMorningHour = workspace.settings.morning_briefing_hour ?? 9;
  const initialEveningHour = workspace.settings.daily_report_hour ?? 20;

  const [morningEnabled, setMorningEnabled] = useState(initialMorningEnabled);
  const [morningHour, setMorningHour] = useState(initialMorningHour);
  const [eveningHour, setEveningHour] = useState(initialEveningHour);

  const dirty =
    morningEnabled !== initialMorningEnabled ||
    morningHour !== initialMorningHour ||
    eveningHour !== initialEveningHour;
  useDirtyForm(canEdit && dirty && !update.isSuccess);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || !dirty) return;
    update.mutate({
      settings: {
        morning_briefing_enabled: morningEnabled,
        morning_briefing_hour: morningHour,
        daily_report_hour: eveningHour,
      },
    });
  };

  return (
    <SettingsPanel as="section" aria-labelledby="briefing-settings-title">
      <PanelTitle
        id="briefing-settings-title"
        icon={<ClockIcon />}
        title={t("settings.briefings.title")}
        description={t("settings.briefings.description")}
      />
      <form
        className="flex min-w-0 flex-col gap-4 border-t border-border px-4 py-4 sm:px-5"
        onSubmit={submit}
      >
        <fieldset disabled={!canEdit || update.isPending} className="flex min-w-0 flex-col gap-4">
          <ChoiceField
            label={t("settings.briefings.morningEnabled")}
            checked={morningEnabled}
            onChange={(event) => {
              setMorningEnabled(event.target.checked);
              update.reset();
            }}
          />
          {morningEnabled ? (
            <SelectField
              label={t("settings.briefings.morningHour")}
              value={morningHour}
              onChange={(event) => {
                setMorningHour(Number(event.target.value));
                update.reset();
              }}
            >
              {MORNING_HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </SelectField>
          ) : null}
          <SelectField
            label={t("settings.briefings.eveningHour")}
            value={eveningHour}
            onChange={(event) => {
              setEveningHour(Number(event.target.value));
              update.reset();
            }}
          >
            {EVENING_HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </SelectField>
        </fieldset>
        {update.error ? <ErrorMessage error={update.error} /> : null}
        {update.isSuccess ? (
          <Notice tone="success" title={t("settings.briefings.saved")} live="polite" />
        ) : null}
        {canEdit ? (
          <Button type="submit" pending={update.isPending} disabled={!dirty}>
            {t("settings.saveChanges")}
          </Button>
        ) : (
          <p className="text-sm text-secondary">{t("settings.briefings.ownerOnly")}</p>
        )}
      </form>
    </SettingsPanel>
  );
}
