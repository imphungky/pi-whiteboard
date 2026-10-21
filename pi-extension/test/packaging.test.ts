import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, posix, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../..");

type PackedFile = { path: string };

function packedFiles(): string[] {
  // A literal command avoids both the .cmd spawn restriction on Windows and
  // the arg-escaping deprecation that `shell: true` plus an args array emits.
  const output = execSync("npm pack --dry-run --json", {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const [result] = JSON.parse(output) as [{ files: PackedFile[] }];
  return result.files.map((file) => file.path.split("\\").join("/"));
}

function manifestExtensions(): string[] {
  const manifest = JSON.parse(
    readFileSync(resolve(repoRoot, "package.json"), "utf8"),
  ) as { pi?: { extensions?: string[] } };
  return manifest.pi?.extensions ?? [];
}

/**
 * Resolve a TypeScript module and every module it reaches through relative
 * imports. Extension sources are authored with NodeNext ".js" specifiers that
 * resolve back to ".ts" on disk, which jiti mirrors at load time.
 */
function reachableSources(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const absolute = resolve(repoRoot, current);
    if (seen.has(current) || !existsSync(absolute)) {
      continue;
    }
    seen.add(current);

    const source = readFileSync(absolute, "utf8");
    const specifiers = [...source.matchAll(/from\s+"(\.[^"]+)"/g)].map(
      (match) => match[1],
    );

    for (const specifier of specifiers) {
      const candidate = specifier.replace(/\.js$/, ".ts");
      const resolved = resolve(dirname(absolute), candidate);
      queue.push(relative(repoRoot, resolved).split("\\").join("/"));
    }
  }

  return [...seen];
}

describe("published package", () => {
  it("declares at least one pi extension", () => {
    expect(manifestExtensions().length).toBeGreaterThan(0);
  });

  it("ships every module the declared extensions load", () => {
    const files = packedFiles();
    const missing: string[] = [];

    for (const extension of manifestExtensions()) {
      const entry = posix.normalize(extension.replace(/^\.\//, ""));
      for (const source of reachableSources(entry)) {
        if (!files.includes(source)) {
          missing.push(source);
        }
      }
    }

    // A path declared under `pi.extensions` but absent from the tarball makes
    // Pi skip the extension silently: no command is registered and no warning
    // is printed.
    expect(missing).toEqual([]);
  }, 120_000);
});
