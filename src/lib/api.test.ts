import type { CorrectRequest, SceneResult, TurnRequest } from "./types";
import { localCorrect, localTurn } from "../offline/local-api";
import { postCorrect, postTurn } from "./api";

vi.mock("../offline/local-api", () => ({
  localTurn: vi.fn(),
  localCorrect: vi.fn(),
}));

const scene: SceneResult = {
  place: "café",
  objects: [],
  task: { fr: "commande un café", en: "order a coffee", role: "serveur" },
};
const turnReq: TurnRequest = { scene, history: [], userText: "un café", level: "A1" };
const correctReq: CorrectRequest = { scene, userText: "un café", level: "A1" };
const cloudTurn = { reply_fr: "voilà", reply_en: "here", task_done: false };
const localReply = { reply_fr: "d'accord", reply_en: "ok", task_done: false };
const localFix = { corrections: [], kept_phrase_fr: "un café" };

const fetchMock = vi.fn();

describe("api offline fallback", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(localTurn).mockReset().mockResolvedValue(localReply);
    vi.mocked(localCorrect).mockReset().mockResolvedValue(localFix);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the cloud when online", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(cloudTurn), { status: 200 }));
    expect(await postTurn(turnReq)).toEqual(cloudTurn);
    expect(localTurn).not.toHaveBeenCalled();
  });

  it("postTurn falls back to local when fetch rejects with TypeError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await postTurn(turnReq)).toEqual({ ...localReply, source: "local" });
    expect(localTurn).toHaveBeenCalledWith(turnReq);
  });

  it("postCorrect falls back to local when fetch rejects with TypeError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await postCorrect(correctReq)).toEqual({ ...localFix, source: "local" });
    expect(localCorrect).toHaveBeenCalledWith(correctReq);
  });

  it("goes local without fetching when navigator is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await postTurn(turnReq)).toEqual({ ...localReply, source: "local" });
    expect(await postCorrect(correctReq)).toEqual({ ...localFix, source: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fall back on HTTP 500", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 500 }));
    await expect(postTurn(turnReq)).rejects.toThrow("turn 500");
    await expect(postCorrect(correctReq)).rejects.toThrow("correct 500");
    expect(localTurn).not.toHaveBeenCalled();
    expect(localCorrect).not.toHaveBeenCalled();
  });

  it("surfaces local failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.mocked(localTurn).mockRejectedValue(new Error("offline tutor unavailable"));
    await expect(postTurn(turnReq)).rejects.toThrow("offline tutor unavailable");
  });
});
