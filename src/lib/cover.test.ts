import { coverPoint } from "./cover";

describe("coverPoint", () => {
  it("crops the sides of a wider image", () => {
    // 2000x1000 into 400x800: scale 0.8, drawn 1600x800, 600 cut each side
    expect(coverPoint(0.5, 0.5, 2000, 1000, 400, 800)).toEqual({
      x: 200,
      y: 400,
    });
    expect(coverPoint(0.5, 0.25, 2000, 1000, 400, 800)).toEqual({
      x: 200,
      y: 200,
    });
    expect(coverPoint(0.4, 0, 2000, 1000, 400, 800).x).toBeCloseTo(40);
  });

  it("crops top and bottom of a taller image", () => {
    // 1000x3000 into 400x800: scale 0.4, drawn 400x1200, 200 cut top and bottom
    expect(coverPoint(0.5, 0.5, 1000, 3000, 400, 800)).toEqual({
      x: 200,
      y: 400,
    });
    expect(coverPoint(0.25, 0.25, 1000, 3000, 400, 800)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("maps linearly on an exact fit", () => {
    expect(coverPoint(0.3, 0.7, 800, 1600, 400, 800)).toEqual({
      x: 120,
      y: 560,
    });
    expect(coverPoint(0, 1, 400, 800, 400, 800)).toEqual({ x: 0, y: 800 });
  });

  it("returns a point outside the box when it is cropped out", () => {
    const p = coverPoint(0.05, 0.5, 2000, 1000, 400, 800);
    expect(p.x).toBeLessThan(0);
    const q = coverPoint(0.5, 0.95, 1000, 3000, 400, 800);
    expect(q.y).toBeGreaterThan(800);
  });
});
