/**
 * Pixel position inside a box of a normalised image point (0..1) when the
 * image is drawn with object-fit: cover, centred. The result can fall outside
 * the box when that part of the image is cropped away.
 */
export function coverPoint(
  bx: number,
  by: number,
  natW: number,
  natH: number,
  boxW: number,
  boxH: number,
): { x: number; y: number } {
  const scale = Math.max(boxW / natW, boxH / natH);
  const w = natW * scale;
  const h = natH * scale;
  return { x: bx * w - (w - boxW) / 2, y: by * h - (h - boxH) / 2 };
}
