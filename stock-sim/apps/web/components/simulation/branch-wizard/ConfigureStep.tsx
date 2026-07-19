"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScenarioTemplateResponse, TimelineOverrideSpec, TimelineOverrideTargetType } from "@/lib/api/types";
import type { BranchWizardState } from "./BranchWizard";

interface Props {
  state: BranchWizardState;
  scenarioLibrary: ScenarioTemplateResponse[] | undefined;
  onChange: (patch: Partial<BranchWizardState>) => void;
}

const OVERRIDE_TARGET_TYPES: TimelineOverrideTargetType[] = [
  "config",
  "factor_score",
  "event",
  "cycle_transition",
  "driver_bias",
];

// Which engine keys each target_type actually reads (engine/overrides.py).
// "event" has no fixed key list -- it's not wired into the tick loop yet
// (target_key would be a MarketEvent name if/when it is), so it stays free
// text with a warning label rather than a dropdown of options that don't do
// anything.
const CYCLE_PHASE_OPTIONS = [
  { value: "expansion", label: "Expansion" },
  { value: "peak", label: "Peak" },
  { value: "contraction", label: "Contraction (recession)" },
  { value: "trough", label: "Trough" },
];

const DRIVER_BIAS_OPTIONS = [
  { value: "value_opportunity", label: "Value opportunity" },
  { value: "earnings_surprise", label: "Earnings surprise" },
  { value: "news_severity", label: "News severity" },
  { value: "economic_outlook", label: "Economic outlook" },
  { value: "guidance", label: "Guidance" },
  { value: "technical_momentum", label: "Technical momentum" },
  { value: "institutional_buying", label: "Institutional buying" },
];

const FACTOR_SCORE_OPTIONS = [
  { value: "management_quality", label: "Management quality" },
  { value: "moat_score", label: "Moat score" },
  { value: "financial_quality", label: "Financial quality" },
  { value: "fcf_quality", label: "FCF quality" },
  { value: "growth_potential", label: "Growth potential" },
];

// config keys are open-ended (any ConfigParameter key), but these are the
// ones Future Lab scenarios actually reference today (theta_default drives
// mean-reversion speed, kyle_lambda_scale drives trade-impact size) --
// offered as suggestions via a datalist rather than a closed dropdown, since
// unlike cycle_transition/driver_bias/factor_score, config keys aren't a
// fixed enum in the engine.
const CONFIG_KEY_SUGGESTIONS = [
  "theta_default",
  "kyle_lambda_scale",
  "r_cap",
  "growth_rate_min",
  "growth_rate_max",
];

function keyOptionsFor(targetType: TimelineOverrideTargetType): { value: string; label: string }[] | null {
  if (targetType === "cycle_transition") return CYCLE_PHASE_OPTIONS;
  if (targetType === "driver_bias") return DRIVER_BIAS_OPTIONS;
  if (targetType === "factor_score") return FACTOR_SCORE_OPTIONS;
  return null; // config (datalist suggestions) / event (free text)
}

function valueHelpFor(targetType: TimelineOverrideTargetType): string {
  switch (targetType) {
    case "cycle_transition":
      return "Strength 0.0–1.0 (1.0 = hard-force this phase for the override's duration)";
    case "driver_bias":
      return "Additive delta, e.g. -0.3 (clamped to [-1, 1] after applying)";
    case "factor_score":
      return "Additive delta in points, e.g. -15 (clamped to [0, 100] after applying)";
    case "config":
      return "The new value itself (replaces the current setting), e.g. 0.08";
    case "event":
      return "Not wired into the simulation yet — saved but currently has no effect";
    default:
      return "";
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ConfigureStep({ state, scenarioLibrary, onChange }: Props) {
  // Backend POST /sim/timelines creates exactly one timeline per call — N-branch
  // fan-out for sweeps/ensembles (a timeline_groups-creating endpoint) doesn't
  // exist yet, only read-only aggregation for groups that already exist. Rather
  // than build configure UI for a request the API can't fulfill, block here with
  // an honest "not yet available" message.
  if (state.primitive === "sensitivity_sweep" || state.primitive === "monte_carlo") {
    return (
      <div className="card-flat p-4 flex gap-2.5">
        <AlertCircle size={16} className="text-text-tertiary shrink-0 mt-0.5" />
        <div>
          <p className="text-body text-text-primary">Not yet available</p>
          <p className="text-small text-text-secondary mt-1">
            {state.primitive === "sensitivity_sweep" ? "Sensitivity sweeps" : "Monte Carlo ensembles"} create
            multiple timelines from one request, which the API doesn&apos;t support yet — only single-branch
            creation is wired up today. Go back and pick a different primitive, or create a manual branch
            for now.
          </p>
        </div>
      </div>
    );
  }

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
            return (
              <div key={index} className="flex flex-col gap-1">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
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
                          {tt === "event" && " (not yet wired)"}
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
                  />
                  <button
                    type="button"
                    onClick={() => removeOverride(index)}
                    className="text-micro text-text-tertiary hover:text-negative px-1"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-micro text-text-tertiary">{valueHelpFor(override.target_type)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
