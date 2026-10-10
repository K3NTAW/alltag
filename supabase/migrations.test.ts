// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(__dirname, "migrations/20261010120000_init.sql"), "utf8");
const tables = ["profiles", "items", "scenes", "conversations"];

describe("init migration", () => {
  it("defines current_user_id() from the Clerk sub", () => {
    expect(sql).toMatch(/function public\.current_user_id\(\)/);
    expect(sql).toContain("auth.jwt()->>'sub'");
  });

  for (const t of tables) {
    it(`${t}: table, RLS and an own-row policy`, () => {
      expect(sql).toContain(`create table public.${t} (`);
      expect(sql).toContain(`alter table public.${t} enable row level security`);
      const policies = sql.match(new RegExp(`create policy [^;]* on public\\.${t} [^;]*;`, "g")) ?? [];
      for (const op of ["select", "insert", "update", "delete"]) {
        const p = policies.find((s) => s.includes(` for ${op} `));
        expect(p, `${t} ${op} policy`).toBeDefined();
        expect(p).toContain("public.current_user_id()");
      }
    });
  }

  it("creates the scenes bucket private", () => {
    expect(sql).toMatch(/insert into storage\.buckets \(id, name, public\) values \('scenes', 'scenes', false\)/);
  });

  it("scopes storage policies to the user's folder", () => {
    const policies = sql.match(/create policy [^;]* on storage\.objects [^;]*;/g) ?? [];
    for (const op of ["select", "insert", "update", "delete"]) {
      const p = policies.find((s) => s.includes(` for ${op} `));
      expect(p, `storage ${op} policy`).toBeDefined();
      expect(p).toContain("bucket_id = 'scenes'");
      expect(p).toContain("(storage.foldername(name))[1] = public.current_user_id()");
    }
  });

  it("grants anon nothing", () => {
    expect(sql).not.toMatch(/\bto anon\b/);
  });
});
