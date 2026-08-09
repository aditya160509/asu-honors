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
    rngSeed: null,
    ...overrides,
  };
}

describe("PrimitiveStep", () => {
  it("renders all six scenario primitives", () => {
    render(<PrimitiveStep state={baseState()} onChange={vi.fn()} />);
    expect(screen.getByText("Clean baseline")).toBeInTheDocument();
    expect(screen.getByText("Company fundamentals")).toBeInTheDocument();
    expect(screen.getByText("Economy shock")).toBeInTheDocument();
    expect(screen.getByText("What-if range")).toBeInTheDocument();
    expect(screen.getByText("Probability range")).toBeInTheDocument();
    expect(screen.getByText("Liquidity stress")).toBeInTheDocument();
  });

  it("calls onChange with the selected primitive when a card is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrimitiveStep state={baseState()} onChange={onChange} />);

    await user.click(screen.getByText("Economy shock"));

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

    await user.click(screen.getByText("Clean baseline"));

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

    await user.click(screen.getByText("Economy shock"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("visually marks the currently-selected primitive as active", () => {
    render(<PrimitiveStep state={baseState({ primitive: "liquidity_scenario" })} onChange={vi.fn()} />);
    const activeLabel = screen.getByText("Liquidity stress");
    expect(activeLabel.className).toContain("text-accent");

    const inactiveLabel = screen.getByText("Clean baseline");
    expect(inactiveLabel.className).not.toContain("text-accent");
  });
});
