// ZIP export, CSV/notes generation, map PNG rendering, and tile cache IO.
function openExportModal() {
  if (!state.session) return showToast('Open of start eerst een sessie');
  const slider = $('export-marker-size');
  if (slider) slider.value = Number(state.exportMarkerSize || 18);
  updateExportMarkerSizeLabel();
  $('export-modal').classList.add('open');
  document.body.classList.add('modal-open');
}

function closeExportModal() {
  $('export-modal').classList.remove('open');
  document.body.classList.remove('modal-open');
}

function updateExportMarkerSizeLabel() {
  const slider = $('export-marker-size');
  const value = Math.max(10, Math.min(34, Number(slider?.value || state.exportMarkerSize || 18)));
  state.exportMarkerSize = value;
  const label = $('export-marker-size-value');
  if (label) label.textContent = `${value}px`;
  const preview = $('export-marker-preview');
  if (preview) {
    preview.style.setProperty('--export-marker-diameter', `${value * 2}px`);
    preview.style.setProperty('--export-marker-font-size', `${Math.max(10, Math.round(value * .95))}px`);
  }
}

function exportSessionFromModal() {
  updateExportMarkerSizeLabel();
  closeExportModal();
  exportSession({ markerSize: state.exportMarkerSize });
}

async function exportSession(options = {}) {
  if (!state.session) return showToast('Open of start eerst een sessie');
  if (!window.JSZip) return showToast('ZIP module niet geladen');
  try {
    showToast('ZIP export maken...');
    const result = await localApi.getSession(state.session.id);
    if (!result.success) throw new Error(result.error || 'Sessie niet gevonden');
    const session = result.data;
    const photos = withReferenceNumbers(session.photos || []);
    if (!photos.length) return showToast('Geen foto\'s om te exporteren');

    const zip = new JSZip();
    const cleanSession = stripSessionForExport(session);
    const cleanPhotos = photos.map(stripPhotoForExport);
    const fileBase = sanitizeFileName(session.name || 'geosnap-export');
    const fileName = `${fileBase}-${formatExportStamp(new Date())}.zip`;

    zip.file('manifest.json', JSON.stringify({
      export_version: 1,
      export_date: new Date().toISOString(),
      app: 'Alphatron GeoSnap Mobile',
      session: cleanSession,
      photos: cleanPhotos
    }, null, 2));
    zip.file('photos.csv', buildPhotosCsv(cleanPhotos));
    zip.file('opmerkingen.txt', buildNotesText(session, cleanPhotos));
    zip.file('kaart/camera_cones.geojson', JSON.stringify(buildCameraGeoJson(cleanPhotos), null, 2));
    const maps = await buildExportMapPngs(session, cleanPhotos, {
      markerSize: Number(options.markerSize || state.exportMarkerSize || 18)
    });
    zip.file('kaart/kaart_met_cones.png', maps.withCones, { base64: true });
    zip.file('kaart/kaart_zonder_cones.png', maps.sessionOnly, { base64: true });

    for (const photo of photos) {
      if (!photo.blob) continue;
      const name = photoExportName(photo);
      zip.file(`fotos/${name}`, await photo.blob.arrayBuffer());
    }

    const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
    await saveZipFile(fileName, base64);
  } catch (err) {
    showToast(err.message || 'ZIP export mislukt');
  }
}

function withReferenceNumbers(photos) {
  const references = photos
    .filter(photo => photo.type === 'referentie')
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const used = new Set(references
    .map(photo => Number(photo.reference_number || 0))
    .filter(number => number > 0));
  let next = 1;
  const assigned = new Map();
  references.forEach(photo => {
    const current = Number(photo.reference_number || 0);
    if (current > 0) {
      assigned.set(photo.id, current);
      return;
    }
    while (used.has(next)) next += 1;
    used.add(next);
    assigned.set(photo.id, next);
  });
  return photos.map(photo => photo.type === 'referentie'
    ? { ...photo, reference_number: assigned.get(photo.id) || Number(photo.reference_number || 1) }
    : photo);
}

function stripSessionForExport(session) {
  const { photos, ...clean } = session;
  return clean;
}

function stripPhotoForExport(photo) {
  const { blob, filename, ...clean } = photo;
  return {
    ...clean,
    export_filename: photoExportName(photo)
  };
}

