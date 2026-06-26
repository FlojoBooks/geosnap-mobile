// In-app session gallery and photo notes.
function renderGallery() {
  const gallery = $('gallery');
  const summary = $('gallery-summary');
  if (summary) {
    if (!state.session) {
      summary.textContent = 'Geen sessie actief';
    } else {
      const beeld = state.photos.filter(p => p.type === 'beeld').length;
      const locatie = state.photos.filter(p => p.type === 'locatie').length;
      summary.textContent = `${state.session.name} - ${state.photos.length} foto's (${beeld} beeld, ${locatie} locatie)`;
    }
  }
  if (!state.photos.length) {
    gallery.innerHTML = '<p class="muted">Nog geen foto\'s vastgelegd.</p>';
    return;
  }
  const orderedPhotos = [...state.photos].sort(compareGalleryPhotos);
  gallery.innerHTML = orderedPhotos.map(photo => `
    <article class="thumb${photo.id === state.selectedGalleryPhotoId ? ' open' : ''}" data-photo-id="${photo.id}">
      <img src="${photo.filename}" alt="${escapeHtml(photoDisplayLabel(photo))}" />
      <div><span>${escapeHtml(photoDisplayLabel(photo))}</span><span>${photo.special_kind === 'parking' ? 'P' : photo.special_kind === 'central' ? '230V' : photo.type === 'referentie' ? 'REF' : photo.floor}</span></div>
      ${photo.note ? `<span class="thumb-note">${escapeHtml(photo.note)}</span>` : ''}
      <section class="thumb-actions">
        <button class="secondary" type="button" data-action="fullscreen" data-photo-id="${photo.id}">Volledig scherm</button>
        <button class="secondary" type="button" data-action="retake" data-photo-id="${photo.id}">Foto opnieuw maken</button>
        <button class="secondary" type="button" data-action="note" data-photo-id="${photo.id}">Opmerking toevoegen</button>
        <button class="secondary danger" type="button" data-action="delete" data-photo-id="${photo.id}">Foto verwijderen</button>
      </section>
    </article>
  `).join('');
}

function compareGalleryPhotos(a, b) {
  if (a.type === 'referentie' || b.type === 'referentie') {
    if (a.type !== b.type) return galleryTypeOrder(a.type) - galleryTypeOrder(b.type);
    return getReferenceNumber(a) - getReferenceNumber(b);
  }
  const camDiff = Number(a.camera_number || 0) - Number(b.camera_number || 0);
  if (camDiff !== 0) return camDiff;
  const typeDiff = galleryTypeOrder(a.type) - galleryTypeOrder(b.type);
  if (typeDiff !== 0) return typeDiff;
  return new Date(a.created_at || 0) - new Date(b.created_at || 0);
}

function galleryTypeOrder(type) {
  if (type === 'beeld') return 0;
  if (type === 'locatie') return 1;
  if (type === 'referentie') return 2;
  return 3;
}

function handleGalleryClick(event) {
  const action = event.target.closest('[data-action]');
  if (action) {
    event.stopPropagation();
    const photoId = action.dataset.photoId;
    if (action.dataset.action === 'fullscreen') return openPhotoViewer(photoId);
    if (action.dataset.action === 'retake') return startRetakePhoto(photoId);
    if (action.dataset.action === 'note') return openNoteModal(photoId);
    if (action.dataset.action === 'delete') return deleteGalleryPhoto(photoId);
  }
  const item = event.target.closest('.thumb');
  if (!item) return;
  state.selectedGalleryPhotoId = state.selectedGalleryPhotoId === item.dataset.photoId ? null : item.dataset.photoId;
  renderGallery();
}

async function deleteGalleryPhoto(photoId) {
  const photo = state.photos.find(item => item.id === photoId);
  if (!photo) return showToast('Foto niet gevonden');
  const label = photoDisplayLabel(photo);
  const confirmed = window.confirm
    ? window.confirm(`${label} verwijderen?\n\nDeze actie kan niet ongedaan worden gemaakt.`)
    : false;
  if (!confirmed) return;
  try {
    const result = await localApi.deletePhoto(photo.id);
    if (!result.success) throw new Error(result.error || 'Foto verwijderen mislukt');
    if (photo.filename) URL.revokeObjectURL(photo.filename);
    state.photos = state.photos.filter(item => item.id !== photo.id);
    if (state.selectedGalleryPhotoId === photo.id) state.selectedGalleryPhotoId = null;
    if (state.selectedPhotoId === photo.id) state.selectedPhotoId = null;
    if (state.pendingConePhotoId === photo.id) state.pendingConePhotoId = null;
    if (state.pendingParkingPhotoId === photo.id) state.pendingParkingPhotoId = null;
    if (state.pendingCentralPhotoId === photo.id) state.pendingCentralPhotoId = null;
    if (state.pendingSpecialQuestionPhotoId === photo.id) {
      state.pendingSpecialQuestionPhotoId = null;
      closeSpecialQuestionModal();
    }
    if (state.retakePhotoId === photo.id) state.retakePhotoId = null;
    closePhotoViewer();
    closeNoteModal();
    renderGallery();
    renderMap();
    updateWorkflowStatus();
    showToast('Foto verwijderd');
  } catch (err) {
    showToast(err.message || 'Foto verwijderen mislukt');
  }
}

function openPhotoViewer(photoId) {
  const photo = state.photos.find(item => item.id === photoId);
  if (!photo) return showToast('Foto niet gevonden');
  $('photo-viewer-title').textContent = photoDisplayLabel(photo);
  $('photo-viewer-image').src = photo.filename;
  $('photo-viewer-image').alt = photoDisplayLabel(photo);
  $('photo-viewer-modal').classList.add('open');
  document.body.classList.add('modal-open');
}

function closePhotoViewer() {
  $('photo-viewer-modal')?.classList.remove('open');
  $('photo-viewer-image')?.removeAttribute('src');
  document.body.classList.remove('modal-open');
}

function openNoteModal(photoId) {
  const photo = state.photos.find(item => item.id === photoId);
  if (!photo) return showToast('Foto niet gevonden');
  state.selectedGalleryPhotoId = photo.id;
  $('note-photo-label').textContent = `${photoDisplayLabel(photo)} ${photo.type === 'referentie' ? '' : (photo.floor || 'BG')}`.trim();
  $('photo-note').value = photo.note || '';
  $('note-modal').classList.add('open');
  renderGallery();
}

function closeNoteModal() {
  $('note-modal').classList.remove('open');
}

async function savePhotoNote() {
  const photo = state.photos.find(item => item.id === state.selectedGalleryPhotoId);
  if (!photo) return showToast('Foto niet gevonden');
  try {
    await updatePhoto(photo.id, { note: $('photo-note').value.trim() });
    closeNoteModal();
    renderGallery();
    showToast('Opmerking opgeslagen');
  } catch (err) {
    showToast(err.message);
  }
}
