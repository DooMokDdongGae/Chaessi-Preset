export async function getJson(path) {
  const response = await fetch(path);
  return parseResponse(response);
}

export async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function postImage(path, file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(path, {
    method: "POST",
    body: formData,
  });
  return parseResponse(response);
}

export async function postForm(path, formData) {
  const response = await fetch(path, {
    method: "POST",
    body: formData,
  });
  return parseResponse(response);
}

export async function deleteJson(path) {
  const response = await fetch(path, { method: "DELETE" });
  return parseResponse(response);
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({
    ok: false,
    error: { message: "Response was not JSON." },
  }));
  if (!response.ok || payload.ok === false) {
    const message = payload?.error?.details || payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}
