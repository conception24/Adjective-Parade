import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const result = spawnSync(process.execPath, [vite, "build"], {
  stdio: "inherit",
  env: { ...process.env, ADJECTIVE_PARADE_TARGET: "cloudflare" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
