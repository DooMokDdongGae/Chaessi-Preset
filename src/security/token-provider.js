import { EnvSecretStore } from "./secret-store.js";

export function createTokenProvider({ secretStore = new EnvSecretStore() } = {}) {
  return {
    getToken(provider) {
      return secretStore.getToken(provider);
    },

    getTokenStatus(provider) {
      return secretStore.getTokenStatus(provider);
    },

    listProviderStatuses() {
      return secretStore.listProviderStatuses();
    },
  };
}

// TODO:
// - Development: EnvSecretStore reads environment variables and local .env values.
// - Desktop app: add ElectronSafeStorageSecretStore or OSKeyringSecretStore.
// - Server deployment: use a server-side secret manager only.
// - Never expose provider tokens to the browser frontend.

