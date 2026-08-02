#!/usr/bin/env node
/**
 * Wraps `expo start` so EXPO_PUBLIC_API_BASE_URL always points at this
 * machine's current LAN IP instead of a value hand-edited into `.env` —
 * that value goes stale every time DHCP reassigns an address (Wi-Fi
 * reconnect, router reboot...), which silently breaks API calls from a
 * physical device running Expo Go (127.0.0.1 there means the phone itself).
 */
const { spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const lanIp = resolveLanIp();
if (lanIp) {
  process.env.EXPO_PUBLIC_API_BASE_URL = `http://${lanIp}:8000`;
  console.log(`[mobile] EXPO_PUBLIC_API_BASE_URL -> http://${lanIp}:8000 (auto-detected)`);
} else {
  console.warn("[mobile] Could not auto-detect a LAN IPv4 address, falling back to .env value.");
}

// Skips expo start's network call to Expo's version-check API — flaky behind
// this machine's VPN adapters (crashes with "Body is unusable").
process.env.EXPO_NO_DEPENDENCY_VALIDATION = "1";

// Resolves the local Expo CLI explicitly — a bare "expo" on PATH can shadow
// this with a stale global expo-cli install (legacy, unmaintained, breaks
// with confusing "install @types/react-native" errors on modern SDKs).
const expoBin = path.resolve(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "expo.CMD" : "expo",
);

const child = spawn(expoBin, ["start", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));

function resolveLanIp() {
  const interfaces = os.networkInterfaces();
  // Generic "Ethernet"/numbered variants are excluded on purpose: VirtualBox's
  // host-only adapter shows up as plain "Ethernet 2" on Windows, indistinguishable
  // by name from a real wired connection, so it's not safe to prefer it.
  const excludePattern = /vEthernet|VirtualBox|Host-?Only|VPN|WARP|Tailscale|ZeroTier|Virtual|Loopback/i;
  const preferredPattern = /^Wi-?Fi/i;

  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses || excludePattern.test(name)) {
      continue;
    }
    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        candidates.push({ name, address: address.address });
      }
    }
  }

  const preferred = candidates.find((candidate) => preferredPattern.test(candidate.name));
  return (preferred ?? candidates[0])?.address ?? null;
}
