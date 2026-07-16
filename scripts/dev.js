import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(name, command, args, opts = {}) {
  const child = spawn(command, args, {
    stdio: "pipe",
    cwd: root,
    env: { ...process.env, FORCE_COLOR: "1" },
    ...opts,
  });
  child.stdout.on("data", (d) =>
    process.stdout.write(`[${name}] ${d}`)
  );
  child.stderr.on("data", (d) =>
    process.stderr.write(`[${name}] ${d}`)
  );
  child.on("exit", (code) => {
    if (code !== 0) console.log(`[${name}] exited with code ${code}`);
  });
  return child;
}

console.log("Starting Nexus Exchange development servers...\n");

const server = run("server", "bun", [
  "--watch",
  "server/src/index.ts",
]);

const client = run("client", "bun", [
  "x",
  "vite",
  "--config",
  "client/vite.config.ts",
]);

process.on("SIGINT", () => {
  server.kill();
  client.kill();
  process.exit();
});
process.on("SIGTERM", () => {
  server.kill();
  client.kill();
  process.exit();
});