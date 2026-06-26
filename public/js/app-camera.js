// Camera settings, phone camera, UNV live snapshots, and HTTP auth.
function restoreCameraSettings() {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (saved.ip) $('camera-ip').value = saved.ip;
  if (saved.user) $('camera-user').value = saved.user;
  if (saved.pass) $('camera-pass').value = saved.pass;
}

function saveCameraSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(getCameraSettings()));
}

function getCameraSettings() {
  return {
    ip: $('camera-ip').value.trim(),
    user: $('camera-user').value,
    pass: $('camera-pass').value
  };
}

function syncCameraModalFields() {
  if (!$('modal-camera-ip')) return;
  $('modal-camera-ip').value = $('camera-ip').value;
  $('modal-camera-user').value = $('camera-user').value;
  $('modal-camera-pass').value = $('camera-pass').value;
}

function openCameraModal() {
  syncCameraModalFields();
  $('camera-modal').classList.add('open');
}

function closeCameraModal() {
  $('camera-modal').classList.remove('open');
}

function saveCameraSettingsFromModal() {
  $('camera-ip').value = $('modal-camera-ip').value.trim();
  $('camera-user').value = $('modal-camera-user').value;
  $('camera-pass').value = $('modal-camera-pass').value;
  saveCameraSettings();
  closeCameraModal();
  if (state.mode === 'beeld') refreshUnvFrame(true);
}

function isNativeMobileApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function getCapacitorHttp() {
  return window.Capacitor?.Plugins?.CapacitorHttp || window.CapacitorHttp || null;
}

function md5Hex(value) {
  function add32(a, b) { return (a + b) & 0xffffffff; }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md5cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(x[0], a); x[1] = add32(x[1], b); x[2] = add32(x[2], c); x[3] = add32(x[3], d);
  }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    return md5blks;
  }
  const str = unescape(encodeURIComponent(value));
  let n = str.length;
  const stateMd5 = [1732584193, -271733879, -1732584194, 271733878];
  let i;
  for (i = 64; i <= n; i += 64) md5cycle(stateMd5, md5blk(str.substring(i - 64, i)));
  let tail = Array(16).fill(0);
  const rem = str.substring(i - 64);
  for (i = 0; i < rem.length; i += 1) tail[i >> 2] |= rem.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(stateMd5, tail);
    tail = Array(16).fill(0);
  }
  tail[14] = n * 8;
  md5cycle(stateMd5, tail);
  return stateMd5.map(num => {
    let out = '';
    for (let j = 0; j < 4; j += 1) out += ((num >> (j * 8)) & 255).toString(16).padStart(2, '0');
    return out;
  }).join('');
}

function parseDigestChallenge(header) {
  const challenge = String(header || '').replace(/^Digest\s+/i, '');
  const parts = {};
  challenge.replace(/(\w+)=("(?:[^"\\]|\\.)*"|[^,]*)/g, (_, key, rawValue) => {
    parts[key] = String(rawValue || '').replace(/^"|"$/g, '');
    return '';
  });
  return parts;
}

function randomHex(length = 16) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function buildDigestAuthHeader({ method, url, user, pass, challenge }) {
  const u = new URL(url);
  const uri = u.pathname + u.search;
  const realm = challenge.realm || '';
  const nonce = challenge.nonce || '';
  const qop = challenge.qop ? (challenge.qop.split(',').map(s => s.trim()).includes('auth') ? 'auth' : challenge.qop.split(',')[0].trim()) : null;
  const nc = '00000001';
  const cnonce = randomHex(16);
  const ha1 = await md5Hex(`${user}:${realm}:${pass}`);
  const ha2 = await md5Hex(`${method}:${uri}`);
  const response = qop
    ? await md5Hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : await md5Hex(`${ha1}:${nonce}:${ha2}`);
  const fields = [
    `username="${user}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`
  ];
  if (challenge.algorithm) fields.push(`algorithm=${challenge.algorithm}`);
  if (challenge.opaque) fields.push(`opaque="${challenge.opaque}"`);
  if (qop) fields.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return `Digest ${fields.join(', ')}`;
}

function setMode(mode) {
  state.mode = mode;
  $('btn-phone').classList.toggle('active', mode === 'locatie');
  $('btn-unv').classList.toggle('active', mode === 'beeld');
  updateWorkflowStatus();
  $('viewer-empty').style.display = 'none';

  if (mode === 'locatie') {
    stopUnvLive();
    $('unv-image').style.display = 'none';
    $('unv-canvas').style.display = 'none';
    clearCanvas($('unv-canvas'));
    $('phone-video').style.display = 'block';
    startPhoneCamera(true);
    $('live-badge').textContent = 'telefoon camera';
    return;
  }

  $('phone-video').style.display = 'none';
  $('unv-image').style.display = 'none';
  $('unv-canvas').style.display = 'block';
  startUnvLive();
}

