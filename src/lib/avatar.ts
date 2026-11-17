/** Shrinks a picked photo to a small centre-cropped square JPEG, base64 without a prefix
 *  (the same form the app stores, so the picture syncs both ways). */
export async function squareJPEGBase64(file: File, side = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const edge = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, side, side);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

export const avatarSrc = (base64: string) => `data:image/jpeg;base64,${base64}`;
