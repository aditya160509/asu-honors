"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScenarioTemplateResponse, TimelineOverrideSpec, TimelineOverrideTargetType } from "@/lib/api/types";
import {
  CONFIG_KEY_SUGGESTIONS,
  OVERRIDE_TARGET_TYPES,
  keyOptionsFor,
  overrideValueError,
  valueHelpFor,
} from "@/lib/scenario/overrideVocabulary";
import type { BranchWizardState } from "./BranchWizard";

interface Props {
  state: BranchWizardState;
  scenarioLibrary: ScenarioTemplateResponse[] | undefined;
  onChange: (patch: Partial<BranchWizardState>) => void;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ConfigureStep({ state, scenarioLibrary, onChange }: Props) {
  // selectTemplate materializes effective_from/to_sim_date from
  // state.branchPointSimDate at the moment a template is picked. If the user
  // then goes back to step 0 and changes the branch date, those baked-in
  // dates go stale (no longer match the actual branch point) unless we
  // re-derive them here. Runs before the primitive-gated early returns below
  // per Rules of Hooks (must fire unconditionally on every render).
  React.useEffect(() => {
    if (state.scenarioTemplateId !== null) {
      selectTemplate(state.scenarioTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.branchPointSimDate]);

  const applicableTemplates = scenarioLibrary?.filter((t) => {
    if (state.primitive === "macro_shock") return t.category === "macro";
    if (state.primitive === "liquidity_scenario") return t.category === "liquidity";
    if (state.primitive === "structural_override") return true;
    return false;
  });

  function selectTemplate(templateId: number | null) {
    if (templateId === null) {
      onChange({ scenarioTemplateId: null, overrides: [] });
      return;
    }
    const template = scenarioLibrary?.find((t) => t.id === templateId);
    const rawOverrides = (template?.effect_profile?.overrides as TimelineOverrideSpec[] | undefined) ?? [];
    const durationDays = template?.default_duration_days ?? null;
    const effectiveTo = durationDays
      ? addDays(state.branchPointSimDate, durationDays)
      : null;
    const materialized: TimelineOverrideSpec[] = rawOverrides.map((o) => ({
      ...o,
      effective_from_sim_date: state.branchPointSimDate,
      effective_to_sim_date: effectiveTo,
    }));
    onChange({ scenarioTemplateId: templateId, overrides: materialized });
  }

  function addOverride() {
    const next: TimelineOverrideSpec = {
      target_type: "config",
      target_key: "",
      override_value: "",
      effective_from_sim_date: state.branchPointSimDate,
    };
    onChange({ overrides: [...state.overrides, next] });
  }

  function updateOverride(index: number, patch: Partial<TimelineOverrideSpec>) {
    const next = state.overrides.map((o, i) => (i === index ? { ...o, ...patch } : o));
    onChange({ overrides: next });
  }

  function removeOverride(index: number) {
    onChange({ overrides: state.overrides.filter((_, i) => i !== index) });
  }

  if (state.primitive === "manual") {
    return (
      <p className="text-small text-text-secondary">
        No configuration needed — the branch starts as an exact copy of the parent&apos;s history at the
        branch point. Add overrides later, or fast-forward it as-is on the next step.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.primitive === "sensitivity_sweep" && (
        <div className="border-l-2 border-accent bg-bg-tertiary px-3 py-2 text-small text-text-secondary">
          Choose one driver-bias or factor-score override. Five independent child timelines run across
          its validated range and persist every outcome.
        </div>
      )}
      {state.primitive === "monte_carlo" && (
        <div className="border-l-2 border-accent bg-bg-tertiary px-3 py-2 text-small text-text-secondary">
          Twenty deterministic child timelines run with distinct seeds. Optional overrides below apply
          identically to every member before the distribution is calculated.
        </div>
      )}
      {applicableTemplates && applicableTemplates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scenario-template">Named scenario (optional)</Label>
          <Select
            value={state.scenarioTemplateId ? String(state.scenarioTemplateId) : "none"}
            onValueChange={(v) => selectTemplate(v === "none" ? null : Number(v))}
          >
            <SelectTrigger id="scenario-template">
              <SelectValue placeholder="Pick from the scenario library" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Custom (manual overrides below)</SelectItem>
              {applicableTemplates.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.scenarioTemplateId && (
            <p className="text-micro text-text-tertiary">
              {applicableTemplates.find((t) => t.id === state.scenarioTemplateId)?.description}
            </p>
          )}
        </div>
      )}

      {state.scenarioTemplateId && (() => {
        const template = scenarioLibrary?.find((item) => item.id === state.scenarioTemplateId);
        const params = template?.editable_params ?? {};
        return <div className="grid gap-3 sm:grid-cols-2">{Object.entries(params).map(([key, raw]) => {
          const spec = raw as { default?: number; min?: number; max?: number; required?: boolean };
          const isDuration = key === "duration_days";
          const scopeType = key === "industry_id" ? "industry" : "company";
          const current = isDuration ? (state.overrides[0]?.effective_to_sim_date ? Math.round((new Date(`${state.overrides[0].effective_to_sim_date}T00:00:00Z`).getTime() - new Date(`${state.branchPointSimDate}T00:00:00Z`).getTime()) / 86400000) : spec.default ?? "") : state.overrides[0]?.target_scope_id ?? "";
          return <div key={key}><Label>{key.replaceAll("_", " ")}{spec.required ? " *" : ""}</Label><Input type="number" min={spec.min ?? 1} max={spec.max} value={current} onChange={(event) => { const value = Number(event.target.value); onChange({ overrides: state.overrides.map((override) => isDuration ? { ...override, effective_to_sim_date: addDays(state.branchPointSimDate, value) } : { ...override, target_scope_id: value || null, target_scope_type: scopeType }) }); }} /></div>;
        })}</div>;
      })()}

      {!state.scenarioTemplateId && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Manual overrides</Label>
            <button type="button" onClick={addOverride} className="text-micro text-accent hover:underline">
              + Add override
            </button>
          </div>
          {state.overrides.length === 0 && (
            <p className="text-micro text-text-tertiary">No overrides added yet.</p>
          )}
          {state.overrides.map((override, index) => {
            const keyOptions = keyOptionsFor(override.target_type);
            const datalistId = `config-key-suggestions-${index}`;
            const valueError = overrideValueError(override);
            return (
              <div key={index} className="flex flex-col gap-1">
                <div className="grid grid-cols-1 gap-2 items-center md:grid-cols-[1fr_1fr_1fr_.7fr_.75fr_auto]">
                  <Select
                    value={override.target_type}
                    onValueChange={(v) =>
                      // Changing target_type invalidates the previous key (each
                      // type has its own key vocabulary) -- clear it rather than
                      // carry over a key that means something different (or
                      // nothing) under the new type.
                      updateOverride(index, { target_type: v as TimelineOverrideTargetType, target_key: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERRIDE_TARGET_TYPES.map((tt) => (
                        <SelectItem key={tt} value={tt}>
                          {tt}
                          {tt === "event" && " (MarketEvent ID)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {keyOptions ? (
                    <Select
                      value={override.target_key || undefined}
                      onValueChange={(v) => updateOverride(index, { target_key: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select key" />
                      </SelectTrigger>
                      <SelectContent>
                        {keyOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input
                        placeholder={override.target_type === "config" ? "e.g. theta_default" : "key"}
                        value={override.target_key}
                        onChange={(e) => updateOverride(index, { target_key: e.target.value })}
                        list={override.target_type === "config" ? datalistId : undefined}
                      />
                      {override.target_type === "config" && (
                        <datalist id={datalistId}>
                          {CONFIG_KEY_SUGGESTIONS.map((key) => (
                            <option key={key} value={key} />
                          ))}
                        </datalist>
                      )}
                    </>
                  )}

                  <Input
                    placeholder="value"
                    value={override.override_value}
                    onChange={(e) => updateOverride(index, { override_value: e.target.value })}
                    aria-invalid={valueError !== null}
                  />
                  <Select value={override.target_scope_type ?? "company"} onValueChange={(value) => updateOverride(index, { target_scope_type: value as "company" | "industry" })} disabled={override.target_type === "config" || override.target_type === "cycle_transition"}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">Company</SelectItem><SelectItem value="industry">Sector</SelectItem></SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Scope ID (optional)"
                    value={override.target_scope_id ?? ""}
                    onChange={(e) => updateOverride(index, {
                      target_scope_id: e.target.value ? Number(e.target.value) : null,
                    })}
                    disabled={override.target_type === "config" || override.target_type === "cycle_transition"}
                    title="Company ID for factor/driver overrides; company or industry ID for events"
                  />
                  <button
                    type="button"
                    onClick={() => removeOverride(index)}
                    className="text-micro text-text-tertiary hover:text-negative px-1"
                  >
                    Remove
                  </button>
                </div>
                <p className={valueError ? "text-micro text-negative" : "text-micro text-text-tertiary"}>
                  {valueError ?? valueHelpFor(override.target_type)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
