/** Compress locally: never upload the unprocessed original. */
export async function optimizeProductImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Usa JPG, PNG o WebP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("La imagen original no puede superar 10 MB.");
  const object = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = object;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight)
      throw new Error("Imagen inválida.");
    const canvas = document.createElement("canvas");
    let edge = 1280;
    let quality = 0.82;
    for (let attempt = 0; attempt < 7; attempt++) {
      const ratio = Math.min(
        1,
        edge / Math.max(img.naturalWidth, img.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo procesar la foto.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("No se pudo comprimir la foto.")),
          "image/webp",
          quality,
        ),
      );
      if (blob.size <= 300 * 1024) return blob;
      quality = Math.max(0.58, quality - 0.08);
      edge = Math.round(edge * 0.82);
    }
    throw new Error("No se pudo reducir la imagen. Prueba otra fotografía.");
  } catch (e) {
    if (e instanceof Error && e.name === "EncodingError")
      throw new Error("La imagen está dañada o no se puede abrir.");
    throw e;
  } finally {
    URL.revokeObjectURL(object);
  }
}