async function startPhoneCamera(forceRestart = false) {
  if (state.phoneStream && !forceRestart && isPhoneStreamLive()) {
    $('phone-video').srcObject = state.phoneStream;
    $('viewer-empty').style.display = 'none';
    $('live-badge').textContent = 'telefoon camera actief';
    return;
  }
  stopPhoneCamera();
  try {
    state.phoneStream = await getBackCameraStream();
    $('phone-video').srcObject = state.phoneStream;
    $('viewer-empty').style.display = 'none';
    await loadPhoneDevices();
  } catch (err) {
    $('viewer-empty').style.display = 'grid';
    $('viewer-empty').innerHTML = `<strong>Locatiecamera niet beschikbaar</strong><span>${escapeHtml(err.message)}</span>`;
    $('live-badge').textContent = 'geen device camera';
  }
}

function isPhoneStreamLive() {
  const tracks = state.phoneStream?.getVideoTracks?.() || [];
  return tracks.some(track => track.readyState === 'live' && track.enabled !== false);
}

async function getBackCameraStream() {
  const knownBackDevice = await getPreferredBackDeviceId();
  const attempts = [];
  if (knownBackDevice) attempts.push({ video: { ...HIGH_QUALITY_VIDEO, deviceId: { exact: knownBackDevice } }, audio: false });
  attempts.push(
    { video: { ...HIGH_QUALITY_VIDEO, facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { ...HIGH_QUALITY_VIDEO }, audio: false },
    { video: true, audio: false }
  );

  let lastError = null;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return await preferBackCameraAfterPermission(stream);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Achtercamera niet beschikbaar');
}

async function preferBackCameraAfterPermission(stream) {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings?.() || {};
  const backDeviceId = await getPreferredBackDeviceId();
  const currentLooksFront = isFrontCameraLabel(track?.label);
  const currentLooksBack = isBackCameraDevice({ label: track?.label, deviceId: settings.deviceId });

  if (backDeviceId && settings.deviceId !== backDeviceId && !currentLooksBack) {
    try {
      const backStream = await navigator.mediaDevices.getUserMedia({
        video: { ...HIGH_QUALITY_VIDEO, deviceId: { exact: backDeviceId } },
        audio: false
      });
      stream.getTracks().forEach(item => item.stop());
      return rememberPhoneStream(backStream);
    } catch {
      if (currentLooksFront) {
        const fallback = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: backDeviceId } }, audio: false });
        stream.getTracks().forEach(item => item.stop());
        return rememberPhoneStream(fallback);
      }
    }
  }
  return rememberPhoneStream(stream);
}

function rememberPhoneStream(stream) {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings?.() || {};
  if (settings.deviceId) {
    state.phoneDeviceId = settings.deviceId;
    localStorage.setItem(PHONE_DEVICE_KEY, state.phoneDeviceId);
  }
  state.phoneFacing = 'environment';
  return stream;
}

async function getPreferredBackDeviceId() {
  if (!navigator.mediaDevices?.enumerateDevices) return '';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(device => device.kind === 'videoinput');
    const explicitBack = videos.find(isBackCameraDevice);
    return explicitBack?.deviceId || '';
  } catch {
    return '';
  }
}

function isBackCameraDevice(device) {
  const label = String(device?.label || '').toLowerCase();
  return /(back|rear|environment|achter|rug|facing back|back facing|camera2 0|camera 0)/.test(label) && !isFrontCameraLabel(label);
}

function isFrontCameraLabel(label) {
  return /(front|user|selfie|voor|facing front|front facing|camera 1)/.test(String(label || '').toLowerCase());
}

function stopPhoneCamera() {
  if (state.phoneStream) {
    state.phoneStream.getTracks().forEach(track => track.stop());
    state.phoneStream = null;
  }
  const video = $('phone-video');
  if (video) video.srcObject = null;
}

function switchPhoneCamera() {
  state.phoneFacing = 'environment';
  state.phoneDeviceId = '';
  if (state.mode === 'locatie') startPhoneCamera(true);
}

