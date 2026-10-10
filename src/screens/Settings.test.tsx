import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  MODEL_FILE: "gemma-4-E2B-it-web.task",
  MODEL_LABEL: "Gemma 4 E2B",
  MODEL_LICENCE: { name: "Apache 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  gemma: fake,
}));

type InstallState = {
  canInstall: boolean;
  install: () => Promise<void>;
  platform: "android" | "ios" | "other";
  installed: boolean;
};

const pwa = vi.hoisted(() => {
  const base = () => ({
    canInstall: false,
    install: vi.fn(async () => undefined),
    platform: "other" as const,
    installed: false,
  });
  return { base, state: base() as InstallState };
});

vi.mock("../pwa/install", () => ({ useInstallPrompt: () => pwa.state }));

describe("Settings on your phone", () => {
  beforeEach(() => {
    localStorage.clear();
    fake.set({ state: "absent" });
    pwa.state = pwa.base();
  });

  it("sits above the offline tutor", () => {
    render(<Settings />);
    const phone = screen.getByText("on your phone");
    const tutor = screen.getByText("offline tutor");
    expect(phone.compareDocumentPosition(tutor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("installed", () => {
    pwa.state = { ...pwa.base(), installed: true };
    render(<Settings />);
    expect(screen.getByText("installed. works offline.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "add to home screen" })).not.toBeInTheDocument();
  });

  it("installable: the button calls install()", () => {
    pwa.state = { ...pwa.base(), canInstall: true, platform: "android" };
    render(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: "add to home screen" }));
    expect(pwa.state.install).toHaveBeenCalledTimes(1);
  });

  it("ios: three-line instructions", () => {
    pwa.state = { ...pwa.base(), platform: "ios" };
    render(<Settings />);
    const items = within(screen.getByTestId("on-your-phone")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["open in safari", "tap share", "add to home screen"]);
  });

  it("elsewhere: open it on your phone", () => {
    render(<Settings />);
    expect(screen.getByText("open this page on your phone to install it")).toBeInTheDocument();
  });
});

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
    expect(screen.queryByLabelText("choose gemma-4-E2B-it-web.task")).not.toBeInTheDocument();
  });

  it("file input triggers importFile", () => {
    render(<Settings />);
    expect(fake.refresh).toHaveBeenCalled();
    const input = screen.getByLabelText("choose gemma-4-E2B-it-web.task");
    expect(input).toHaveAttribute("accept", ".task");
    const file = new File(["w"], "gemma-4-E2B-it-web.task");
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
      "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm",
    );
  });

  it("bundled: built-in text, no file input, no remove", () => {
    fake.set({ state: "ready", source: "bundled" });
    render(<Settings />);
    expect(screen.getByTestId("offline-status")).toHaveTextContent("ready, built into the app");
    expect(screen.queryByLabelText("choose gemma-4-E2B-it-web.task")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "hugging face" })).not.toBeInTheDocument();
  });

  it("licence line when bundled or installed, not when absent", () => {
    const { unmount } = render(<Settings />);
    expect(screen.queryByRole("link", { name: "Apache 2.0" })).not.toBeInTheDocument();
    unmount();
    for (const s of [{ state: "ready", source: "bundled" }, { state: "ready", source: "opfs" }] as GemmaStatus[]) {
      fake.set(s);
      const view = render(<Settings />);
      expect(screen.getByText(/on-device model: Gemma 4 E2B, Apache 2.0/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Apache 2.0" })).toHaveAttribute(
        "href",
        "https://www.apache.org/licenses/LICENSE-2.0",
      );
      expect(screen.queryByRole("link", { name: /Gemma Terms/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /prohibited use/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
