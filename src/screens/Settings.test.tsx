import { act, fireEvent, render, screen } from "@testing-library/react";
import type { GemmaStatus } from "../offline/gemma";
import Settings from "./Settings";

const fake = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let snap: GemmaStatus = { state: "absent" };
  return {
    status: () => snap,
    set(next: GemmaStatus) {
      snap = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    refresh: vi.fn(async () => undefined),
    importFile: vi.fn<(file: File) => Promise<void>>(async () => undefined),
    importUrl: vi.fn<(url: string) => Promise<void>>(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
});

vi.mock("../offline/gemma", () => ({
  MODEL_FILE: "gemma3-1b-it-int4-web.task",
  gemma: fake,
}));

describe("Settings offline tutor", () => {
  beforeEach(() => {
    localStorage.clear();
    fake.set({ state: "absent" });
    fake.importFile.mockClear();
    fake.remove.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows status text per state", () => {
    render(<Settings />);
    expect(screen.getByText("offline tutor")).toBeInTheDocument();
    const status = screen.getByTestId("offline-status");
    expect(status).toHaveTextContent("not installed");
    const cases: [GemmaStatus, string][] = [
      [{ state: "unavailable", reason: "no webgpu" }, "not supported in this browser (needs webgpu)"],
      [{ state: "loading", progress: 42 }, "loading 42 %"],
      [{ state: "loading" }, "loading"],
      [{ state: "ready" }, "ready"],
      [{ state: "error", reason: "no adapter" }, "error: no adapter"],
    ];
    for (const [s, text] of cases) {
      act(() => fake.set(s));
      expect(status).toHaveTextContent(text);
    }
  });

  it("hides the file input when unsupported", () => {
    fake.set({ state: "unavailable" });
    render(<Settings />);
    expect(screen.queryByLabelText("choose gemma3-1b-it-int4-web.task")).not.toBeInTheDocument();
  });

  it("file input triggers importFile", () => {
    render(<Settings />);
    expect(fake.refresh).toHaveBeenCalled();
    const input = screen.getByLabelText("choose gemma3-1b-it-int4-web.task");
    expect(input).toHaveAttribute("accept", ".task");
    const file = new File(["w"], "gemma3-1b-it-int4-web.task");
    fireEvent.change(input, { target: { files: [file] } });
    expect(fake.importFile).toHaveBeenCalledWith(file);
  });

  it("remove asks first, then removes", () => {
    fake.set({ state: "ready" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "remove" }));
    expect(fake.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "remove" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(fake.remove).toHaveBeenCalledTimes(1);
  });

  it("links to the model on Hugging Face", () => {
    render(<Settings />);
    expect(screen.getByRole("link", { name: "hugging face" })).toHaveAttribute(
      "href",
      "https://huggingface.co/litert-community/Gemma3-1B-IT",
    );
  });
});
