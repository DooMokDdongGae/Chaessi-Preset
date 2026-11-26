// Encode decoded pixels only. The local library keeps the original, including its original format.
export async function referencePixels(file, { maxBytes, crop, maxPixels = 16_777_216 }) {
  if (!file) throw new Error("An original reference image is required.");
  const image = await createImageBitmap(file);
  try {
    const { width, height } = image;
    if (!(width > 0 && height > 0) || width * height > maxPixels) {
      throw new Error("Reference image exceeds the local pixel limit.");
    }
    const target = crop?.(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = target?.width ?? width;
    canvas.height = target?.height ?? height;
    const context = canvas.getContext("2d");
    if (target) {
      context.drawImage(image, -target.left, -target.top, target.resizeWidth, target.resizeHeight);
    } else {
      context.drawImage(image, 0, 0);
    }
    const png = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!png || png.size > maxBytes) throw new Error("Reference PNG exceeds the request size limit.");
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(png);
    });
    return { originalWidth: width, originalHeight: height, width: canvas.width, height: canvas.height,
      base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  } finally {
    image.close();
  }
}