async function loadPhoneDevices() {
  const select = $('phone-device');
  if (!select || !navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(device => device.kind === 'videoinput');
    select.innerHTML = '';
    if (!videos.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Geen camera gevonden';
      select.appendChild(opt);
      $('live-badge').textContent = 'geen camera gevonden';
      return;
    }
    videos.forEach((device, index) => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.textContent = device.label || `Camera ${index + 1}`;
      select.appendChild(opt);
    });
    const current = videos.find(device => device.deviceId === state.phoneDeviceId);
    const explicitBack = videos.find(isBackCameraDevice);
    const preferred = explicitBack || current || videos[0];
    if (preferred) {
      state.phoneDeviceId = preferred.deviceId;
      select.value = state.phoneDeviceId;
      localStorage.setItem(PHONE_DEVICE_KEY, state.phoneDeviceId);
    }
  } catch (err) {
    select.innerHTML = '<option value="">Camera lijst niet beschikbaar</option>';
  }
}

function startUnvLive() {
  stopUnvLive(false);
  requestWakeLock();
  refreshUnvFrame(true);
  state.liveTimer = setInterval(() => refreshUnvFrame(false), UNV_LIVE_INTERVAL_MS);
}

function stopUnvLive(clear = true) {
  if (state.liveTimer) clearInterval(state.liveTimer);
  state.liveTimer = null;
  state.liveBusy = false;
  releaseWakeLock();
  if (clear) {
    $('unv-image').removeAttribute('src');
    clearCanvas($('unv-canvas'));
  }
}

function suspendCameraForBackground() {
  stopUnvLive(false);
  stopPhoneCamera();
  state.liveBusy = false;
  releaseWakeLock();
}

function recoverCameraAfterResume() {
  state.liveBusy = false;
  state.pendingMobileFileCapture = null;
  setCaptureBusy(false);
  if (state.mode === 'locatie') {
    $('unv-image').style.display = 'none';
    $('unv-canvas').style.display = 'none';
    $('phone-video').style.display = 'block';
    startPhoneCamera(true);
    return;
  }
  $('phone-video').style.display = 'none';
  startUnvLive();
}

async function requestWakeLock() {
  if (!navigator.wakeLock || state.wakeLock || document.visibilityState !== 'visible') return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener?.('release', () => {
      state.wakeLock = null;
    });
  } catch {}
}

async function releaseWakeLock() {
  const lock = state.wakeLock;
  state.wakeLock = null;
  try {
    await lock?.release?.();
  } catch {}
}

async function refreshUnvFrame(showErrors) {
  if (state.mode !== 'beeld' || state.liveBusy) return;
  state.liveBusy = true;
  saveCameraSettings();
  try {
    const blob = await fetchUnvSnapshot();
    if (state.mode !== 'beeld') return;
    await drawUnvFrame(blob);
    $('viewer-empty').style.display = 'none';
    $('live-badge').textContent = `UNV live ${new Date().toLocaleTimeString('nl-NL')}`;
  } catch (err) {
    $('live-badge').textContent = 'UNV fout';
    if (showErrors) showToast(err.message);
  } finally {
    state.liveBusy = false;
  }
}

