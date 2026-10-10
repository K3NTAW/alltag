import { render, screen } from "@testing-library/react";
import Orb, { type OrbState } from "./Orb";

describe("Orb", () => {
  it("renders each state with its label and motion class", () => {
    const cls: Record<OrbState, string> = {
      idle: "orb-breathe",
      listening: "orb-listen",
      thinking: "orb-think",
      speaking: "orb-speak",
    };
    for (const state of Object.keys(cls) as OrbState[]) {
      const { unmount } = render(<Orb state={state} />);
      const orb = screen.getByRole("img", { name: `Noé, ${state}` });
      expect(orb).toHaveClass(cls[state]);
      expect(orb).toHaveAttribute("data-state", state);
      unmount();
    }
  });

  it("uses the v3 gradient", () => {
    const { container } = render(<Orb />);
    const html = container.innerHTML;
    for (const c of ["#0E5C47", "#2FA37F", "#BFE8D6", "#F0C766"]) expect(html).toContain(c);
  });

  it("sizes the box and defaults to idle", () => {
    render(<Orb size={96} />);
    const orb = screen.getByRole("img", { name: "Noé, idle" });
    expect(orb).toHaveStyle({ width: "96px", height: "96px" });
  });

  it("shows ripple rings only while listening or speaking, dots only while thinking", () => {
    const { container, rerender } = render(<Orb state="idle" />);
    expect(container.querySelectorAll(".orb-ring")).toHaveLength(0);
    rerender(<Orb state="listening" />);
    expect(container.querySelectorAll(".orb-ring")).toHaveLength(2);
    rerender(<Orb state="speaking" />);
    expect(container.querySelectorAll(".orb-ring")).toHaveLength(2);
    rerender(<Orb state="thinking" />);
    expect(container.querySelectorAll(".orb-ring")).toHaveLength(0);
    expect(container.querySelectorAll(".orb-dot")).toHaveLength(3);
  });
});