function photoExportName(photo) {
  if (photo.special_kind === 'central') {
    return `CENTRALE-APPARATUUR-${padCam(photo.reference_number || 1)}.jpg`;
  }
  if (photo.special_kind === 'parking') {
    return `PARKEERMOGELIJKHEID-${padCam(photo.reference_number || 1)}.jpg`;
  }
  if (photo.type === 'referentie') {
    return `REFERENTIE-${padCam(photo.reference_number || 1)}.jpg`;
  }
  const cam = padCam(photo.camera_number || 1);
  const type = sanitizeFileName(photo.type || 'foto');
  const floor = sanitizeFileName(photo.floor || 'BG');
  return `CAM-${cam}_${floor}_${type}.jpg`;
}

function sanitizeFileName(value) {
  return String(value || 'export')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'export';
}

function formatExportStamp(date) {
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');
}

function formatPhotoStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatExportStamp(new Date());
  return formatExportStamp(date);
}

function buildPhotosCsv(photos) {
  const headers = [
    'camera_number',
    'type',
    'floor',
    'latitude',
    'longitude',
    'accuracy',
    'heading',
    'fov',
    'range',
    'source',
    'note',
    'reference_number',
    'reference_text',
    'special_kind',
    'special_answer',
    'created_at',
    'export_filename'
  ];
  const rows = photos.map(photo => headers.map(key => csvCell(photo[key])).join(','));
  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildNotesText(session, photos) {
  const cameras = new Map();
  photos
    .filter(photo => photo.type !== 'referentie')
    .forEach(photo => {
      const cam = Number(photo.camera_number || 1);
      if (!cameras.has(cam)) cameras.set(cam, []);
      if (photo.note) cameras.get(cam).push(`${photo.type}: ${photo.note}`);
    });
  const cameraNumbers = Array.from(new Set([
    ...photos.filter(photo => photo.type !== 'referentie').map(photo => Number(photo.camera_number || 1)),
    ...cameras.keys()
  ])).sort((a, b) => a - b);
  const lines = [
    `Sessie: ${session.name || '-'}`,
    `Locatie: ${session.location || '-'}`,
    `Export: ${new Date().toLocaleString('nl-NL')}`,
    '',
    'Camera opmerkingen'
  ];
  if (!cameraNumbers.length) lines.push('Geen camera\'s vastgelegd.');
  cameraNumbers.forEach(cam => {
    const notes = cameras.get(cam) || [];
    lines.push(`CAM-${padCam(cam)}: ${notes.length ? notes.join(' | ') : '-'}`);
  });
  const references = photos.filter(photo => photo.type === 'referentie' && !photo.special_kind);
  lines.push('', 'Referentiefoto\'s');
  if (!references.length) lines.push('-');
  references.forEach(photo => {
    const details = [photo.reference_text, photo.note].filter(Boolean).join(' | ');
    lines.push(`Referentie ${photo.reference_number || 1}: ${details || '-'}`);
  });
  const specials = photos.filter(photo => photo.special_kind);
  lines.push('', 'Speciale referenties');
  if (!specials.length) lines.push('-');
  specials.forEach(photo => {
    const answer = photo.special_answer || '-';
    lines.push(`${photoDisplayLabel(photo)}: ${answer}`);
  });
  return `${lines.join('\n')}\n`;
}

function buildCameraGeoJson(photos) {
  const features = photos
    .filter(photo => photo.type === 'beeld' && photo.latitude != null && photo.longitude != null)
    .map(photo => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(photo.longitude), Number(photo.latitude)]
      },
      properties: {
        camera_number: Number(photo.camera_number || 1),
        floor: photo.floor || 'BG',
        heading: Number(photo.heading || 0),
        fov: Number(photo.fov || 90),
        range: Number(photo.range || 20),
        photo_id: photo.id,
        export_filename: photo.export_filename
      }
    }));
  return { type: 'FeatureCollection', features };
}

async function buildExportMapPngs(session, photos, options = {}) {
  const withCones = await renderMapPng(session, photos, { cones: true, markerSize: options.markerSize });
  const sessionOnly = await renderMapPng(session, photos, { cones: false });
  return { withCones, sessionOnly };
}

