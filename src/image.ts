// Client-side downscale for product photos.
//
// This is not an optimisation. A raw phone photo is 3-5 MB; 354 of them would
// exceed the Supabase free tier on their own. Staff shoot these at the counter
// on a phone, so the resize has to happen before the upload, not after.

const MAX_EDGE = 1200;
const MAX_BYTES = 300_000;
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];

const readableSize = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function downscaleImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('That image could not be read. Try a JPEG or PNG.');

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This device cannot process images in the browser.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let smallest: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    const blob = await encode(canvas, quality);
    if (!blob) continue;
    if (blob.size <= MAX_BYTES) return blob;
    if (!smallest || blob.size < smallest.size) smallest = blob;
  }

  throw new Error(
    smallest
      ? `Photo is still ${readableSize(smallest.size)} after compression, over the ${readableSize(MAX_BYTES)} limit. Try a simpler shot.`
      : 'Photo could not be compressed for upload.'
  );
}
