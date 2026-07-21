"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateScenarioTemplate, useScenarioLibrary } from "@/lib/api/hooks/useSimulation";
import { ApiError } from "@/lib/api/client";
import {
  CONFIG_KEY_SUGGESTIONS,
  OVERRIDE_TARGET_TYPES,
  keyOptionsFor,
  valueHelpFor,
} from "@/lib/scenario/overrideVocabulary";
import type { ScenarioTemplateCategory, TimelineOverrideTargetType } from "@/lib/api/types";

const CATEGORIES: ScenarioTemplateCategory[] = ["macro", "sector", "company", "liquidity"];

/** effect_profile.overrides entries (apps/api/services/scenario_service.py's
 * apply_scenario_template) only ever read target_type/target_key/
 * target_scope_id/override_value -- effective_from/to_sim_date are filled in
 * later, per-branch, from the branch's own branch point, so a template's
 * stored draft never carries dates at all. */
interface OverrideDraft {
  target_type: TimelineOverrideTargetType;
  target_key: string;
  target_scope_id: number | null;
  override_value: string;
}

function emptyOverride(): OverrideDraft {
  return { target_type: "config", target_key: "", target_scope_id: null, override_value: "" };
}

function ScenarioTemplateList() {
  const { data, isLoading, isError, refetch } = useScenarioLibrary();

  if (isLoading) return <Skeleton width="100%" height={120} />;
  if (isError) return <ErrorState message="Could not load the scenario library." onRetry={() => refetch()} />;
  if (!data || data.length === 0) return <EmptyState title="No scenario templates yet." />;

  return (
    <table className="table-dense w-full">
      <thead>
        <tr>
          <th className="text-left">Name</th>
          <th className="text-left">Category</th>
          <th className="text-left">Duration</th>
          <th className="text-left">Overrides</th>
        </tr>
      </thead>
      <tbody>
        {data.map((t) => (
          <tr key={t.id}>
            <td className="text-text-primary">{t.name}</td>
            <td className="text-text-secondary">{t.category}</td>
            <td className="num text-text-secondary">{t.default_duration_days ?? "—"}</td>
            <td className="num text-text-secondary">
              {Array.isArray(t.effect_profile?.overrides) ? t.effect_profile.overrides.length : 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScenarioTemplateForm() {
  const createTemplate = useCreateScenarioTemplate();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<ScenarioTemplateCategory>("macro");
  const [durationDays, setDurationDays] = React.useState<number | "">("");
  const [overrides, setOverrides] = React.useState<OverrideDraft[]>([emptyOverride()]);

  function updateOverride(index: number, patch: Partial<OverrideDraft>) {
    setOverrides((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function removeOverride(index: number) {
    setOverrides((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setName("");
    setDescription("");
    setCategory("macro");
    setDurationDays("");
    setOverrides([emptyOverride()]);
  }

  const validOverrides = overrides.filter((o) => o.target_key.trim() && o.override_value.trim());
  const canSubmit = name.trim().length > 0 && validOverrides.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    createTemplate.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        category,
        default_duration_days: durationDays === "" ? null : durationDays,
        effect_profile: { overrides: validOverrides },
      },
      { onSuccess: reset },
    );
  }

  const errorMessage =
    createTemplate.isError
      ? createTemplate.error instanceof ApiError
        ? createTemplate.error.message
        : "Failed to create scenario template."
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-name">Name</Label>
          <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Severe Recession" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-category">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ScenarioTemplateCategory)}>
            <SelectTrigger id="template-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-description">Description</Label>
        <Input
          id="template-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown to users picking this scenario in the branch wizard"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-duration">Default duration (days, optional)</Label>
        <Input
          id="template-duration"
          type="number"
          className="w-32"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Overrides</Label>
          <button
            type="button"
            onClick={() => setOverrides((prev) => [...prev, emptyOverride()])}
            className="text-micro text-accent hover:underline"
          >
            + Add override
          </button>
        </div>
        {overrides.map((override, index) => {
          const keyOptions = keyOptionsFor(override.target_type);
          const datalistId = `template-config-key-${index}`;
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <Select
                  value={override.target_type}
                  onValueChange={(v) =>
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

      <Button onClick={handleSubmit} disabled={!canSubmit || createTemplate.isPending}>
        {createTemplate.isPending ? "Creating…" : "Create scenario template"}
      </Button>
      {errorMessage && (
        <p className="text-small text-negative" role="alert">
          {errorMessage}
        </p>
      )}
      {createTemplate.isSuccess && <p className="text-small text-positive">Scenario template created.</p>}

      <div className="border-t border-border pt-3">
        <p className="text-small font-medium text-text-primary mb-2">Existing templates</p>
        <ScenarioTemplateList />
      </div>
    </div>
  );
}
