import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimitiveStep } from "./PrimitiveStep";
import type { BranchWizardState } from "./BranchWizard";

function baseState(overrides: Partial<BranchWizardState> = {}): BranchWizardState {
  return {
    name: "",
    parentTimelineId: null,
    branchPointSimDate: "",
    primitive: "manual",
    scenarioTemplateId: null,
    overrides: [],
    fastForwardDays: 0,
    ...overrides,
  };
}

describe("PrimitiveStep", () => {
  it("renders all six scenario primitives", () => {
    render(<PrimitiveStep state={baseState()} onChange={vi.fn()} />);
    expect(screen.getByText("Manual / freeform")).toBeInTheDocument();
    expect(screen.getByText("Structural override")).toBeInTheDocument();
    expect(screen.getByText("Macro shock")).toBeInTheDocument();
    expect(screen.getByText("Sensitivity sweep")).toBeInTheDocument();
    expect(screen.getByText("Monte Carlo ensemble")).toBeInTheDocument();
    expect(screen.getByText("Liquidity scenario")).toBeInTheDocument();
  });

  it("calls onChange with the selected primitive when a card is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrimitiveStep state={baseState()} onChange={onChange} />);

    await user.click(screen.getByText("Macro shock"));

    expect(onChange).toHaveBeenCalledWith({
      primitive: "macro_shock",
      scenarioTemplateId: null,
      overrides: [],
    });
  });

  it("clears scenarioTemplateId and overrides when switching to a different primitive", async () => {
    // Regression test: overrides materialized from a macro_shock scenario
    // template must not silently carry over into e.g. a "manual" branch,
    // which the Configure step claims needs no overrides at all.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PrimitiveStep
        state={baseState({
          primitive: "macro_shock",
          scenarioTemplateId: 7,
          overrides: [
            {
              target_type: "driver_bias",
              target_key: "economic_outlook",
              override_value: "-0.4",
              effective_from_sim_date: "2026-01-02",
            },
          ],
        })}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText("Manual / freeform"));

    expect(onChange).toHaveBeenCalledWith({
      primitive: "manual",
      scenarioTemplateId: null,
      overrides: [],
    });
  });

  it("does not call onChange when re-clicking the already-selected primitive", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrimitiveStep state={baseState({ primitive: "macro_shock" })} onChange={onChange} />);

    await user.click(screen.getByText("Macro shock"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("visually marks the currently-selected primitive as active", () => {
    render(<PrimitiveStep state={baseState({ primitive: "liquidity_scenario" })} onChange={vi.fn()} />);
    const activeLabel = screen.getByText("Liquidity scenario");
    expect(activeLabel.className).toContain("text-accent");

    const inactiveLabel = screen.getByText("Manual / freeform");
    expect(inactiveLabel.className).not.toContain("text-accent");
  });
});