async function renderMapPng(session, photos, options = {}) {
  const width = 1400;
  const height = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cameraPhotos = photos.filter(photo => photo.type === 'beeld' && photo.latitude != null && photo.longitude != null);
  const parkingPhotos = photos.filter(photo => photo.special_kind === 'parking' && photo.latitude != null && photo.longitude != null);
  const centralPhotos = photos.filter(photo => photo.special_kind === 'central' && photo.latitude != null && photo.longitude != null);
  const center = getMapExportCenter([...cameraPhotos, ...parkingPhotos, ...centralPhotos]);
  const centerPx = lonLatToWorldPixel(center.lng, center.lat, TILE_ZOOM);
  const origin = { x: centerPx.x - width / 2, y: centerPx.y - height / 2 };

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);
  await drawSatelliteTiles(ctx, origin, width, height, TILE_ZOOM);
  drawMapTitle(ctx, session, width);
  if (options.cones) {
    drawExportCones(ctx, cameraPhotos, origin, options);
    drawExportParking(ctx, parkingPhotos, origin);
    drawExportCentral(ctx, centralPhotos, origin);
  }
  return canvas.toDataURL('image/png').split(',')[1];
}

function getMapExportCenter(cameraPhotos) {
  if (cameraPhotos.length) {
    const lat = cameraPhotos.reduce((sum, photo) => sum + Number(photo.latitude), 0) / cameraPhotos.length;
    const lng = cameraPhotos.reduce((sum, photo) => sum + Number(photo.longitude), 0) / cameraPhotos.length;
    return { lat, lng };
  }
  return {
    lat: state.gps.latitude != null ? state.gps.latitude : 52.08,
    lng: state.gps.longitude != null ? state.gps.longitude : 4.7
  };
}

async function drawSatelliteTiles(ctx, origin, width, height, zoom) {
  const startX = Math.floor(origin.x / TILE_SIZE);
  const endX = Math.floor((origin.x + width) / TILE_SIZE);
  const startY = Math.floor(origin.y / TILE_SIZE);
  const endY = Math.floor((origin.y + height) / TILE_SIZE);
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      try {
        const blob = await getTileBlob(zoom, x, y);
        if (!blob) continue;
        await drawBlobImage(ctx, blob, x * TILE_SIZE - origin.x, y * TILE_SIZE - origin.y, TILE_SIZE, TILE_SIZE);
      } catch {}
    }
  }
}

