// IndexedDB storage adapter and local API facade.
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('session_id', 'session_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('tiles')) db.createObjectStore('tiles', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function idbStore(name, mode = 'readonly') {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localGetAll(storeName) {
  return idbRequest((await idbStore(storeName)).getAll());
}

async function localPut(storeName, value) {
  return idbRequest((await idbStore(storeName, 'readwrite')).put(value));
}

async function localGet(storeName, id) {
  return idbRequest((await idbStore(storeName)).get(id));
}

async function localDelete(storeName, id) {
  return idbRequest((await idbStore(storeName, 'readwrite')).delete(id));
}

function attachPhotoUrl(photo) {
  if (!photo || !photo.blob) return photo;
  return { ...photo, filename: URL.createObjectURL(photo.blob) };
}

const localApi = {
  async health() {
    await openDb();
    return { success: true, mode: 'mobile-local' };
  },
  async createSession(input) {
    const now = new Date().toISOString();
    const session = {
      id: uuid(),
      name: input.name || `Schouw ${new Date().toLocaleDateString('nl-NL')}`,
      location: input.location || '',
      surveyor: input.surveyor || '',
      created_at: now,
      updated_at: now
    };
    await localPut('sessions', session);
    return { success: true, data: session };
  },
  async listSessions() {
    const sessions = await localGetAll('sessions');
    sessions.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    return { success: true, data: sessions };
  },
  async getSession(id) {
    const session = await localGet('sessions', id);
    if (!session) return { success: false, error: 'Sessie niet gevonden' };
    const photos = (await localGetAll('photos'))
      .filter(photo => photo.session_id === id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(attachPhotoUrl);
    return { success: true, data: { ...session, photos } };
  },
  async addPhoto(sessionId, blob, meta) {
    const session = await localGet('sessions', sessionId);
    if (!session) return { success: false, error: 'Sessie niet gevonden' };
    const now = new Date().toISOString();
    const photo = {
      id: uuid(),
      session_id: sessionId,
      type: meta.type || 'locatie',
      camera_number: Number(meta.camera_number || 1),
      floor: meta.floor || 'BG',
      filename: '',
      blob,
      latitude: meta.latitude != null ? Number(meta.latitude) : null,
      longitude: meta.longitude != null ? Number(meta.longitude) : null,
      accuracy: meta.accuracy != null && meta.accuracy !== '' ? Number(meta.accuracy) : null,
      heading: meta.heading != null ? Number(meta.heading) : 0,
      fov: meta.fov != null ? Number(meta.fov) : 90,
      range: meta.range != null ? Number(meta.range) : 20,
      source: meta.source || '',
      note: meta.note || '',
      reference_number: meta.reference_number != null ? Number(meta.reference_number) : null,
      reference_text: meta.reference_text || '',
      special_kind: meta.special_kind || '',
      special_answer: meta.special_answer || '',
      created_at: now
    };
    session.updated_at = now;
    await localPut('photos', photo);
    await localPut('sessions', session);
    return { success: true, data: attachPhotoUrl(photo) };
  },
  async updatePhoto(photoId, patch) {
    const photo = await localGet('photos', photoId);
    if (!photo) return { success: false, error: 'Foto niet gevonden' };
    ['latitude', 'longitude', 'accuracy', 'heading', 'fov', 'range', 'floor', 'camera_number', 'reference_number', 'note', 'reference_text', 'source', 'special_kind', 'special_answer'].forEach(key => {
      if (patch[key] !== undefined) photo[key] = ['floor', 'note', 'reference_text', 'source', 'special_kind', 'special_answer'].includes(key) ? patch[key] : Number(patch[key]);
    });
    if (patch.blob !== undefined) photo.blob = patch.blob;
    if (patch.type !== undefined) photo.type = patch.type;
    photo.updated_at = new Date().toISOString();
    await localPut('photos', photo);
    return { success: true, data: attachPhotoUrl(photo) };
  },
  async deletePhoto(photoId) {
    const photo = await localGet('photos', photoId);
    if (!photo) return { success: false, error: 'Foto niet gevonden' };
    const session = await localGet('sessions', photo.session_id);
    if (session) {
      session.updated_at = new Date().toISOString();
      await localPut('sessions', session);
    }
    await localDelete('photos', photoId);
    return { success: true };
  }
};
