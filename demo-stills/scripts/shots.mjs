// Screenshots the v3 boards (only screens that exist in the app) into public/shots/.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const DIR = "/Users/k3ntaw/code/alltag/.orchestrator/design/v3/project";
const VO = "/Users/k3ntaw/Downloads/alltag-voiceover.mp3";
export const BOARDS = [
  "CameraIdle", "CameraScanning", "SceneLabels", "ObjectSheet", "RoleplayStart", "RoleplayListening",
  "RoleplayReply", "Corrections", "ExchangeDone", "ReviewQueue", "ReviewCard", "ReviewResult",
  "RecallTrigger", "Diary", "StateEmptyReview", "ListenIdle", "ListenLive", "ListenLearn",
  "Settings", "SignIn", "StateOffline",
];

mkdirSync("public/shots", { recursive: true });
if (existsSync(VO)) copyFileSync(VO, "public/voiceover.mp3");

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
for (const b of BOARDS) {
  const file = `${DIR}/${b}.dc.html`;
  if (!existsSync(file)) { console.log(`skip ${b}`); continue; }
  await page.goto(`file://${file}`, { waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `public/shots/${b}.png` });
  console.log(`shot ${b}`);
}
await browser.close();

// No real voice-over: placeholder narration with macOS say.
if (!existsSync(VO)) {
  const { execFileSync } = await import("node:child_process");
  const { readFileSync, writeFileSync } = await import("node:fs");
  const src = readFileSync("src/narration.ts", "utf8");
  const text = [...src.matchAll(/^\s*"(.*)",$/gm)].map((m) => m[1]).slice(0, 12).join("\n\n");
  writeFileSync("/tmp/alltag-narration.txt", text);
  execFileSync("say", ["-v", "Samantha", "-f", "/tmp/alltag-narration.txt", "--data-format=LEI16@44100", "-o", "public/voiceover.wav"]);
  console.log("placeholder voice-over: say -v Samantha");
}
