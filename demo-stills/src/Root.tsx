import { Composition, getStaticFiles, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { Stills, type StillsProps } from "./Stills";

const FPS = 30;
const TAIL_S = 1.5;

const audioFile = (): string => {
  const names = getStaticFiles().map((f) => f.name);
  return names.includes("voiceover.mp3") ? "voiceover.mp3" : "voiceover.wav";
};

export const RemotionRoot = () => (
  <Composition
    id="AlltagStills"
    component={Stills}
    width={1920}
    height={1080}
    fps={FPS}
    durationInFrames={120 * FPS}
    defaultProps={{ audio: "voiceover.mp3", audioSeconds: 120 } as StillsProps}
    calculateMetadata={async () => {
      const audio = audioFile();
      const audioSeconds = await getAudioDurationInSeconds(staticFile(audio));
      return {
        durationInFrames: Math.ceil((audioSeconds + TAIL_S) * FPS),
        props: { audio, audioSeconds },
      };
    }}
  />
);
