import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import TabBar, { TABS, useFullScreen, useIsFullScreen } from "./TabBar";

describe("TabBar", () => {
  it("renders the five tabs", () => {
    render(<TabBar screen="review" go={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "main" });
    expect(nav.querySelectorAll("button")).toHaveLength(5);
    for (const t of TABS) expect(screen.getByRole("button", { name: t })).toBeInTheDocument();
  });

  it("marks the current screen selected", () => {
    render(<TabBar screen="diary" go={() => {}} />);
    const diary = screen.getByRole("button", { name: "diary" });
    expect(diary).toHaveAttribute("aria-current", "page");
    expect(diary).toHaveClass("tint-moss");
    expect(screen.getByRole("button", { name: "look" })).not.toHaveAttribute("aria-current");
  });

  it("lights look for the screens that hang off the camera", () => {
    render(<TabBar screen="scene" go={() => {}} />);
    expect(screen.getByRole("button", { name: "look" })).toHaveAttribute("aria-current", "page");
  });

  it("calls go on tap", () => {
    const go = vi.fn();
    render(<TabBar screen="look" go={go} />);
    fireEvent.click(screen.getByRole("button", { name: "listen" }));
    expect(go).toHaveBeenCalledWith("listen");
  });

  it("is hidden in live states", () => {
    const { container } = render(<TabBar screen="roleplay" go={() => {}} hidden />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("tracks full-screen states while they are mounted", () => {
    const state = renderHook(() => useIsFullScreen());
    expect(state.result.current).toBe(false);
    const live = renderHook(({ on }) => useFullScreen(on), { initialProps: { on: true } });
    expect(state.result.current).toBe(true);
    act(() => live.rerender({ on: false }));
    expect(state.result.current).toBe(false);
    act(() => live.rerender({ on: true }));
    live.unmount();
    expect(state.result.current).toBe(false);
  });

  it("uses dark glass on night screens and light glass elsewhere", () => {
    const { rerender } = render(<TabBar screen="look" go={() => {}} />);
    for (const s of ["look", "roleplay", "listen"] as const) {
      rerender(<TabBar screen={s} go={() => {}} />);
      expect(screen.getByRole("navigation")).toHaveClass("glass-dark");
    }
    for (const s of ["review", "diary", "settings"] as const) {
      rerender(<TabBar screen={s} go={() => {}} />);
      expect(screen.getByRole("navigation")).toHaveClass("glass-light");
      expect(screen.getByRole("navigation")).not.toHaveClass("glass-dark");
    }
  });
});
