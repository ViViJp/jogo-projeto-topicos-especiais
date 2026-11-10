import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(process.execPath, ["server/signaling-server.mjs"], {
    cwd: projectDirectory,
    env: process.env,
    stdio: "inherit",
  }),
  spawn(npmCommand, ["run", "dev:network"], {
    cwd: projectDirectory,
    env: process.env,
    stdio: "inherit",
  }),
];

let stopping = false;

children.forEach((child) => {
  child.on("exit", (code, signal) => {
    if (stopping) return;
    stopping = true;
    children.forEach((other) => {
      if (other !== child && other.exitCode === null) other.kill("SIGTERM");
    });
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    children.forEach((child) => {
      if (child.exitCode === null) child.kill(signal);
    });
  });
}
