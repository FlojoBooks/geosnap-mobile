// Leaflet map, camera cone editing, and geographic helpers.
function initMap() {
  if (state.map || !window.L) return;
  const center = state.gps.latitude != null ? [state.gps.latitude, state.gps.longitude] : [52.08, 4.7];
  state.map = L.map('camera-map', { center, zoom: 18 });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    attribution: 'Tiles Esri'
  }).addTo(state.map);
}

function centerMapOnGps(lat, lng, accuracy) {
  if (!window.L) return;
  initMap();
  if (!state.map) return;
  state.gpsItems.forEach(item => item.remove());
  state.gpsItems = [];
  const hasCameraPhotos = state.photos.some(photo => photo.type === 'beeld' && photo.latitude != null && photo.longitude != null);
  const point = [lat, lng];
  const dot = L.circleMarker(point, {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#10b981',
    fillOpacity: 1
  }).addTo(state.map);
  const circle = L.circle(point, {
    radius: Math.max(3, Number(accuracy || 0)),
    color: '#10b981',
    weight: 1,
    fillColor: '#10b981',
    fillOpacity: .12
  }).addTo(state.map);
  state.gpsItems.push(circle, dot);
  if (!hasCameraPhotos) {
    state.map.setView(point, 19);
    state.mapCenteredOnGps = true;
    $('map-status').textContent = `Kaart gecentreerd op GPS (+/-${Math.round(accuracy || 0)}m).`;
  } else if (!state.mapCenteredOnGps) {
    state.mapCenteredOnGps = true;
  }
  setTimeout(() => state.map.invalidateSize(), 80);
}

function renderMap() {
  if (!window.L) {
    $('map-status').textContent = 'Kaartbibliotheek niet geladen. Internet is nodig voor de kaartweergave.';
    updateConePrompt();
    return;
  }
  initMap();
  if (!state.map) return;
  state.mapItems.forEach(item => item.remove());
  state.mapItems = [];

  const cameraPhotos = state.photos.filter(photo => photo.type === 'beeld' && photo.latitude != null && photo.longitude != null);
  const parkingPhotos = state.photos.filter(photo => photo.special_kind === 'parking' && photo.latitude != null && photo.longitude != null);
  const centralPhotos = state.photos.filter(photo => photo.special_kind === 'central' && photo.latitude != null && photo.longitude != null);
  if (!cameraPhotos.length && !parkingPhotos.length && !centralPhotos.length) {
    if (state.gps.latitude != null) {
      centerMapOnGps(state.gps.latitude, state.gps.longitude, state.gps.accuracy);
    } else {
      $('map-status').textContent = 'GPS zoeken voor kaartlocatie.';
    }
    $('selected-camera').textContent = 'Geen camera geselecteerd';
    updateConePrompt();
    return;
  }
  const pending = state.pendingConePhotoId ? state.photos.find(photo => photo.id === state.pendingConePhotoId) : null;
  const pendingParking = state.pendingParkingPhotoId ? state.photos.find(photo => photo.id === state.pendingParkingPhotoId) : null;
  const pendingCentral = state.pendingCentralPhotoId ? state.photos.find(photo => photo.id === state.pendingCentralPhotoId) : null;
  $('map-status').textContent = pendingCentral
    ? 'Sleep het 230V icoon naar de centrale apparatuur.'
    : pendingParking
    ? 'Sleep de blauwe P naar de parkeermogelijkheid.'
    : pending
    ? `${cameraPhotos.length} camera's op kaart. Alleen CAM-${padCam(pending.camera_number)} is nu bewerkbaar.`
    : `${cameraPhotos.length} camera's, ${parkingPhotos.length} parkeerpunt(en) en ${centralPhotos.length} centrale apparatuur op kaart. Sleep markers om posities te corrigeren.`;

  const bounds = [];
  cameraPhotos.forEach(photo => {
    addCameraToMap(photo);
    bounds.push([photo.latitude, photo.longitude]);
  });
  parkingPhotos.forEach(photo => {
    addSpecialMarkerToMap(photo);
    bounds.push([photo.latitude, photo.longitude]);
  });
  centralPhotos.forEach(photo => {
    addSpecialMarkerToMap(photo);
    bounds.push([photo.latitude, photo.longitude]);
  });
  if (bounds.length) state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
  setTimeout(() => state.map.invalidateSize(), 80);
  updateConePrompt();
}

