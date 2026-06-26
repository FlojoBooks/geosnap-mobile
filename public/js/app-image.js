// Image capture and canvas helpers.
async function capturePhoneBlob() {
  const video = $('phone-video');
  if (!isPhoneStreamLive()) {
    await startPhoneCamera(true);
  }
  await waitForVideoReady(video);
  if (!video.videoWidth || !video.videoHeight) throw new Error('Telefooncamera is nog niet klaar');
  const canvas = $('capture-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
}

async function waitForVideoReady(video, timeoutMs = 1800) {
  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Telefooncamera is nog niet klaar'));
    }, timeoutMs);
    const done = () => {
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', done);
      video.removeEventListener('canplay', done);
    };
    video.addEventListener('loadedmetadata', done);
    video.addEventListener('canplay', done);
    done();
  });
}

async function limitImageBlob(blob, maxSide = 1920, quality = .94) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1 && /^image\/jpe?g$/i.test(blob.type || '')) {
    bitmap.close?.();
    return blob;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function rotateImageBlob(blob, degrees = 180, quality = .94) {
  try {
    const bitmap = await createImageBitmap(blob);
    const normalized = ((degrees % 360) + 360) % 360;
    const swapSides = normalized === 90 || normalized === 270;
    const canvas = document.createElement('canvas');
    canvas.width = swapSides ? bitmap.height : bitmap.width;
    canvas.height = swapSides ? bitmap.width : bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(normalized * Math.PI / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    bitmap.close?.();
    return await new Promise(resolve => canvas.toBlob(result => resolve(result || blob), 'image/jpeg', quality));
  } catch {
    return blob;
  }
}

async function drawBlobToCanvas(blob, canvas) {
  const bitmap = await createImageBitmap(blob);
  try {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round((rect.width || bitmap.width) * dpr));
    const height = Math.max(1, Math.round((rect.height || bitmap.height) * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const drawWidth = bitmap.width * scale;
    const drawHeight = bitmap.height * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, x, y, drawWidth, drawHeight);
  } finally {
    bitmap.close?.();
  }
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx?.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
}

async function addReferenceTextToBlob(blob, text) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const fontSize = Math.max(24, Math.round(canvas.width * .028));
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  const padding = Math.round(fontSize * .65);
  const metrics = ctx.measureText(text);
  const boxWidth = metrics.width + padding * 2;
  const boxHeight = fontSize + padding * 1.4;
  const x = canvas.width - boxWidth - padding;
  const y = canvas.height - boxHeight - padding;
  ctx.fillStyle = 'rgba(2, 6, 23, .72)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padding, y + boxHeight / 2);
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .96));
}
