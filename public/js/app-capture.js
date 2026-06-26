// Photo capture, retake, cone workflow, and diagnostics.
async function captureCurrent() {
  if (!state.session) {
    openSessionModal();
    return showToast('Start eerst een sessie');
  }
  if (state.workflowModalOpen) return showToast('Rond eerst de huidige cameraset af');
  if (state.captureBusy) return;
  try {
    setCaptureBusy(true, state.retakePhotoId ? 'Foto vervangen...' : state.referenceCaptureActive ? referenceCaptureBusyText() : state.mode === 'beeld' ? 'Beeldfoto maken...' : 'Locatiefoto maken...');
    if (state.mode === 'locatie' && !state.phoneStream) {
      state.pendingMobileFileCapture = {
        mode: state.mode,
        cameraNumber: Number($('camera-number').value || 1),
        referenceCaptureActive: state.referenceCaptureActive,
        specialCaptureKind: state.specialCaptureKind
      };
      $('mobile-photo-input').click();
      return;
    }
    if (state.retakePhotoId) {
      const target = state.photos.find(photo => photo.id === state.retakePhotoId);
      if (!target) throw new Error('Foto niet gevonden');
      const rawBlob = target.type === 'beeld' ? await fetchUnvSnapshot() : await capturePhoneBlob();
      const referenceNumber = target.type === 'referentie' ? getReferenceNumber(target) : null;
      const blob = target.type === 'referentie' ? await addReferenceTextToBlob(rawBlob, target.reference_text || buildReferenceText(referenceNumber)) : rawBlob;
      const recreated = await recreatePhoto(target, blob);
      state.retakePhotoId = null;
      state.referenceCaptureActive = false;
      if (recreated.type === 'beeld') promptForCone(recreated);
      else finalizeRetakeFlow(recreated);
      showToast('Foto vervangen');
      return;
    }
    if (state.referenceCaptureActive) {
      const rawBlob = await capturePhoneBlob();
      const referenceNumber = getNextReferenceNumber();
      const referenceText = state.specialCaptureKind ? buildSpecialReferenceText(state.specialCaptureKind, referenceNumber) : buildReferenceText(referenceNumber);
      const blob = await addReferenceTextToBlob(rawBlob, referenceText);
      const photo = await uploadPhoto(blob, {
        type: 'referentie',
        camera_number: 0,
        reference_number: referenceNumber,
        source: state.specialCaptureKind ? `device-${state.specialCaptureKind}` : 'device-reference',
        reference_text: referenceText,
        special_kind: state.specialCaptureKind || ''
      });
      const specialKind = state.specialCaptureKind;
      state.referenceCaptureActive = false;
      state.specialCaptureKind = '';
      setMode(state.referencePreviousMode || 'beeld');
      if (specialKind) {
        openSpecialQuestion(photo, specialKind);
      } else {
        showToast('Referentiefoto vastgelegd');
      }
      return;
    }
    const blob = state.mode === 'beeld' ? await fetchUnvSnapshot() : await capturePhoneBlob();
    const savedType = state.mode;
    const savedCam = Number($('camera-number').value || 1);
    const savedPhoto = await uploadPhoto(blob);
    if (savedType === 'beeld') promptForCone(savedPhoto);
    advanceWorkflow(savedType, savedCam);
    if (state.mode === 'beeld') refreshUnvFrame(false);
  } catch (err) {
    showToast(err.message);
  } finally {
    if (!state.pendingMobileFileCapture) setCaptureBusy(false);
  }
}

