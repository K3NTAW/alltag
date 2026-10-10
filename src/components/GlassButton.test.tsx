import { fireEvent, render, screen } from "@testing-library/react";
import GlassButton, { MicFace } from "./GlassButton";

describe("GlassButton", () => {
  it("is named by its aria-label", () => {
    const onClick = vi.fn();
    render(
      <GlassButton aria-label="close" onClick={onClick}>
        <svg aria-hidden />
      </GlassButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("requires an aria-label", () => {
    // @ts-expect-error aria-label is required
    const el = <GlassButton>x</GlassButton>;
    expect(el).toBeTruthy();
  });

  it("uses light glass by default and dark glass when asked", () => {
    const { rerender } = render(<GlassButton aria-label="back">x</GlassButton>);
    expect(screen.getByRole("button")).toHaveClass("glass-light", "glass-specular");
    rerender(
      <GlassButton aria-label="back" variant="dark">
        x
      </GlassButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("glass-dark");
    expect(screen.getByRole("button")).not.toHaveClass("glass-light");
  });
});

describe("MicFace", () => {
  it("uses clear glass on dark surfaces and shows the state dot", () => {
    const { container, rerender } = render(<MicFace state="speaking" />);
    expect(container.querySelector(".glass-clear")).not.toBeNull();
    expect(container.querySelector(".bg-sun")).not.toBeNull();
    rerender(<MicFace state="listening" surface="light" />);
    expect(container.querySelector(".glass-light")).not.toBeNull();
    expect(container.querySelector(".bg-moss")).not.toBeNull();
  });
});
