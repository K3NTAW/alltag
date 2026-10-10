import { act, renderHook } from "@testing-library/react";
import { go, useScreen } from "./screen";

describe("screen", () => {
  it("starts on look", () => {
    const { result } = renderHook(() => useScreen());
    expect(result.current.screen).toBe("look");
  });

  it("go updates a rendered hook", () => {
    const { result } = renderHook(() => useScreen());
    act(() => go("scene"));
    expect(result.current.screen).toBe("scene");
    act(() => result.current.go("look"));
    expect(result.current.screen).toBe("look");
  });

  it("go with the same screen is a no-op", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useScreen();
    });
    const before = renders;
    act(() => go(result.current.screen));
    expect(renders).toBe(before);
    expect(result.current.screen).toBe("look");
  });
});