async function handleMobilePhotoInput(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file || !state.pendingMobileFileCapture) return;
  const pending = state.pendingMobileFileCapture;
  state.pendingMobileFileCapture = null;
  try {
    setCaptureBusy(true, state.retakePhotoId ? 'Foto vervangen...' : 'Locatiefoto verwerken...');
    const previousMode = state.mode;
    state.mode = pending.mode;
    $('camera-number').value = pending.cameraNumber;
    if (state.retakePhotoId) {
      const target = state.photos.find(photo => photo.id === state.retakePhotoId);
      if (!target) throw new Error('Foto niet gevonden');
      const referenceNumber = target.type === 'referentie' ? getReferenceNumber(target) : null;
      const blob = target.type === 'referentie' ? await addReferenceTextToBlob(file, target.reference_text || buildReferenceText(referenceNumber)) : file;
      const recreated = await recreatePhoto(target, blob);
      state.retakePhotoId = null;
      state.mode = previousMode;
      if (recreated.type === 'beeld') promptForCone(recreated);
      else finalizeRetakeFlow(recreated);
      showToast('Foto vervangen');
      return;
    }
    if (pending.referenceCaptureActive) {
      const referenceNumber = getNextReferenceNumber();
      const referenceText = pending.specialCaptureKind ? buildSpecialReferenceText(pending.specialCaptureKind, referenceNumber) : buildReferenceText(referenceNumber);
      const blob = await addReferenceTextToBlob(file, referenceText);
      const photo = await uploadPhoto(blob, {
        type: 'referentie',
        camera_number: 0,
        reference_number: referenceNumber,
        source: pending.specialCaptureKind ? `device-${pending.specialCaptureKind}` : 'device-reference',
        reference_text: referenceText,
        special_kind: pending.specialCaptureKind || ''
      });
      state.referenceCaptureActive = false;
      state.specialCaptureKind = '';
      state.mode = previousMode;
      setMode(state.referencePreviousMode || previousMode || 'beeld');
      if (pending.specialCaptureKind) openSpecialQuestion(photo, pending.specialCaptureKind);
      else showToast('Referentiefoto vastgelegd');
      return;
    }
    await uploadPhoto(file);
    state.mode = previousMode;
    advanceWorkflow(pending.mode, pending.cameraNumber);
  } catch (err) {
    showToast(err.message);
  } finally {
    setCaptureBusy(false);
  }
}


async function uploadPhoto(blob, overrides = {}) {
  const meta = {
    type: state.mode,
    camera_number: $('camera-number').value,
    floor: $('floor').value || 'BG',
    source: state.mode === 'beeld' ? 'unv' : 'device',
    ...overrides
  };
  if (meta.type === 'beeld') {
    meta.heading = 0;
    meta.fov = 90;
    meta.range = 20;
  }
  if (state.gps.latitude != null) {
    meta.latitude = state.gps.latitude;
    meta.longitude = state.gps.longitude;
    meta.accuracy = state.gps.accuracy || '';
  }
  if (state.retakePhotoId) {
    const target = state.photos.find(photo => photo.id === state.retakePhotoId);
    if (!target) throw new Error('Te vervangen foto niet gevonden');
    const updated = await recreatePhoto(target, blob, meta);
    state.retakePhotoId = null;
    showToast('Foto vervangen');
    return updated;
  }
  const data = await localApi.addPhoto(state.session.id, blob, meta);
  if (!data.success) throw new Error(data.error || 'Upload mislukt');
  state.photos.push(data.data);
  renderGallery();
  if (meta.type === 'beeld' || meta.special_kind === 'parking' || meta.special_kind === 'central') renderMap();
  updateWorkflowStatus();
  showToast(`${meta.type === 'beeld' ? 'Beeld' : meta.type === 'referentie' ? 'Referentie' : 'Locatie'} vastgelegd`);
  return data.data;
}

