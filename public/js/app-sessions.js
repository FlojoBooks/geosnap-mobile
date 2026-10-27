// Session drawer, creation, and opening flow.
async function createSession() {
  await createSessionFromValues({
    name: $('session-name').value.trim(),
    location: $('session-location').value.trim(),
    surveyor: $('session-surveyor').value.trim(),
    client_id: $('session-client-id').value
  });
}

async function createSessionFromModal() {
  await createSessionFromValues({
    name: $('modal-session-name').value.trim(),
    location: $('modal-session-location').value.trim(),
    surveyor: $('modal-session-surveyor').value.trim(),
    client_id: $('modal-session-client-id').value
  });
  closeSessionModal();
}

async function createSessionFromValues(body) {
  const data = await localApi.createSession(body);
  if (!data.success) return showToast(data.error || 'Sessie aanmaken mislukt');
  state.session = data.data;
  state.photos = [];
  state.selectedPhotoId = null;
  state.selectedGalleryPhotoId = null;
  state.pendingConePhotoId = null;
  closeWorkflowModal(true);
  closeMissingImageModal(true);
  state.retakeResume = null;
  closeConeOverlay();
  state.retakePhotoId = null;
  state.referenceCaptureActive = false;
  state.specialCaptureKind = '';
  state.pendingSpecialQuestionPhotoId = null;
  state.pendingParkingPhotoId = null;
  state.pendingCentralPhotoId = null;
  $('active-session').textContent = `${state.session.name} - ${state.session.location || 'geen locatie'}`;
  $('camera-number').value = 1;
  setMode('beeld');
  updateWorkflowStatus();
  renderGallery();
  renderMap();
  updateSwitchButtonVisibility();
  await loadSessions(state.session.id);
  closeDrawer();
  closeSessionModal();
  showToast('Sessie gestart');
}

async function loadSessions(selectedId = state.session?.id || '') {
  const list = $('session-list');
  if (!list) return;
  try {
    const data = await localApi.listSessions();
    if (!data.success) throw new Error(data.error || 'Sessie lijst mislukt');
    list.innerHTML = '';
    if (!data.data.length) {
      list.innerHTML = '<p class="muted">Geen sessies</p>';
      return;
    }
    data.data.forEach(session => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'session-item';
      if (selectedId === session.id) item.classList.add('active');
      const date = new Date(session.created_at).toLocaleDateString('nl-NL');
      item.innerHTML = `<strong>${escapeHtml(session.name)}</strong><span>${escapeHtml(session.location || 'zonder locatie')} - ${date}</span>`;
      item.addEventListener('click', () => openSessionById(session.id));
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = '<p class="muted">Laden mislukt</p>';
    showToast(err.message);
  }
}

async function openSessionById(id) {
  if (!id) return showToast('Geen sessie geselecteerd');
  const data = await localApi.getSession(id);
  if (!data.success) return showToast(data.error || 'Sessie openen mislukt');
  const { photos, ...sessionData } = data.data;
  state.session = sessionData;
  state.photos = photos || [];
  state.selectedPhotoId = null;
  state.selectedGalleryPhotoId = null;
  state.pendingConePhotoId = null;
  closeWorkflowModal(true);
  closeMissingImageModal(true);
  state.retakeResume = null;
  closeConeOverlay();
  state.retakePhotoId = null;
  state.referenceCaptureActive = false;
  state.specialCaptureKind = '';
  state.pendingSpecialQuestionPhotoId = null;
  state.pendingParkingPhotoId = null;
  state.pendingCentralPhotoId = null;
  $('active-session').textContent = `${state.session.name} - ${state.session.location || 'geen locatie'}`;
  const next = getNextWorkflowStep();
  $('camera-number').value = next.cameraNumber;
  setMode(next.mode);
  renderGallery();
  renderMap();
  updateWorkflowStatus();
  updateSwitchButtonVisibility();
  await loadSessions(state.session.id);
  closeDrawer();
  showToast('Sessie geopend');
}

function openDrawer() {
  $('drawer').classList.add('open');
  $('drawer-backdrop').classList.add('open');
  loadSessions();
}

function closeDrawer() {
  $('drawer').classList.remove('open');
  $('drawer-backdrop').classList.remove('open');
}

function openSessionModal() {
  if (typeof populateSessionClientSelects === 'function') populateSessionClientSelects();
  $('modal-session-name').value = $('session-name').value.trim() || `Schouw ${new Date().toLocaleDateString('nl-NL')}`;
  $('modal-session-location').value = $('session-location').value.trim();
  $('modal-session-surveyor').value = $('session-surveyor').value.trim() || 'CHS';
  $('session-modal').classList.add('open');
}

function closeSessionModal() {
  $('session-modal').classList.remove('open');
}

function updateSwitchButtonVisibility() {
  const btn = $('btn-switch-equipment');
  if (!btn) return;
  const config = state.session?.quote_config;
  if (config && config.subswitch_needed === 'ja' && Number(config.subswitch_qty || 0) > 0) {
    btn.style.display = 'inline-block';
  } else {
    btn.style.display = 'none';
  }
}

