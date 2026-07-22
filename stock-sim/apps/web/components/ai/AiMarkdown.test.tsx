import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiMarkdown } from "./AiMarkdown";

describe("AiMarkdown", () => {
  it("renders plain text as a paragraph", () => {
    render(<AiMarkdown text="A simple sentence." />);
    expect(screen.getByText("A simple sentence.")).toBeInTheDocument();
  });

  it("renders **bold** spans as <strong>", () => {
    render(<AiMarkdown text="The **Total Return** is high." />);
    const strong = screen.getByText("Total Return");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders a block of '- ' lines as a bullet list", () => {
    render(<AiMarkdown text={"- First point\n- Second point"} />);
    const list = screen.getByText("First point").closest("ul");
    expect(list).not.toBeNull();
    expect(screen.getByText("Second point").closest("li")).not.toBeNull();
  });

  it("renders a block of '1. ' lines as a numbered list", () => {
    render(<AiMarkdown text={"1. First\n2. Second"} />);
    const list = screen.getByText("First").closest("ol");
    expect(list).not.toBeNull();
  });

  it("keeps separate blank-line-separated paragraphs distinct", () => {
    render(<AiMarkdown text={"First paragraph.\n\nSecond paragraph."} />);
    expect(screen.getByText("First paragraph.").tagName).toBe("P");
    expect(screen.getByText("Second paragraph.").tagName).toBe("P");
  });
});
