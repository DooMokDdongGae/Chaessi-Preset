const base = '/api/reference-library';
const header = { 'X-Chaessi-Reference-Library': '1' };

async function request(route, method = 'GET', data, binary = false) {
  const options = { method, headers: { ...header } };
  if (data !== undefined) {
    const isBlob = data instanceof Blob;
    options.headers['Content-Type'] = isBlob ? 'application/octet-stream' : 'application/json';
    options.body = isBlob ? data : JSON.stringify(data);
  }
  const response = await fetch(base + route, options);
  if (response.ok && binary) return response.arrayBuffer();
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error?.message || `HTTP ${response.status}`);
  return body;
}

function encodingBytes(encoded) {
  if (typeof encoded !== 'string' || !encoded) throw new Error('Invalid Vibe encoding.');
  return Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
}

function toBase64(bytes) {
  const chunks = [];
  // A multiple of three avoids padding between independent base64 chunks.
  for (let i = 0; i < bytes.length; i += 24 * 1024) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(i, i + 24 * 1024))));
  }
  return chunks.join('');
}

export const listReferences = async () => (await request('')).items;
export const renameReference = async (item, name) => (await request(`/entries/${item.id}/rename`, 'POST', { version: item.version, name })).item;
export const deleteReferences = async items => request('/delete', 'POST', { items: items.map(({ id, version }) => ({ id, version })) });

export async function saveReference({ item, name, scope, snapshot }) {
  const { upload } = await request('/uploads', 'POST');
  let slot = 0;
  async function uploadPart(blob) {
    const current = slot++;
    await request(`/uploads/${upload}/${current}`, 'POST', blob);
    return current;
  }
  async function image(file) {
    if (!file) return null;
    if (!(file instanceof Blob)) throw new Error('The original reference file is unavailable.');
    return { name: file.name || 'reference', mimeType: file.type, slot: await uploadPart(file) };
  }
  try {
    const cards = [];
    for (const raw of snapshot.cards) {
      const card = {
        kind: raw.kind, type: raw.type, enabled: raw.enabled, strength: raw.strength,
        fidelity: raw.fidelity, preferSameOutfit: raw.preferSameOutfit, informationExtracted: raw.informationExtracted,
        fileName: raw.fileName, original: await image(raw.original), thumbnail: await image(raw.thumbnail),
      };
      if (raw.kind === 'vibe') {
        card.encodings = [];
        for (const { model, informationExtracted, encoding } of raw.encodings || []) {
          const slot = await uploadPart(new Blob([encodingBytes(encoding)]));
          card.encodings.push({ model, informationExtracted, slot });
        }
      }
      cards.push(card);
    }
    const result = await request('/entries', 'POST', {
      upload, name, scope, id: item?.id, version: item?.version, snapshot: { cards, normalizeStrength: snapshot.normalizeStrength },
    });
    return result.item;
  } catch (error) {
    await request(`/uploads/${upload}`, 'DELETE').catch(() => {});
    throw error;
  }
}

export async function readReference(item) {
  const { item: saved } = await request(`/entries/${item.id}`);
  if (saved.version !== item.version) throw new Error('The saved reference changed. Refresh the list before continuing.');
  const readPart = slot => request(`/entries/${item.id}/assets/${slot}?version=${saved.version}`, 'GET', undefined, true);
  async function file(descriptor) {
    if (!descriptor) return null;
    return new File([await readPart(descriptor.slot)], descriptor.name, { type: descriptor.mimeType });
  }
  const cards = [];
  for (const source of saved.snapshot.cards) {
    const card = { ...source, original: await file(source.original), thumbnail: await file(source.thumbnail) };
    if (source.encodings) {
      card.encodings = [];
      for (const { model, informationExtracted, slot } of source.encodings) {
        const bytes = new Uint8Array(await readPart(slot));
        card.encodings.push({ model, informationExtracted, encoding: toBase64(bytes) });
      }
    }
    cards.push(card);
  }
  return { cards, normalizeStrength: saved.snapshot.normalizeStrength };
}
