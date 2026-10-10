// AudioWorkletProcessor source, kept as a string so it can be loaded from a
// Blob URL without a separate bundler entry.
export const pcmWorkletSource = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

export function workletUrl(): string {
  const blob = new Blob([pcmWorkletSource], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}
