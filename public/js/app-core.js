// Core runtime state, constants, and small UI helpers.
const state = {
  session: null,
  mode: 'locatie',
  phoneFacing: 'environment',
  phoneDeviceId: '',
  phoneStream: null,
  gps: { latitude: null, longitude: null, accuracy: null },
  liveTimer: null,
  liveBusy: false,
  unvObjectUrl: null,
  photos: [],
  map: null,
  mapItems: [],
  gpsItems: [],
  selectedPhotoId: null,
  selectedGalleryPhotoId: null,
  pendingConePhotoId: null,
  coneOverlayOpen: false,
  pendingMobileFileCapture: null,
  captureBusy: false,
  workflowModalOpen: false,
  workflowGate: null,
  missingImageModalOpen: false,
  missingImageGate: null,
  retakeResume: null,
  retakePhotoId: null,
  referenceCaptureActive: false,
  specialCaptureKind: '',
  pendingSpecialQuestionPhotoId: null,
  pendingParkingPhotoId: null,
  pendingCentralPhotoId: null,
  referencePreviousMode: 'beeld',
  mapPreloadKey: '',
  mapPreloadBusy: false,
  mapCenteredOnGps: false,
  exportMarkerSize: 18,
  unvPaintFlip: false,
  snapshotPaths: [],
  snapshotPathCacheKey: '',
  wakeLock: null,
  quoteModalOpen: false
};

const PRICING_KEY = 'alphatron-geosnap-mobile-pricing';
const DEFAULT_PRICING = {
  "Hostalliet": 4.50,
  "P25": 6.00,
  "Stalen buis": 12.50
};

function getCablePricing() {
  const saved = localStorage.getItem(PRICING_KEY);
  if (!saved) return { ...DEFAULT_PRICING };
  try {
    return JSON.parse(saved);
  } catch {
    return { ...DEFAULT_PRICING };
  }
}

function saveCablePricing(pricing) {
  localStorage.setItem(PRICING_KEY, JSON.stringify(pricing));
}

function getCableTypes() {
  return Object.keys(getCablePricing());
}

const $ = (id) => document.getElementById(id);
const DB_NAME = 'alphatron-geosnap-mobile';
const DB_VERSION = 2;
const APP_VERSION = '0.2.15';
const UNV_LIVE_INTERVAL_MS = 500;
const CAMERA_NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache'
};
const TILE_SIZE = 256;
const TILE_ZOOM = 19;
const TILE_PRELOAD_RADIUS = 2;
const TILE_URL_TEMPLATE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const HIGH_QUALITY_VIDEO = {
  width: { ideal: 1920 },
  height: { ideal: 1080 }
};
const SNAPSHOT_PATHS = [
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=0',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=1',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=2',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=3',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=4',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=5',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=1&Channel=0',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=1&Channel=1',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=1&Channel=2',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=1&Channel=3',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=2&Channel=0',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=2&Channel=1',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=2&Channel=2',
  '/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=2&Channel=3',
  '/images/snapshot.jpg',
  '/cgi-bin/snapshot.cgi'
];
const SNAPSHOT_PATH = SNAPSHOT_PATHS[0];
const VIDEO_PROFILE_PATHS = [
  '/stw-cgi/media.cgi?msubmenu=videoprofile&action=view',
  '/stw-cgi/media.cgi?msubmenu=videoprofile&action=view&Channel=0',
  '/stw-cgi/media.cgi?msubmenu=videoprofile&action=view&Channel=1',
  '/stw-cgi/media.cgi?msubmenu=videoprofile&action=view&Channel=2',
  '/stw-cgi/media.cgi?msubmenu=videoprofile&action=view&Channel=3'
];
const SETTINGS_KEY = 'alphatron-geosnap-mobile-camera';
const PHONE_DEVICE_KEY = 'alphatron-geosnap-mobile-phone-device';
let dbPromise = null;

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function setCaptureBusy(isBusy, title = 'Foto wordt gemaakt...') {
  state.captureBusy = isBusy;
  const status = $('capture-status');
  const titleEl = $('capture-status-title');
  const textEl = $('capture-status-text');
  const viewer = $('viewer');
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = isBusy ? 'Niet nog een keer drukken' : '';
  status?.classList.toggle('show', isBusy);
  viewer?.classList.toggle('capturing', isBusy);
  $('btn-capture')?.classList.toggle('busy', isBusy);
  syncCaptureLocks();
}

function syncCaptureLocks() {
  const locked = state.captureBusy || state.workflowModalOpen || state.missingImageModalOpen;
  const button = $('btn-capture');
  const refreshButton = $('btn-refresh');
  const referenceButton = $('btn-reference-photo');
  const centralButton = $('btn-central-equipment');
  const parkingButton = $('btn-parking-photo');
  if (button) button.disabled = locked;
  if (refreshButton) refreshButton.disabled = locked;
  if (referenceButton) referenceButton.disabled = locked;
  if (centralButton) centralButton.disabled = locked;
  if (parkingButton) parkingButton.disabled = locked;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}
