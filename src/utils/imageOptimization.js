const ACCEPTED_PROFILE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const PROFILE_PHOTO_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_OUTPUT_BYTES = 96 * 1024;

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the optimized photo.'));
  reader.readAsDataURL(blob);
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('This browser could not optimize the selected photo.'));
  }, type, quality);
});

const loadImage = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, objectUrl });
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('The selected file is not a readable image.'));
  };
  image.src = objectUrl;
});

const decodeImage = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close()
      };
    } catch (error) {
      // Fall back to an HTML image for browsers without this option.
    }
  }

  const decoded = await loadImage(file);
  return {
    ...decoded,
    cleanup: () => URL.revokeObjectURL(decoded.objectUrl)
  };
};

const renderSquareAvatar = (source, sourceWidth, sourceHeight, outputSize) => {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser could not optimize the selected photo.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputSize, outputSize);

  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = (sourceWidth - cropSize) / 2;
  const sourceY = (sourceHeight - cropSize) / 2;
  context.drawImage(source, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize);
  return canvas;
};

export const optimizeProfilePhoto = async (file) => {
  if (!(file instanceof Blob)) throw new Error('Please select a photo.');
  if (!ACCEPTED_PROFILE_PHOTO_TYPES.has(file.type)) {
    throw new Error('Use a JPG, PNG, or WebP photo.');
  }
  if (file.size > PROFILE_PHOTO_MAX_SOURCE_BYTES) {
    throw new Error('Photo must be smaller than 10 MB.');
  }

  const decoded = await decodeImage(file);
  try {
    if (!decoded.width || !decoded.height) throw new Error('The selected photo has invalid dimensions.');

    const attempts = [
      { size: 256, quality: 0.8 },
      { size: 256, quality: 0.68 },
      { size: 224, quality: 0.62 },
      { size: 192, quality: 0.56 }
    ];
    let optimizedBlob = null;

    for (const attempt of attempts) {
      const canvas = renderSquareAvatar(decoded.source, decoded.width, decoded.height, attempt.size);
      let blob = await canvasToBlob(canvas, 'image/webp', attempt.quality);
      if (blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', attempt.quality);
      optimizedBlob = blob;
      if (blob.size <= PROFILE_PHOTO_MAX_OUTPUT_BYTES) break;
    }

    if (!optimizedBlob || optimizedBlob.size > PROFILE_PHOTO_MAX_OUTPUT_BYTES) {
      throw new Error('The photo could not be compressed enough. Please choose another image.');
    }

    return {
      dataUrl: await blobToDataUrl(optimizedBlob),
      originalBytes: file.size,
      optimizedBytes: optimizedBlob.size,
      mimeType: optimizedBlob.type
    };
  } finally {
    decoded.cleanup();
  }
};
