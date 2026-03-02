import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited via signal ${signal}`);
      return;
    }
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code || 1;
      shutdown();
    }
  });

  child.on("error", (err) => {
    console.error(`[${name}] failed to start:`, err.message);
    process.exitCode = 1;
    shutdown();
  });

  return child;
}

const api = run("api", process.execPath, ["server.js"]);
const ui = run("ui", npmCmd, ["run", "dev:ui"]);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    api.kill("SIGTERM");
  } catch {}
  try {
    ui.kill("SIGTERM");
  } catch {}
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
