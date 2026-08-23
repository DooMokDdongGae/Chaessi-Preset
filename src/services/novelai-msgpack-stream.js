import { decode } from "@msgpack/msgpack";

const MAX_FRAME_BYTES = 128 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodeNovelAiMsgpackFrames(value) {
  const bytes = Buffer.from(value || []);
  const events = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (bytes.length - offset < 4) throw streamError("NovelAI msgpack response ended inside a frame header.");
    const frameLength = bytes.readUInt32BE(offset);
    offset += 4;
    if (frameLength <= 0 || frameLength > MAX_FRAME_BYTES) throw streamError(`NovelAI msgpack frame length is invalid: ${frameLength}.`);
    if (bytes.length - offset < frameLength) throw streamError("NovelAI msgpack response ended inside a frame payload.");
    const decoded = decode(bytes.subarray(offset, offset + frameLength));
    offset += frameLength;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw streamError("NovelAI msgpack frame is not an event object.");
    events.push(decoded);
  }
  return events;
}

export function extractFinalNovelAiPng(value) {
  const events = decodeNovelAiMsgpackFrames(value);
  const errorEvent = events.find((event) => event.event_type === "error");
  if (errorEvent) throw streamError(publicEventMessage(errorEvent));
  const finalEvents = events.filter((event) => event.event_type === "final");
  if (!finalEvents.length) throw streamError("NovelAI msgpack response did not contain a final image event.");
  const image = finalEvents[0].image;
  if (!(image instanceof Uint8Array)) throw streamError("NovelAI final event did not contain binary image bytes.");
  const imageBytes = Buffer.from(image);
  if (imageBytes.length < PNG_SIGNATURE.length || !imageBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw streamError("NovelAI final event image is not a PNG.");
  }
  return {
    imageBytes,
    events,
    finalCount: finalEvents.length,
    intermediateCount: events.filter((event) => event.event_type === "intermediate").length,
  };
}

function publicEventMessage(event) {
  const value = event.message ?? event.error ?? event.detail;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1000) : "NovelAI returned a generation stream error.";
}

function streamError(message) {
  const error = new Error(message);
  error.statusCode = 502;
  error.type = "novelai_msgpack_decode_failed";
  error.publicMessage = message;
  return error;
}
