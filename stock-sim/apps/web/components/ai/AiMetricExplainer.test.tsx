import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiMetricExplainer } from "./AiMetricExplainer";
import { post } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  post: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AiMetricExplainer", () => {
  afterEach(() => {
    vi.mocked(post).mockReset();
  });

  it("does not fetch on mount -- only after the user clicks 'Explain with AI'", async () => {
    renderWithClient(<AiMetricExplainer metricName="Sharpe Ratio" />);

    expect(screen.getByText("Explain with AI")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("fetches and renders an explanation only after the button is clicked", async () => {
    vi.mocked(post).mockResolvedValueOnce({ explanation: "Sharpe measures risk-adjusted return." });
    const user = userEvent.setup();

    renderWithClient(<AiMetricExplainer metricName="Sharpe Ratio" />);
    await user.click(screen.getByText("Explain with AI"));

    await waitFor(() => {
      expect(screen.getByText("Sharpe measures risk-adjusted return.")).toBeInTheDocument();
    });
    expect(post).toHaveBeenCalledWith("/ai/explain-metric", { metric_name: "Sharpe Ratio", value: undefined });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("passes the metric's current value into the request", async () => {
    vi.mocked(post).mockResolvedValueOnce({ explanation: "..." });
    const user = userEvent.setup();

    renderWithClient(<AiMetricExplainer metricName="P/E ratio" value={47.3} />);
    await user.click(screen.getByText("Explain with AI"));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/ai/explain-metric", { metric_name: "P/E ratio", value: 47.3 });
  });

  it("de-duplicates simultaneous requests for the same metric (Radix Tooltip double-mount)", async () => {
    vi.mocked(post).mockResolvedValueOnce({ explanation: "Same explanation." });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Two instances sharing one QueryClient -- mirrors Radix Tooltip.Content
    // mounting its children twice (visible popup + visually-hidden a11y copy).
    render(
      <QueryClientProvider client={queryClient}>
        <AiMetricExplainer metricName="Sharpe Ratio" />
        <AiMetricExplainer metricName="Sharpe Ratio" />
      </QueryClientProvider>
    );
    const buttons = screen.getAllByText("Explain with AI");
    await user.click(buttons[0]);
    await user.click(buttons[1]);

    await waitFor(() => {
      expect(screen.getAllByText("Same explanation.")).toHaveLength(2);
    });
    // React Query's cache de-dupes the identical key -- one network call serves both.
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("shows a contained error state instead of throwing when the request fails", async () => {
    vi.mocked(post).mockRejectedValueOnce(new Error("503"));
    const user = userEvent.setup();

    renderWithClient(<AiMetricExplainer metricName="Sharpe Ratio" />);
    await user.click(screen.getByText("Explain with AI"));

    await waitFor(() => {
      expect(screen.getByText("Couldn't generate an explanation.")).toBeInTheDocument();
    });
  });
});
