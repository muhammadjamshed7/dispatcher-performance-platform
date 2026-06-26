import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = fs.realpathSync.native(path.join(scriptDir, ".."));

process.chdir(projectRoot);

const result = spawnSync("npx", ["next", "build"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    // Keep cwd and tracing roots aligned with the canonical filesystem path.
    INIT_CWD: projectRoot,
  },
});

process.exit(result.status ?? 1);
