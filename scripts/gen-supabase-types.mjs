import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFromFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(rawValue);
  }
}

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptDir, "..");

loadEnvFromFile(resolve(repoRoot, ".env"));
loadEnvFromFile(resolve(repoRoot, ".env.local"));

const projectId = process.env.SUPABASE_PROJECT_ID;

if (!projectId) {
  console.error("Missing SUPABASE_PROJECT_ID. Set it in your environment before running npm run gen:types.");
  process.exit(1);
}

const cliCommand = `npx supabase gen types typescript --project-id ${projectId}`;
const result = spawnSync(cliCommand, {
  encoding: "utf8",
  shell: true,
});

if (result.error) {
  console.error("Failed to run Supabase CLI:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exit(result.status ?? 1);
}

const outputPath = resolve(repoRoot, "src/types/database.ts");
writeFileSync(outputPath, result.stdout, "utf8");

console.log("Generated Supabase types at src/types/database.ts");