async function drawBlobImage(ctx, blob, x, y, width, height) {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(blob);
    ctx.drawImage(bitmap, x, y, width, height);
    bitmap.close?.();
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    ctx.drawImage(img, x, y, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawMapTitle(ctx, session, width) {
  const title = session.name || 'GeoSnap sessie';
  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 26, .86)';
  ctx.fillRect(28, 28, Math.min(width - 56, 620), 82);
  ctx.strokeStyle = 'rgba(255, 255, 255, .28)';
  ctx.strokeRect(28, 28, Math.min(width - 56, 620), 82);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Arial, sans-serif';
  ctx.fillText(title, 54, 80);
  ctx.restore();
}

function drawExportCones(ctx, photos, origin, options = {}) {
  const markerRadius = Math.max(10, Math.min(34, Number(options.markerSize || 18)));
  const fontSize = Math.max(10, Math.round(markerRadius * .95));
  photos.forEach(photo => {
    const cone = computeCone(photo).map(point => latLngToCanvas(point[0], point[1], origin, TILE_ZOOM));
    const marker = latLngToCanvas(photo.latitude, photo.longitude, origin, TILE_ZOOM);
    ctx.save();
    ctx.beginPath();
    cone.forEach((point, idx) => {
      if (idx === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(91, 92, 240, .32)';
    ctx.strokeStyle = '#5b5cf0';
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Number(photo.camera_number || 1)), marker.x, marker.y + 1);
    ctx.restore();
  });
}

function drawExportParking(ctx, photos, origin) {
  photos.forEach(photo => {
    const marker = latLngToCanvas(photo.latitude, photo.longitude, origin, TILE_ZOOM);
    ctx.save();
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    const size = 44;
    ctx.fillRect(marker.x - size / 2, marker.y - size / 2, size, size);
    ctx.strokeRect(marker.x - size / 2, marker.y - size / 2, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', marker.x, marker.y + 1);
    ctx.restore();
  });
}

function drawExportCentral(ctx, photos, origin) {
  photos.forEach(photo => {
    const marker = latLngToCanvas(photo.latitude, photo.longitude, origin, TILE_ZOOM);
    ctx.save();
    ctx.fillStyle = '#c32032';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    const width = 66;
    const height = 44;
    ctx.fillRect(marker.x - width / 2, marker.y - height / 2, width, height);
    ctx.strokeRect(marker.x - width / 2, marker.y - height / 2, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('230V', marker.x, marker.y + 1);
    ctx.restore();
  });
}

function latLngToCanvas(lat, lng, origin, zoom) {
  const point = lonLatToWorldPixel(Number(lng), Number(lat), zoom);
  return { x: point.x - origin.x, y: point.y - origin.y };
}

function lonLatToWorldPixel(lng, lat, zoom) {
  const sinLat = Math.sin(Number(lat) * Math.PI / 180);
  const scale = TILE_SIZE * Math.pow(2, zoom);
  return {
    x: (Number(lng) + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function worldPixelToTile(point) {
  return {
    x: Math.floor(point.x / TILE_SIZE),
    y: Math.floor(point.y / TILE_SIZE)
  };
}

function tileKey(zoom, x, y) {
  return `${zoom}/${x}/${y}`;
}

function tileUrl(zoom, x, y) {
  return TILE_URL_TEMPLATE
    .replace('{z}', zoom)
    .replace('{x}', x)
    .replace('{y}', y);
}

async function getTileBlob(zoom, x, y) {
  const key = tileKey(zoom, x, y);
  const cached = await localGet('tiles', key);
  if (cached?.blob) return cached.blob;
  if (!navigator.onLine) return null;
  const response = await fetch(tileUrl(zoom, x, y), { cache: 'force-cache' });
  if (!response.ok) return null;
  const blob = await response.blob();
  await localPut('tiles', { key, zoom, x, y, blob, updated_at: new Date().toISOString() });
  return blob;
}

async function preloadMapTilesForGps(lat, lng) {
  if (state.mapPreloadBusy || lat == null || lng == null || !navigator.onLine) return;
  const centerTile = worldPixelToTile(lonLatToWorldPixel(lng, lat, TILE_ZOOM));
  const preloadKey = `${TILE_ZOOM}/${centerTile.x}/${centerTile.y}`;
  if (state.mapPreloadKey === preloadKey) return;
  state.mapPreloadKey = preloadKey;
  state.mapPreloadBusy = true;
  const status = $('map-status');
  const previousStatus = status?.textContent;
  if (status) status.textContent = 'Satellietkaart rond GPS vooraf downloaden...';
  try {
    const tasks = [];
    for (let x = centerTile.x - TILE_PRELOAD_RADIUS; x <= centerTile.x + TILE_PRELOAD_RADIUS; x++) {
      for (let y = centerTile.y - TILE_PRELOAD_RADIUS; y <= centerTile.y + TILE_PRELOAD_RADIUS; y++) {
        tasks.push(getTileBlob(TILE_ZOOM, x, y).catch(() => null));
      }
    }
    await Promise.all(tasks);
    if (status) status.textContent = 'Satellietkaart lokaal beschikbaar voor UNV wifi.';
  } finally {
    state.mapPreloadBusy = false;
    if (previousStatus) setTimeout(() => {
      if (status && status.textContent === 'Satellietkaart lokaal beschikbaar voor UNV wifi.') status.textContent = previousStatus;
    }, 3000);
  }
}

async function saveZipFile(fileName, base64) {
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  const share = window.Capacitor?.Plugins?.Share;
  if (isNativeMobileApp() && filesystem) {
    const saved = await filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: 'DOCUMENTS',
      recursive: true
    });
    let url = saved.uri;
    try {
      const uriResult = await filesystem.getUri({ path: fileName, directory: 'DOCUMENTS' });
      url = uriResult.uri || url;
    } catch {}
    if (share && url) {
      await share.share({
        title: 'GeoSnap sessie export',
        text: fileName,
        url,
        dialogTitle: 'Exporteer ZIP'
      });
      showToast('ZIP export klaar om te delen');
      return;
    }
    showToast(`ZIP opgeslagen: ${fileName}`);
    return;
  }

  const blob = base64ToBlob(base64, 'application/zip');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('ZIP download gestart');
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
