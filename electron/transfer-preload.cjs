const { contextBridge, ipcRenderer } = require("electron");

if (window.top === window && location.protocol === "http:" && location.hostname === "127.0.0.1" && location.pathname === "/") {
  let handler;
  ipcRenderer.on("transfer:request", async (_event, { id, operation, body, expiresAt }) => {
    try {
      if (!handler) throw new Error("NOT_READY");
      const value = await handler({ operation, body, expiresAt });
      ipcRenderer.send("transfer:reply", { id, ok: true, value });
    } catch (error) {
      const code = ["BUSY", "STALE", "INVALID", "NOT_READY", "TOO_LARGE", "TIMEOUT"].includes(error?.message) ? error.message : "INVALID";
      ipcRenderer.send("transfer:reply", { id, ok: false, code });
    }
  });
  contextBridge.exposeInMainWorld("promptTransfer", {
    onRequest(callback) {
      if (handler || typeof callback !== "function") throw new Error("Invalid receiver registration");
      handler = callback;
    },
    ready() {
      if (!handler) throw new Error("Missing receiver registration");
      return ipcRenderer.invoke("transfer:ready");
    },
    finish: (id, state) => ipcRenderer.invoke("transfer:finish", id, state),
  });
}