async function recreatePhoto(photo, blob, meta = {}) {
  const payload = {
    type: meta.type || photo.type,
    camera_number: meta.camera_number !== undefined ? Number(meta.camera_number) : Number(photo.camera_number || 1),
    floor: meta.floor !== undefined ? meta.floor : (photo.floor || 'BG'),
    source: meta.source || (photo.type === 'beeld' ? 'unv-retake' : photo.type === 'referentie' ? 'device-reference-retake' : 'device-retake'),
    note: meta.note !== undefined ? meta.note : (photo.note || ''),
    reference_number: meta.reference_number !== undefined ? Number(meta.reference_number) : (photo.reference_number != null ? Number(photo.reference_number) : null),
    reference_text: meta.reference_text !== undefined ? meta.reference_text : (photo.reference_text || ''),
    special_kind: meta.special_kind !== undefined ? meta.special_kind : (photo.special_kind || ''),
    special_answer: meta.special_answer !== undefined ? meta.special_answer : (photo.special_answer || '')
  };
  if (payload.type === 'beeld') {
    payload.heading = 0;
    payload.fov = 90;
    payload.range = 20;
  }
  if (state.gps.latitude != null) {
    payload.latitude = state.gps.latitude;
    payload.longitude = state.gps.longitude;
    if (state.gps.accuracy != null) payload.accuracy = state.gps.accuracy;
  }
  const created = await localApi.addPhoto(state.session.id, blob, payload);
  if (!created.success) throw new Error(created.error || 'Nieuwe foto opslaan mislukt');
  const removed = await localApi.deletePhoto(photo.id);
  if (!removed.success) throw new Error(removed.error || 'Oude foto verwijderen mislukt');
  state.photos = state.photos
    .filter(item => item.id !== photo.id)
    .concat(created.data);
  if (state.selectedPhotoId === photo.id) state.selectedPhotoId = null;
  if (state.pendingConePhotoId === photo.id) state.pendingConePhotoId = null;
  state.selectedGalleryPhotoId = created.data.id;
  renderGallery();
  if (photo.type === 'beeld' || payload.type === 'beeld') renderMap();
  updateWorkflowStatus();
  return created.data;
}

function startRetakePhoto(photoId) {
  const photo = state.photos.find(item => item.id === photoId);
  if (!photo) return showToast('Foto niet gevonden');
  if (!state.workflowGate) {
    state.retakeResume = {
      floor: $('floor').value || 'BG'
    };
  }
  state.retakePhotoId = photo.id;
  state.referenceCaptureActive = false;
  state.specialCaptureKind = '';
  if (photo.type !== 'referentie') $('camera-number').value = Number(photo.camera_number || 1);
  $('floor').value = photo.floor || 'BG';
  setMode(photo.type === 'beeld' ? 'beeld' : 'locatie');
  scrollToCaptureTop();
  showToast(`${photoDisplayLabel(photo)} opnieuw maken`);
}

function startReferenceCapture() {
  if (!state.session) {
    openSessionModal();
    return showToast('Start eerst een sessie');
  }
  state.referencePreviousMode = state.mode;
  state.referenceCaptureActive = true;
  state.specialCaptureKind = '';
  state.retakePhotoId = null;
  setMode('locatie');
  scrollToCaptureTop();
  showToast('Maak nu de referentiefoto met de achtercamera');
}

function startSpecialReferenceCapture(kind) {
  if (!state.session) {
    openSessionModal();
    return showToast('Start eerst een sessie');
  }
  state.referencePreviousMode = state.mode;
  state.referenceCaptureActive = true;
  state.specialCaptureKind = kind;
  state.retakePhotoId = null;
  setMode('locatie');
  scrollToCaptureTop();
  showToast(`${specialKindLabel(kind)} foto maken met de achtercamera`);
}

function referenceCaptureBusyText() {
  if (state.specialCaptureKind === 'central') return 'Centrale apparatuur vastleggen...';
  if (state.specialCaptureKind === 'parking') return 'Parkeermogelijkheid vastleggen...';
  return 'Referentiefoto maken...';
}

function getNextReferenceNumber() {
  return state.photos
    .filter(photo => photo.type === 'referentie')
    .reduce((max, photo) => Math.max(max, Number(photo.reference_number || 0)), 0) + 1;
}

function getReferenceNumber(photo) {
  if (photo?.reference_number != null && Number(photo.reference_number) > 0) return Number(photo.reference_number);
  const references = state.photos
    .filter(item => item.type === 'referentie')
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  const index = references.findIndex(item => item.id === photo?.id);
  return index >= 0 ? index + 1 : 1;
}

function photoDisplayLabel(photo) {
  if (!photo) return 'Foto';
  if (photo.special_kind) return `${specialKindLabel(photo.special_kind)} ${getReferenceNumber(photo)}`;
  if (photo.type === 'referentie') return `Referentie ${getReferenceNumber(photo)}`;
  return `${photo.type} CAM-${photo.camera_number}`;
}

function buildReferenceText(referenceNumber = getNextReferenceNumber()) {
  const sessionName = state.session?.name || 'GeoSnap';
  return `${sessionName} | Referentie ${referenceNumber} | ${new Date().toLocaleString('nl-NL')}`;
}

