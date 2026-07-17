const MAX_IMAGE_EDGE = 1400;
const OPAQUE_THRESHOLD = 72;
const TRANSPARENT_THRESHOLD = 28;

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(source)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la imagen'));
    image.src = source;
  });

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

const colorDistance = (a: number[], b: number[]) =>
  Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2),
  );

export interface BackgroundRemovalResult {
  original: string;
  processed: string;
  removed: boolean;
}

export async function removeBackgroundFromSource(original: string): Promise<BackgroundRemovalResult> {
  const image = await loadImage(original);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { original, processed: original, removed: false };

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const samples: number[][] = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 80));
  const edgeDepth = Math.max(1, Math.round(Math.min(width, height) * 0.025));
  const addSample = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (data[index + 3] > 160) samples.push([data[index], data[index + 1], data[index + 2]]);
  };

  for (let x = 0; x < width; x += step) {
    for (let depth = 0; depth < edgeDepth; depth++) {
      addSample(x, depth);
      addSample(x, height - 1 - depth);
    }
  }
  for (let y = 0; y < height; y += step) {
    for (let depth = 0; depth < edgeDepth; depth++) {
      addSample(depth, y);
      addSample(width - 1 - depth, y);
    }
  }

  if (samples.length < 8) return { original, processed: original, removed: false };

  const background = [0, 1, 2].map((channel) =>
    Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length),
  );
  const cornerVariation = samples.reduce((sum, sample) => sum + colorDistance(sample, background), 0) / samples.length;

  // Solo procesa fondos razonablemente uniformes para no destruir fotografías.
  if (cornerVariation > 42) return { original, processed: original, removed: false };

  let transparentPixels = 0;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;
  const enqueue = (pixel: number) => {
    if (pixel < 0 || pixel >= width * height || visited[pixel]) return;
    const index = pixel * 4;
    const distance = colorDistance([data[index], data[index + 1], data[index + 2]], background);
    if (data[index + 3] > 16 && distance >= OPAQUE_THRESHOLD) return;
    visited[pixel] = 1;
    queue[queueEnd++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixel = queue[queueStart++];
    const index = pixel * 4;
    const distance = colorDistance([data[index], data[index + 1], data[index + 2]], background);
    if (data[index + 3] <= 16 || distance <= TRANSPARENT_THRESHOLD) {
      data[index + 3] = 0;
      transparentPixels++;
    } else {
      data[index + 3] = Math.round(255 * ((distance - TRANSPARENT_THRESHOLD) / (OPAQUE_THRESHOLD - TRANSPARENT_THRESHOLD)));
    }

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }

  if (transparentPixels < width * height * 0.05) return { original, processed: original, removed: false };
  context.putImageData(imageData, 0, 0);
  return { original, processed: canvas.toDataURL('image/png'), removed: true };
}

export async function removeImageBackground(file: File): Promise<BackgroundRemovalResult> {
  return removeBackgroundFromSource(await readFile(file));
}
