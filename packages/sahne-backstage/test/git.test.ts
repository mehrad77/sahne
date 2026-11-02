// A content file as git's HEAD has it (server/git.ts), for a root reached through a link (macOS's /tmp is one): git names
// its top folder by the real path, and the file is found under it all the same.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const repo = mkdtempSync(join(tmpdir(), "backstage-git-")), link = `${repo}-link`;
cpSync(SAMPLES, join(repo, "data"), { recursive: true });
const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: repo, stdio: "ignore" });
git("init", "-q"); git("add", "-A"); git("commit", "-qm", "init");
symlinkSync(repo, link);
process.env.SAHNE_CONTENT = join(link, "data");
after(() => { rmSync(link, { force: true }); rmSync(repo, { recursive: true, force: true }); });

const { headOf } = await import("../server/git.ts");

test("a root reached through a link has its files at HEAD", async () => {
  assert.equal((await headOf("story", "s1e00") as { id: string } | null)?.id, "s1e00");
});
