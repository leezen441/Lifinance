/**
 * Resolution hook for `node --test`.
 *
 * The source uses bundler-style imports ("./date", "@/lib/types") because
 * that is what Next resolves. Node's native ESM loader wants explicit
 * extensions, so this maps the two forms it can't figure out on its own.
 * Test-only — nothing in the app bundle goes through here.
 */

import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function firstExisting(base) {
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL
      ? dirname(fileURLToPath(context.parentURL))
      : process.cwd();
    const url = firstExisting(resolvePath(parent, specifier));
    if (url) return { url, shortCircuit: true, format: "module-typescript" };
  }

  if (specifier.startsWith("@/")) {
    const url = firstExisting(resolvePath(process.cwd(), "src", specifier.slice(2)));
    if (url) return { url, shortCircuit: true, format: "module-typescript" };
  }

  return nextResolve(specifier, context);
}
