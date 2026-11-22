import { app, ipcMain } from "electron";
import { randomBytes, randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { createReceiver, protocol } from "./transfer-receiver.mjs";
import { prepareRegistry, registryPath, writeRegistryFile } from "./transfer-registry.mjs";

export function attachTransfer(window, origin) {
  const contents = window.webContents;
  const inflight = new Map();
  let receiver, manifest, startup, epoch = 0;
  const trusted = event => !contents.isDestroyed() && event.sender === contents &&
    event.senderFrame === contents.mainFrame && event.senderFrame.url === origin + "/";

  function retire() {
    epoch++;
    receiver?.close();
    receiver = undefined;
    startup = undefined;
    if (manifest) {
      try { unlinkSync(manifest); } catch { /* Stale manifests fail authenticated discovery. */ }
      manifest = undefined;
    }
    for (const pending of inflight.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("NOT_READY"));
    }
    inflight.clear();
  }
  function ask(operation, body, expiresAt) {
    if (contents.isDestroyed() || contents.mainFrame.url !== origin + "/") throw new Error("NOT_READY");
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      // A preview decision is renderer-owned even if an HTTP client disconnects.
      const timer = operation !== "preview" ? setTimeout(() => {
        inflight.delete(id);
        reject(new Error("TIMEOUT"));
      }, 2500) : undefined;
      inflight.set(id, { resolve, reject, timer });
      try { contents.send("transfer:request", { id, operation, body, expiresAt }); }
      catch {
        clearTimeout(timer);
        inflight.delete(id);
        reject(new Error("NOT_READY"));
      }
    }).then(result => {
      if (operation === "preview" && result?.state === "pending" && !window.isDestroyed()) {
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
      }
      return result;
    });
  }

  async function publish(version) {
    const root = registryPath();
    await prepareRegistry(root);
    if (version !== epoch) throw new Error("NOT_READY");
    const instanceId = randomUUID();
    const secret = randomBytes(32).toString("hex");
    const local = createReceiver({ instanceId, secret, ask, onUnavailable: retire });
    const file = path.join(root, "instances", instanceId + ".json");
    try {
      const port = await local.listen();
      if (version !== epoch) throw new Error("NOT_READY");
      await writeRegistryFile(file, { protocol, instanceId, port, secret, pid: process.pid });
      if (version !== epoch) { unlinkSync(file); throw new Error("NOT_READY"); }
      receiver = local;
      manifest = file;
      window.setTitle(`${app.getName()} ${app.getVersion()} · PID ${process.pid} · ${instanceId.slice(0, 8)}`);
    } catch (error) {
      local.close();
      throw error;
    }
  }

  ipcMain.handle("transfer:ready", async event => {
    if (!trusted(event)) throw new Error("NOT_READY");
    if (!startup) {
      const version = epoch;
      startup = publish(version).catch(() => {
        if (version === epoch) startup = undefined;
        throw new Error("NOT_READY");
      });
    }
    await startup;
    return true;
  });
  ipcMain.on("transfer:reply", (event, message) => {
    if (!trusted(event)) return;
    const pending = inflight.get(message?.id);
    if (!pending) return;
    inflight.delete(message.id);
    clearTimeout(pending.timer);
    if (message.ok) pending.resolve(message.value);
    else pending.reject(new Error(["BUSY", "STALE", "INVALID", "NOT_READY", "TOO_LARGE", "TIMEOUT"].includes(message.code) ? message.code : "INVALID"));
  });
  ipcMain.handle("transfer:finish", (event, id, state) => trusted(event) && !!receiver?.finish(id, state));
  contents.on("will-navigate", event => event.preventDefault());
  window.on("page-title-updated", event => event.preventDefault());
  contents.on("will-redirect", event => event.preventDefault());
  contents.on("did-navigate", retire);
  contents.on("render-process-gone", retire);
  app.on("before-quit", retire);
  window.once("closed", () => {
    retire();
    app.off("before-quit", retire);
    ipcMain.removeHandler("transfer:ready");
    ipcMain.removeHandler("transfer:finish");
    ipcMain.removeAllListeners("transfer:reply");
  });
}