async function drawUnvFrame(blob) {
  if (state.mode !== 'beeld') return;
  const canvas = $('unv-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  $('unv-image').style.display = 'none';
  await drawBlobToCanvas(blob, canvas);
  state.unvPaintFlip = !state.unvPaintFlip;
  canvas.style.transform = state.unvPaintFlip ? 'translateZ(0) scale(1.0001)' : 'translateZ(0) scale(1)';
  canvas.dataset.frame = String(Date.now());
  void canvas.offsetHeight;
}

async function fetchUnvSnapshot() {
  const camera = getCameraSettings();
  if (!camera.ip) throw new Error('Camera IP ontbreekt');
  let lastError = 'Geen snapshot endpoint werkte';
  for (const snapshotPath of await getSnapshotPaths(camera)) {
    const path = snapshotPath;
    const url = `http://${camera.ip}${path}`;
    try {
      const blob = isNativeMobileApp() && getCapacitorHttp()
        ? await fetchUnvSnapshotNative(camera, path)
        : await fetchUnvSnapshotBrowser(camera, url);
      if (blob.size > 0) return await rotateImageBlob(blob, 180);
      lastError = `${snapshotPath} gaf 0 bytes terug`;
    } catch (err) {
      lastError = `${snapshotPath}: ${err.message || err}`;
    }
  }
  throw new Error(lastError);
}

async function getSnapshotPaths(camera, force = false) {
  const cacheKey = `${camera.ip}|${camera.user}`;
  if (!force && state.snapshotPathCacheKey === cacheKey && state.snapshotPaths.length) return state.snapshotPaths;
  const dynamicPaths = [];
  try {
    const profileText = await fetchSunapiText(camera, VIDEO_PROFILE_PATHS[0]);
    parseMjpegVideoProfiles(profileText).forEach(({ channel, profile }) => {
      dynamicPaths.push(`/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Channel=${channel}&Profile=${profile}`);
      dynamicPaths.push(`/stw-cgi/video.cgi?msubmenu=snapshot&action=view&Profile=${profile}&Channel=${channel}`);
    });
  } catch {}
  state.snapshotPaths = [...new Set([...dynamicPaths, ...SNAPSHOT_PATHS])];
  state.snapshotPathCacheKey = cacheKey;
  return state.snapshotPaths;
}

function parseMjpegVideoProfiles(text) {
  const profiles = [];
  const seen = new Set();
  String(text || '').replace(/Channel\.(\d+)\.Profile\.(\d+)\.EncodingType=([^\s]+)/g, (_, channel, profile, encoding) => {
    if (String(encoding).toUpperCase() !== 'MJPEG') return '';
    const key = `${channel}/${profile}`;
    if (!seen.has(key)) {
      seen.add(key);
      profiles.push({ channel: Number(channel), profile: Number(profile) });
    }
    return '';
  });
  return profiles;
}

async function fetchSunapiText(camera, path) {
  if (isNativeMobileApp() && getCapacitorHttp()) {
    const response = await nativeCameraRequest(camera, path);
    if (response.status < 200 || response.status >= 300) throw new Error(`Camera HTTP ${response.status}`);
    return responseText(response);
  }
  const response = await fetch(`http://${camera.ip}${path}`, { headers: { ...CAMERA_NO_CACHE_HEADERS }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Camera HTTP ${response.status}`);
  return await response.text();
}

async function fetchUnvSnapshotBrowser(camera, url) {
  const headers = { ...CAMERA_NO_CACHE_HEADERS };
  if (camera.user || camera.pass) {
    headers.Authorization = `Basic ${btoa(`${camera.user || ''}:${camera.pass || ''}`)}`;
  }
  let response = await fetch(url, { headers, cache: 'no-store' });
  const challengeHeader = response.headers.get('www-authenticate');
  if (response.status === 401 && challengeHeader && /^Digest/i.test(challengeHeader) && (camera.user || camera.pass)) {
    const auth = await buildDigestAuthHeader({
      method: 'GET',
      url,
      user: camera.user || '',
      pass: camera.pass || '',
      challenge: parseDigestChallenge(challengeHeader)
    });
    response = await fetch(url, { headers: { ...CAMERA_NO_CACHE_HEADERS, Authorization: auth }, cache: 'no-store' });
  }
  if (!response.ok) throw new Error(`Camera HTTP ${response.status}`);
  return await validateSnapshotBlob(await response.blob(), response.headers.get('content-type') || '');
}

async function fetchUnvSnapshotNative(camera, path) {
  const response = await nativeCameraRequest(camera, path);
  if (response.status >= 200 && response.status < 300) {
    return await validateSnapshotBlob(capacitorResponseToBlob(response), responseContentType(response), response);
  }
  throw new Error(`Camera HTTP ${response.status} ${getHeaderValue(response.headers, 'content-type') || ''}`.trim());
}

function getHeaderValue(headers, name) {
  if (!headers) return '';
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find(k => k.toLowerCase() === lower);
  return key ? headers[key] : '';
}

async function nativeCameraRequest(camera, path) {
  const http = getCapacitorHttp();
  const url = `http://${camera.ip}${path}`;
  const baseOptions = {
    url,
    headers: { ...CAMERA_NO_CACHE_HEADERS },
    responseType: 'arraybuffer',
    connectTimeout: 7000,
    readTimeout: 7000
  };

  let response;
  try {
    response = await http.get(baseOptions);
  } catch (err) {
    throw new Error(err.message || String(err));
  }

  const challengeHeader = response.headers?.['www-authenticate'] || response.headers?.['WWW-Authenticate'];
  if (response.status === 401 && challengeHeader && /^Digest/i.test(challengeHeader) && (camera.user || camera.pass)) {
    const auth = await buildDigestAuthHeader({
      method: 'GET',
      url,
      user: camera.user || '',
      pass: camera.pass || '',
      challenge: parseDigestChallenge(challengeHeader)
    });
    response = await http.get({
      ...baseOptions,
      headers: { ...CAMERA_NO_CACHE_HEADERS, Authorization: auth }
    });
  }
  return response;
}

function responseContentType(response) {
  return getHeaderValue(response?.headers, 'content-type') || '';
}

function capacitorResponseToBlob(response) {
  const contentType = responseContentType(response) || 'application/octet-stream';
  const data = response.data;
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data], { type: contentType });
  if (ArrayBuffer.isView(data)) return new Blob([data.buffer], { type: contentType });
  if (typeof data === 'string') {
    const bytes = stringResponseToBytes(data);
    return new Blob([bytes], { type: contentType });
  }
  throw new Error('Camera gaf geen bruikbaar beeld terug');
}

async function validateSnapshotBlob(blob, contentType = '', response = null) {
  const normalizedType = String(contentType || blob?.type || '').toLowerCase();
  if (/^image\//.test(normalizedType)) return blob;
  if (await blobHasImageSignature(blob)) return blob;
  const preview = response ? responsePreview(response) : await blobTextPreview(blob);
  const details = preview ? `: ${preview}` : '';
  throw new Error(`Camera gaf geen afbeelding terug (${contentType || 'geen content-type'})${details}`);
}

async function blobHasImageSignature(blob) {
  if (!blob || !blob.slice) return false;
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return hasImageSignature(bytes);
}

function hasImageSignature(bytes) {
  if (!bytes || bytes.length < 4) return false;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const gif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  const webp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return jpg || png || gif || webp;
}

async function blobTextPreview(blob, maxLength = 180) {
  try {
    return compactPreview((await blob.slice(0, maxLength).text()).slice(0, maxLength));
  } catch {
    return '';
  }
}

function responsePreview(response, maxLength = 180) {
  return compactPreview(responseText(response).slice(0, maxLength));
}

function responseText(response) {
  const data = response?.data;
  if (data == null) return '';
  if (typeof data === 'string') return decodeMaybeBase64Text(data);
  const bytes = responseBytes(data);
  if (!bytes.length || hasImageSignature(bytes)) return '';
  try {
    return decodeMaybeBase64Text(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return '';
  }
}

async function createMjpegSnapshotProfile() {
  const camera = getCameraSettings();
  if (!camera.ip) return showToast('Camera IP ontbreekt');
  const proceed = !window.confirm || window.confirm('Er wordt een MJPEG profiel op de camera aangemaakt voor snapshots. Doorgaan?');
  if (!proceed) return;
  const profileName = `GeoSnapSnapshot${Date.now().toString().slice(-5)}`;
  const path = `/stw-cgi/media.cgi?msubmenu=videoprofile&action=add&Channel=0&Name=${encodeURIComponent(profileName)}&EncodingType=MJPEG`;
  $('diagnose-output').textContent = `MJPEG profiel aanmaken...\n${path}`;
  try {
    const responseTextValue = await fetchSunapiText(camera, path);
    state.snapshotPaths = [];
    state.snapshotPathCacheKey = '';
    $('diagnose-output').textContent = `MJPEG profiel response:\n${responseTextValue}\n\nDraai Diagnose opnieuw of klik Test beeld.`;
    showToast('MJPEG snapshot-profiel aangemaakt');
    if (state.mode === 'beeld') refreshUnvFrame(true);
  } catch (err) {
    $('diagnose-output').textContent = `MJPEG profiel aanmaken mislukt:\n${err.message || err}`;
    showToast('MJPEG profiel aanmaken mislukt');
  }
}

function responseBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === 'string') return stringResponseToBytes(data);
  return new Uint8Array();
}

function compactPreview(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeMaybeBase64Text(value) {
  const text = String(value || '').trim();
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 12 || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return text;
  try {
    const binary = atob(compact);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return /[\x20-\x7E]/.test(decoded) ? decoded : text;
  } catch {
    return text;
  }
}

function stringResponseToBytes(data) {
  const trimmed = data.trim();
  if (/^data:/i.test(trimmed)) {
    return stringResponseToBytes(trimmed.slice(trimmed.indexOf(',') + 1));
  }
  try {
    const binary = atob(trimmed);
    if (binary.length && (binary.charCodeAt(0) === 0xff || binary.charCodeAt(0) === 0x89)) {
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
  } catch {}
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) bytes[i] = data.charCodeAt(i) & 0xff;
  return bytes;
}

function responseByteLength(response) {
  const data = response?.data;
  if (data == null) return 0;
  if (data instanceof Blob) return data.size;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  if (typeof data === 'string') return data.length;
  return JSON.stringify(data).length;
}