function addCameraToMap(photo) {
  const selected = photo.id === state.selectedPhotoId;
  const pending = state.pendingConePhotoId ? state.photos.find(item => item.id === state.pendingConePhotoId) : null;
  const locked = Boolean(pending) && pending.id !== photo.id;
  const marker = L.marker([photo.latitude, photo.longitude], {
    draggable: !locked,
    interactive: !locked,
    icon: L.divIcon({
      html: `<div class="cam-marker${selected ? ' active' : ''}${locked ? ' locked' : ''}">${Number(photo.camera_number || 1)}</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
  }).addTo(state.map);
  const cone = L.polygon(computeCone(photo), {
    color: selected ? '#f59e0b' : '#5b5cf0',
    weight: selected ? 3 : 2,
    fillColor: selected ? '#f59e0b' : '#5b5cf0',
    fillOpacity: locked ? .12 : selected ? .32 : .24,
    dashArray: selected ? null : '5 4',
    interactive: !locked
  }).addTo(state.map);
  state.mapItems.push(cone, marker);

  if (!locked) {
    marker.on('click', () => selectMapPhoto(photo.id, true));
    cone.on('click', () => selectMapPhoto(photo.id, true));
  }
  marker.on('drag', () => {
    const pos = marker.getLatLng();
    photo.latitude = pos.lat;
    photo.longitude = pos.lng;
    cone.setLatLngs(computeCone(photo));
  });
  marker.on('dragend', async () => {
    const pos = marker.getLatLng();
    await updatePhoto(photo.id, { latitude: pos.lat, longitude: pos.lng });
    showToast('Camera positie opgeslagen');
  });
}

function addSpecialMarkerToMap(photo) {
  const pending = state.pendingParkingPhotoId === photo.id || state.pendingCentralPhotoId === photo.id;
  const isCentral = photo.special_kind === 'central';
  const marker = L.marker([photo.latitude, photo.longitude], {
    draggable: true,
    icon: L.divIcon({
      html: `<div class="${isCentral ? 'central-marker' : 'parking-marker'}">${isCentral ? '230V' : 'P'}</div>`,
      className: '',
      iconSize: isCentral ? [48, 34] : [34, 34],
      iconAnchor: isCentral ? [24, 17] : [17, 17]
    })
  }).addTo(state.map);
  state.mapItems.push(marker);
  marker.on('dragend', async () => {
    const pos = marker.getLatLng();
    await updatePhoto(photo.id, { latitude: pos.lat, longitude: pos.lng });
    if (state.pendingParkingPhotoId === photo.id) state.pendingParkingPhotoId = null;
    if (state.pendingCentralPhotoId === photo.id) state.pendingCentralPhotoId = null;
    renderMap();
    showToast(`${specialKindLabel(photo.special_kind)} positie opgeslagen`);
  });
  marker.on('click', () => {
    if (isCentral) {
      state.pendingCentralPhotoId = photo.id;
      $('map-status').textContent = 'Sleep het 230V icoon naar de centrale apparatuur.';
    } else {
      state.pendingParkingPhotoId = photo.id;
      $('map-status').textContent = 'Sleep de blauwe P naar de parkeermogelijkheid.';
    }
  });
  if (pending) marker.openTooltip?.();
}

async function startSpecialMarkerPlacement(photoId) {
  const photo = state.photos.find(item => item.id === photoId);
  if (!photo) return;
  initMap();
  if (photo.latitude == null || photo.longitude == null) {
    const center = state.map?.getCenter?.();
    const latitude = state.gps.latitude != null ? state.gps.latitude : center?.lat;
    const longitude = state.gps.longitude != null ? state.gps.longitude : center?.lng;
    if (latitude != null && longitude != null) await updatePhoto(photo.id, { latitude, longitude });
  }
  if (photo.special_kind === 'central') state.pendingCentralPhotoId = photo.id;
  else state.pendingParkingPhotoId = photo.id;
  renderMap();
  document.querySelector('.map-band')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(photo.special_kind === 'central' ? 'Sleep het 230V icoon naar centrale apparatuur' : 'Sleep de blauwe P naar de juiste parkeerplek');
}

function selectMapPhoto(photoId, redraw = false) {
  const photo = state.photos.find(p => p.id === photoId);
  if (!photo) return;
  state.selectedPhotoId = photoId;
  $('selected-camera').textContent = `CAM-${padCam(photo.camera_number)} ${photo.floor || 'BG'}`;
  $('heading-slider').value = Number(photo.heading || 0);
  $('fov-slider').value = Number(photo.fov || 90);
  $('range-slider').value = Number(photo.range || 20);
  updateConeLabels();
  if (redraw) renderMap();
  updateConePrompt();
}

function updateSelectedConeFromControls() {
  const photo = state.photos.find(p => p.id === state.selectedPhotoId);
  if (!photo) return;
  photo.heading = Number($('heading-slider').value);
  photo.fov = Number($('fov-slider').value);
  photo.range = Number($('range-slider').value);
  updateConeLabels();
  renderMap();
  state.selectedPhotoId = photo.id;
  selectMapPhoto(photo.id);
}

async function saveSelectedCone() {
  const photo = state.photos.find(p => p.id === state.selectedPhotoId);
  if (!photo) return showToast('Selecteer eerst een camera op de kaart');
  try {
    await updatePhoto(photo.id, {
      heading: Number($('heading-slider').value),
      fov: Number($('fov-slider').value),
      range: Number($('range-slider').value)
    });
    if (state.pendingConePhotoId === photo.id) state.pendingConePhotoId = null;
    closeConeOverlay();
    updateConePrompt();
    updateWorkflowStatus();
    renderMap();
    selectMapPhoto(photo.id);
    if (state.workflowGate && Number(photo.camera_number) === Number(state.workflowGate.completedCam)) {
      openWorkflowModal();
    } else {
      restoreRetakeResumeIfNeeded();
    }
    showToast(`Cone CAM-${padCam(photo.camera_number)} opgeslagen`);
  } catch (err) {
    showToast(err.message);
  }
}

function scrollToCaptureTop() {
  const target = document.querySelector('.topbar') || document.querySelector('.stage') || document.body;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function updatePhoto(photoId, patch) {
  const data = await localApi.updatePhoto(photoId, patch);
  if (!data.success) throw new Error(data.error || 'Foto update mislukt');
  const idx = state.photos.findIndex(p => p.id === photoId);
  if (idx >= 0) state.photos[idx] = data.data;
  return data.data;
}

function updateConeLabels() {
  $('heading-value').textContent = `${$('heading-slider').value} graden`;
  $('fov-value').textContent = `${$('fov-slider').value} graden`;
  $('range-value').textContent = `${$('range-slider').value} m`;
}

function updateConePrompt() {
  const prompt = $('cone-prompt');
  const controls = document.querySelector('.map-controls');
  if (!prompt || !controls) return;
  const selected = state.photos.find(p => p.id === state.selectedPhotoId);
  const pending = state.pendingConePhotoId ? state.photos.find(p => p.id === state.pendingConePhotoId) : null;

  controls.classList.toggle('pending-cone', Boolean(pending));
  prompt.classList.toggle('active', Boolean(pending));
  if (pending) {
    prompt.textContent = `Stel nu de cone voor CAM-${padCam(pending.camera_number)} in en klik op Cone opslaan.`;
  } else if (selected) {
    prompt.textContent = `Cone gekoppeld aan CAM-${padCam(selected.camera_number)}. Pas richting, beeldhoek of bereik aan indien nodig.`;
  } else {
    prompt.textContent = 'Maak een beeldfoto om de cone voor die camera te plaatsen.';
  }
}

function computeCone(photo) {
  const lat = Number(photo.latitude);
  const lng = Number(photo.longitude);
  const heading = Number(photo.heading || 0);
  const fov = Number(photo.fov || 90);
  const range = Number(photo.range || 20);
  const points = [[lat, lng]];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const bearing = heading - fov / 2 + (fov * i / steps);
    points.push(destinationPoint(lat, lng, bearing, range));
  }
  points.push([lat, lng]);
  return points;
}

function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const radius = 6371000;
  const delta = distanceM / radius;
  const theta = bearingDeg * Math.PI / 180;
  const phi1 = lat * Math.PI / 180;
  const lambda1 = lng * Math.PI / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return [phi2 * 180 / Math.PI, lambda2 * 180 / Math.PI];
}
