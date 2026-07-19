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

    expect(onChange).toHaveBeenCalledWith({ primitive: "macro_shock" });
  });

  it("visually marks the currently-selected primitive as active", () => {
    render(<PrimitiveStep state={baseState({ primitive: "liquidity_scenario" })} onChange={vi.fn()} />);
    const activeLabel = screen.getByText("Liquidity scenario");
    expect(activeLabel.className).toContain("text-accent");

    const inactiveLabel = screen.getByText("Manual / freeform");
    expect(inactiveLabel.className).not.toContain("text-accent");
  });
});
