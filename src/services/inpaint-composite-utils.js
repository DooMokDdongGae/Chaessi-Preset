import {
  decodePngPixels,
  encodeRgbPng,
  pngPixelsToAlpha,
  pngPixelsToMask,
  pngPixelsToRgb,
} from "./generation-image-utils.js";

export const DEFAULT_INPAINT_GENERATION_PADDING = 16;
export const MAX_INPAINT_GENERATION_PADDING = 32;
export const INPAINT_MASK_BLOCK_SIZE = 8;

export function createInpaintGenerationMask(maskBytes, padding = DEFAULT_INPAINT_GENERATION_PADDING) {
  const decoded = decodePngPixels(maskBytes, "logical inpaint mask");
  const logicalMask = pngPixelsToMask(decoded);
  const binaryMask = toBinaryMask(logicalMask);
  const dilated = dilateBinaryMask(binaryMask, decoded.width, decoded.height, padding);
  const quantized = quantizeBinaryMaskToBlocks(dilated, decoded.width, decoded.height);
  const rgb = Buffer.alloc(quantized.length * 3);
  for (let index = 0; index < quantized.length; index += 1) {
    const value = quantized[index];
    const offset = index * 3;
    rgb[offset] = value;
    rgb[offset + 1] = value;
    rgb[offset + 2] = value;
  }
  return encodeRgbPng(rgb, decoded.width, decoded.height);
}

export function quantizeBinaryMaskToBlocks(mask, width, height, blockSize = INPAINT_MASK_BLOCK_SIZE) {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width <= 0
    || height <= 0
    || mask.length !== width * height
  ) {
    throw compositeError("Mask pixel data does not match its dimensions.");
  }
  if (!Number.isInteger(blockSize) || blockSize <= 0) {
    throw compositeError("Mask block size must be a positive integer.");
  }

  const binary = toBinaryMask(mask);
  const output = Buffer.alloc(binary.length);
  for (let blockY = 0; blockY < height; blockY += blockSize) {
    const blockHeight = Math.min(blockSize, height - blockY);
    for (let blockX = 0; blockX < width; blockX += blockSize) {
      const blockWidth = Math.min(blockSize, width - blockX);
      let value = 0;
      for (let y = blockY; y < blockY + blockHeight && value === 0; y += 1) {
        for (let x = blockX; x < blockX + blockWidth; x += 1) {
          if (binary[y * width + x]) {
            value = 255;
            break;
          }
        }
      }
      for (let y = blockY; y < blockY + blockHeight; y += 1) {
        output.fill(value, y * width + blockX, y * width + blockX + blockWidth);
      }
    }
  }
  return output;
}

export function compositeInpaintResult({ sourceBytes, generatedBytes, compositeMaskBytes }) {
  const source = decodePngPixels(sourceBytes, "inpaint source image");
  const generated = decodePngPixels(generatedBytes, "NovelAI inpaint result");
  const mask = decodePngPixels(compositeMaskBytes, "logical inpaint mask");
  assertSameDimensions(source, generated, mask);

  const sourceRgb = pngPixelsToRgb(source);
  const generatedRgb = pngPixelsToRgb(generated);
  const generatedAlpha = pngPixelsToAlpha(generated);
  const logicalMask = pngPixelsToMask(mask);
  const finalRgb = Buffer.alloc(sourceRgb.length);

  for (let index = 0; index < logicalMask.length; index += 1) {
    const effectiveAlpha = Math.round((logicalMask[index] * generatedAlpha[index]) / 255);
    const inverseAlpha = 255 - effectiveAlpha;
    const offset = index * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      finalRgb[offset + channel] = Math.round(
        (sourceRgb[offset + channel] * inverseAlpha + generatedRgb[offset + channel] * effectiveAlpha) / 255,
      );
    }
  }

  return encodeRgbPng(finalRgb, source.width, source.height, {
    metadataSourceBytes: generatedBytes,
  });
}

export function dilateBinaryMask(mask, width, height, padding = DEFAULT_INPAINT_GENERATION_PADDING) {
  const normalizedPadding = normalizeInpaintGenerationPadding(padding);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || mask.length !== width * height) {
    throw compositeError("Mask pixel data does not match its dimensions.");
  }
  const binary = toBinaryMask(mask);
  if (normalizedPadding === 0) return binary;

  const horizontal = Buffer.alloc(binary.length);
  for (let y = 0; y < height; y += 1) {
    let selected = 0;
    for (let sampleX = 0; sampleX <= Math.min(normalizedPadding, width - 1); sampleX += 1) {
      if (binary[y * width + sampleX]) selected += 1;
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = selected > 0 ? 255 : 0;
      const leaving = x - normalizedPadding;
      const entering = x + normalizedPadding + 1;
      if (leaving >= 0 && binary[y * width + leaving]) selected -= 1;
      if (entering < width && binary[y * width + entering]) selected += 1;
    }
  }

  const output = Buffer.alloc(binary.length);
  for (let x = 0; x < width; x += 1) {
    let selected = 0;
    for (let sampleY = 0; sampleY <= Math.min(normalizedPadding, height - 1); sampleY += 1) {
      if (horizontal[sampleY * width + x]) selected += 1;
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = selected > 0 ? 255 : 0;
      const leaving = y - normalizedPadding;
      const entering = y + normalizedPadding + 1;
      if (leaving >= 0 && horizontal[leaving * width + x]) selected -= 1;
      if (entering < height && horizontal[entering * width + x]) selected += 1;
    }
  }
  return output;
}

function toBinaryMask(mask) {
  const binary = Buffer.alloc(mask.length);
  for (let index = 0; index < mask.length; index += 1) binary[index] = mask[index] > 0 ? 255 : 0;
  return binary;
}

export function normalizeInpaintGenerationPadding(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > MAX_INPAINT_GENERATION_PADDING) {
    throw compositeError(`Generation padding must be an integer from 0 to ${MAX_INPAINT_GENERATION_PADDING}.`);
  }
  return number;
}

function assertSameDimensions(source, generated, mask) {
  const dimensions = `${source.width}x${source.height}`;
  if (
    generated.width !== source.width
    || generated.height !== source.height
    || mask.width !== source.width
    || mask.height !== source.height
  ) {
    throw compositeError(
      `Inpaint source, result, and mask dimensions must match ${dimensions}; received result ${generated.width}x${generated.height} and mask ${mask.width}x${mask.height}.`,
    );
  }
}

function compositeError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.type = "invalid_inpaint_composite";
  error.publicMessage = message;
  return error;
}