function buildSpecialReferenceText(kind, referenceNumber = getNextReferenceNumber()) {
  const sessionName = state.session?.name || 'GeoSnap';
  return `${sessionName} | ${specialKindLabel(kind)} ${referenceNumber} | ${new Date().toLocaleString('nl-NL')}`;
}

function specialKindLabel(kind) {
  if (kind === 'central') return 'Centrale apparatuur';
  if (kind === 'parking') return 'Parkeermogelijkheid';
  return 'Referentie';
}

function specialKindQuestion(kind) {
  if (kind === 'central') return 'Hoe krijgt de NVR/Switch 230V?';
  if (kind === 'parking') return 'Kan je hier goed parkeren? Is er ruimte voor een bus van 2 meter hoog?';
  return '';
}

function openSpecialQuestion(photo, kind = photo?.special_kind || '') {
  if (!photo || !kind) return;
  state.pendingSpecialQuestionPhotoId = photo.id;
  $('special-question-title').textContent = specialKindLabel(kind);
  $('special-question-text').textContent = specialKindQuestion(kind);
  $('special-question-answer').value = photo.special_answer || '';
  $('special-question-modal').classList.add('open');
  document.body.classList.add('modal-open');
}

function closeSpecialQuestionModal() {
  $('special-question-modal')?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

async function saveSpecialQuestion() {
  const photo = state.photos.find(item => item.id === state.pendingSpecialQuestionPhotoId);
  if (!photo) return closeSpecialQuestionModal();
  try {
    await updatePhoto(photo.id, { special_answer: $('special-question-answer').value.trim() });
    finishSpecialQuestion(photo);
  } catch (err) {
    showToast(err.message);
  }
}

function skipSpecialQuestion() {
  const photo = state.photos.find(item => item.id === state.pendingSpecialQuestionPhotoId);
  finishSpecialQuestion(photo);
}

function finishSpecialQuestion(photo) {
  closeSpecialQuestionModal();
  state.pendingSpecialQuestionPhotoId = null;
  renderGallery();
  if (photo?.special_kind === 'parking' || photo?.special_kind === 'central') {
    startSpecialMarkerPlacement(photo.id);
    return;
  }
  showToast(`${specialKindLabel(photo?.special_kind)} vastgelegd`);
}

function advanceWorkflow(savedType, savedCam) {
  if (savedType === 'beeld') {
    if (hasLocationPhotoForCamera(savedCam)) {
      state.workflowGate = {
        completedCam: Number(savedCam),
        nextCam: Number(savedCam) + 1
      };
      state.missingImageGate = null;
      state.missingImageModalOpen = false;
    }
    setMode('locatie');
    showToast(`CAM-${padCam(savedCam)} beeld vastgelegd. Stel de cone in en neem daarna locatie.`);
    return;
  }
  if (!hasImagePhotoForCamera(savedCam)) {
    openMissingImageModal(savedCam);
    return;
  }
  state.workflowGate = {
    completedCam: Number(savedCam),
    nextCam: Number(savedCam) + 1
  };
  openWorkflowModal();
}

function hasImagePhotoForCamera(cameraNumber) {
  return state.photos.some(photo => photo.type === 'beeld' && Number(photo.camera_number) === Number(cameraNumber));
}

function hasLocationPhotoForCamera(cameraNumber) {
  return state.photos.some(photo => photo.type === 'locatie' && Number(photo.camera_number) === Number(cameraNumber));
}

function openMissingImageModal(cameraNumber) {
  const cam = Number(cameraNumber || 1);
  state.missingImageGate = {
    completedCam: cam,
    nextCam: cam + 1
  };
  state.missingImageModalOpen = true;
  $('missing-image-camera').textContent = `CAM-${padCam(cam)}`;
  $('missing-image-modal').classList.add('open');
  document.body.classList.add('modal-open');
  syncCaptureLocks();
}

function closeMissingImageModal(clearGate = false) {
  state.missingImageModalOpen = false;
  if (clearGate) state.missingImageGate = null;
  $('missing-image-modal')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  syncCaptureLocks();
}

function continueMissingImageWithPhoto() {
  const gate = state.missingImageGate;
  if (!gate) return;
  $('camera-number').value = gate.completedCam;
  closeMissingImageModal(false);
  setMode('beeld');
  updateWorkflowStatus();
  showToast(`Maak nu beeldfoto CAM-${padCam(gate.completedCam)}`);
}

function continueMissingImageToNextCamera() {
  const gate = state.missingImageGate;
  if (!gate) return;
  $('camera-number').value = gate.nextCam;
  closeMissingImageModal(true);
  setMode('beeld');
  updateWorkflowStatus();
  showToast(`Doorgaan naar CAM-${padCam(gate.nextCam)}`);
}

function promptForCone(photo) {
  if (!photo || photo.type !== 'beeld') return;
  state.pendingConePhotoId = photo.id;
  state.selectedPhotoId = photo.id;
  renderMap();
  selectMapPhoto(photo.id);
  updateWorkflowStatus();
  openConeOverlay();
}

function openConeOverlay() {
  const mapSection = document.querySelector('.map-band');
  if (!mapSection) return;
  state.coneOverlayOpen = true;
  mapSection.classList.add('cone-overlay');
  document.body.classList.add('modal-open');
  setTimeout(() => state.map?.invalidateSize(), 120);
}

function closeConeOverlay() {
  const mapSection = document.querySelector('.map-band');
  state.coneOverlayOpen = false;
  mapSection?.classList.remove('cone-overlay');
  document.body.classList.remove('modal-open');
  setTimeout(() => state.map?.invalidateSize(), 80);
}

function openWorkflowModal() {
  const modal = $('workflow-modal');
  const gate = state.workflowGate;
  if (!modal || !gate) return;
  state.workflowModalOpen = true;
  $('workflow-next-camera').textContent = `CAM-${padCam(gate.nextCam)}`;
  modal.classList.add('open');
  document.body.classList.add('modal-open');
  syncCaptureLocks();
}

function closeWorkflowModal(clearGate = false) {
  const modal = $('workflow-modal');
  state.workflowModalOpen = false;
  if (clearGate) state.workflowGate = null;
  modal?.classList.remove('open');
  document.body.classList.remove('modal-open');
  syncCaptureLocks();
}

function continueWorkflowToNextCamera() {
  const gate = state.workflowGate;
  if (!gate) return;
  $('camera-number').value = gate.nextCam;
  closeWorkflowModal(true);
  setMode('beeld');
  updateWorkflowStatus();
  showToast(`Schouwer gaat verder naar CAM-${padCam(gate.nextCam)}`);
}

function continueWorkflowWithRetake(type) {
  const gate = state.workflowGate;
  if (!gate) return;
  const photo = state.photos.find(item => Number(item.camera_number) === Number(gate.completedCam) && item.type === type);
  if (!photo) return showToast(`${type} foto niet gevonden voor CAM-${padCam(gate.completedCam)}`);
  closeWorkflowModal(false);
  startRetakePhoto(photo.id);
}

function reopenWorkflowGateIfNeeded(photo) {
  const gate = state.workflowGate;
  if (!gate || !photo) return;
  if (Number(photo.camera_number) !== Number(gate.completedCam)) return;
  if (photo.type === 'beeld') return;
  openWorkflowModal();
}

function restoreRetakeResumeIfNeeded() {
  const resume = state.retakeResume;
  if (!resume) return;
  const next = getNextWorkflowStep();
  $('camera-number').value = Number(next.cameraNumber || 1);
  $('floor').value = resume.floor || 'BG';
  setMode(next.mode || 'beeld');
  state.retakeResume = null;
  updateWorkflowStatus();
}

function finalizeRetakeFlow(photo) {
  if (state.workflowGate && Number(photo.camera_number) === Number(state.workflowGate.completedCam)) {
    openWorkflowModal();
    return;
  }
  restoreRetakeResumeIfNeeded();
}

function updateWorkflowStatus() {
  const el = $('workflow-status');
  if (!el) return;
  const cam = Number($('camera-number')?.value || 1);
  const hasLoc = state.photos.some(p => Number(p.camera_number) === cam && p.type === 'locatie');
  const hasImg = state.photos.some(p => Number(p.camera_number) === cam && p.type === 'beeld');
  const current = state.mode === 'beeld' ? 'Beeld' : 'Locatie';
  const complete = hasLoc && hasImg ? ' compleet' : '';
  const pending = state.pendingConePhotoId ? state.photos.find(p => p.id === state.pendingConePhotoId) : null;
  const coneText = pending ? ` | Cone CAM-${padCam(pending.camera_number)} instellen` : '';
  el.textContent = `Volgende stap: CAM-${padCam(cam)} ${current}${complete}${coneText}`;
}

function padCam(value) {
  return String(Number(value || 1)).padStart(3, '0');
}

function getNextWorkflowStep() {
  const byCam = new Map();
  state.photos.forEach(photo => {
    const cam = Number(photo.camera_number || 1);
    if (!byCam.has(cam)) byCam.set(cam, new Set());
    byCam.get(cam).add(photo.type);
  });
  let cam = 1;
  while (true) {
    const types = byCam.get(cam) || new Set();
    if (!types.has('beeld')) return { cameraNumber: cam, mode: 'beeld' };
    if (!types.has('locatie')) return { cameraNumber: cam, mode: 'locatie' };
    cam += 1;
  }
}

async function diagnoseCamera() {
  saveCameraSettings();
  const camera = getCameraSettings();
  const mode = isNativeMobileApp() && getCapacitorHttp() ? 'Native Capacitor HTTP' : 'Browser fetch fallback';
  $('diagnose-output').textContent = `Modus: ${mode}\nDiagnose loopt...`;
  const rows = [`Modus: ${mode}`];
  rows.push('', 'Videoprofielen');
  for (const profilePath of VIDEO_PROFILE_PATHS) {
    const url = `http://${camera.ip}${profilePath}`;
    try {
      if (isNativeMobileApp() && getCapacitorHttp()) {
        const response = await nativeCameraRequest(camera, profilePath);
        const contentType = responseContentType(response) || '-';
        rows.push(`${profilePath} -> ${response.status} ${contentType} ${responseByteLength(response)} bytes | ${responsePreview(response, 400) || '-'}`);
      } else {
        const response = await fetch(url, { cache: 'no-store' });
        const contentType = response.headers.get('content-type') || '-';
        rows.push(`${profilePath} -> ${response.status} ${contentType} ${response.headers.get('content-length') || '?'} bytes | ${compactPreview(await response.clone().text().catch(() => '')) || '-'}`);
      }
    } catch (err) {
      rows.push(`${profilePath} -> fout: ${err.message || err}`);
    }
    $('diagnose-output').textContent = rows.join('\n');
  }
  try {
    const mjpegProfiles = parseMjpegVideoProfiles(await fetchSunapiText(camera, VIDEO_PROFILE_PATHS[0]));
    rows.push('', `MJPEG snapshot-profielen gevonden: ${mjpegProfiles.length ? mjpegProfiles.map(item => `Channel=${item.channel} Profile=${item.profile}`).join(', ') : 'geen'}`);
  } catch (err) {
    rows.push('', `MJPEG snapshot-profielen gevonden: niet leesbaar (${err.message || err})`);
  }
  rows.push('', 'Snapshot paden');
  for (const snapshotPath of await getSnapshotPaths(camera, true)) {
    const path = snapshotPath;
    const url = `http://${camera.ip}${path}`;
    try {
      if (isNativeMobileApp() && getCapacitorHttp()) {
        const response = await nativeCameraRequest(camera, path);
        const contentType = responseContentType(response) || '-';
        const preview = /^image\//i.test(contentType) ? '' : responsePreview(response);
        rows.push(`${snapshotPath} -> ${response.status} ${contentType} ${responseByteLength(response)} bytes${preview ? ` | ${preview}` : ''}`);
      } else {
        const response = await fetch(url, { cache: 'no-store' });
        const contentType = response.headers.get('content-type') || '-';
        const preview = /^image\//i.test(contentType) ? '' : compactPreview(await response.clone().text().catch(() => ''));
        rows.push(`${snapshotPath} -> ${response.status} ${contentType} ${response.headers.get('content-length') || '?'} bytes${preview ? ` | ${preview}` : ''}`);
      }
    } catch (err) {
      rows.push(`${snapshotPath} -> fout: ${err.message || err}`);
    }
    $('diagnose-output').textContent = rows.join('\n');
  }
}
