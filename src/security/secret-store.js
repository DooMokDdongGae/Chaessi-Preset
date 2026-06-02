export const PROVIDER_ENV_KEYS = Object.freeze({
  novelai: "NAI_ACCESS_TOKEN",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
});

const PROVIDER_LABELS = Object.freeze({
  novelai: "NovelAI",
  openai: "OpenAI",
  gemini: "Gemini",
});

export class EnvSecretStore {
  constructor({ env = process.env } = {}) {
    this.env = env;
  }

  getToken(provider) {
    const key = getProviderEnvKey(provider);
    const token = String(this.env[key] || "").trim();
    if (!token) {
      throw createSecretError("missing_token", `${getProviderLabel(provider)} token missing.`);
    }
    return token;
  }

  getTokenStatus(provider) {
    const key = getProviderEnvKey(provider);
    return {
      provider,
      configured: Boolean(String(this.env[key] || "").trim()),
      source: "environment_or_local_env_file",
      storage: "env",
    };
  }

  listProviderStatuses() {
    return Object.keys(PROVIDER_ENV_KEYS).map((provider) => this.getTokenStatus(provider));
  }
}

export function getProviderEnvKey(provider) {
  const key = PROVIDER_ENV_KEYS[provider];
  if (!key) throw createSecretError("unsupported_provider", "Unsupported API provider.");
  return key;
}

function getProviderLabel(provider) {
  return PROVIDER_LABELS[provider] || provider;
}

function createSecretError(type, publicMessage) {
  const error = new Error(publicMessage);
  error.type = type;
  error.publicMessage = publicMessage;
  error.statusCode = type === "unsupported_provider" ? 400 : 500;
  return error;
}

