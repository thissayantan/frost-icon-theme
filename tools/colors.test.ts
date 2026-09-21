// bun test — the single-colour derivation must reproduce Frost's own palette, and configs must validate strictly.
import { expect, test } from "bun:test";
import { differenceEuclidean, parse } from "culori";
import { derivePair, midTone, validate } from "./colors";
import { palette } from "./lib";

const dE = differenceEuclidean("oklab");

test("a token's mid-tone derives that token's own gradient (ΔE_ok < 0.02)", () => {
  for (const t of palette()) {
    const p = derivePair(`oklch(${midTone(t).l} ${midTone(t).c} ${midTone(t).h ?? 0})`);
    expect(dE(parse(p.light)!, parse(t.light)!), `${t.name} light ${p.light} vs ${t.light}`).toBeLessThan(0.02);
    expect(dE(parse(p.deep)!, parse(t.deep)!), `${t.name} deep ${p.deep} vs ${t.deep}`).toBeLessThan(0.02);
  }
});

test("derived gradients run light → deep", () => {
  for (const c of ["coral", "salmon", "#E8573C", "teal", "slategray", "#FFD700", "hsl(280 60% 55%)"]) {
    const p = derivePair(c);
    expect(parse(p.light)!, c).toBeTruthy();
    const [l, d] = [parse(p.light)!, parse(p.deep)!].map((x) => (x as { r: number; g: number; b: number }));
    expect(l.r + l.g + l.b, c).toBeGreaterThan(d.r + d.g + d.b);
  }
});

test("validation: good configs pass, mistakes say what is wrong", () => {
  expect(validate({ version: 1, folders: "coral", filetypes: { json: "salmon" }, palette: { blue: "#E8573C" } })).toEqual([]);
  expect(validate({ filetypes: "sandybrown" })).toEqual([]);
  expect(validate({ icons: { "user-home": { light: "#FFD1C2", deep: "#C2410C" } } })).toEqual([]);
  expect(validate({ folder: "coral" })[0]).toContain('did you mean "folders"');
  expect(validate({ folders: "not-a-colour" })[0]).toContain("is not a CSS colour");
  expect(validate({ palette: { bleu: "red" } })[0]).toContain('did you mean "blue"');
  expect(validate({ filetypes: { jsn: "red" } })[0]).toContain('did you mean "json"');
  expect(validate({ version: 2 })[0]).toContain("version 1");
});
