// Browser bootstrap and UI event wiring.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function bindUI() {
  $('btn-phone').addEventListener('click', () => setMode('locatie'));
  $('btn-unv').addEventListener('click', () => setMode('beeld'));
  $('btn-refresh').addEventListener('click', () => refreshUnvFrame(true));
  $('btn-reference-photo').addEventListener('click', startReferenceCapture);
  $('btn-central-equipment').addEventListener('click', () => startSpecialReferenceCapture('central'));
  $('btn-reload-devices').addEventListener('click', loadPhoneDevices);
  $('phone-device').addEventListener('change', () => {
    state.phoneDeviceId = $('phone-device').value;
    localStorage.setItem(PHONE_DEVICE_KEY, state.phoneDeviceId);
    if (state.mode === 'locatie') startPhoneCamera(true);
  });
  $('btn-capture').addEventListener('click', captureCurrent);
  $('mobile-photo-input').addEventListener('change', handleMobilePhotoInput);
  $('gallery').addEventListener('click', handleGalleryClick);
  $('btn-session').addEventListener('click', createSession);
  $('btn-save-camera-modal').addEventListener('click', saveCameraSettingsFromModal);
  $('btn-close-camera-modal').addEventListener('click', closeCameraModal);
  $('btn-create-session-modal').addEventListener('click', createSessionFromModal);
  $('btn-close-session-modal').addEventListener('click', closeSessionModal);
  $('btn-save-note').addEventListener('click', savePhotoNote);
  $('btn-close-note-modal').addEventListener('click', closeNoteModal);
  $('btn-close-photo-viewer').addEventListener('click', closePhotoViewer);
  $('btn-workflow-continue').addEventListener('click', continueWorkflowToNextCamera);
  $('btn-workflow-retake-beeld').addEventListener('click', () => continueWorkflowWithRetake('beeld'));
  $('btn-workflow-retake-locatie').addEventListener('click', () => continueWorkflowWithRetake('locatie'));
  $('btn-missing-image-make').addEventListener('click', continueMissingImageWithPhoto);
  $('btn-missing-image-continue').addEventListener('click', continueMissingImageToNextCamera);
  $('btn-refresh-sessions').addEventListener('click', loadSessions);
  $('btn-show-quote').addEventListener('click', openQuoteModal);
  $('btn-close-quote-modal').addEventListener('click', closeQuoteModal);
  $('btn-export-session').addEventListener('click', openExportModal);
  $('btn-export-session-bottom').addEventListener('click', openExportModal);
  $('btn-close-export-modal').addEventListener('click', closeExportModal);
  $('btn-start-export').addEventListener('click', exportSessionFromModal);
  $('export-marker-size').addEventListener('input', updateExportMarkerSizeLabel);
  $('btn-refresh-map').addEventListener('click', renderMap);
  $('btn-parking-photo').addEventListener('click', () => startSpecialReferenceCapture('parking'));
  $('btn-close-cone-overlay').addEventListener('click', closeConeOverlay);
  $('btn-save-cone').addEventListener('click', saveSelectedCone);
  ['heading-slider', 'fov-slider', 'range-slider'].forEach(id => {
    $(id).addEventListener('input', updateSelectedConeFromControls);
  });
  $('btn-menu').addEventListener('click', openDrawer);
  $('btn-close-menu').addEventListener('click', closeDrawer);
  $('drawer-backdrop').addEventListener('click', closeDrawer);
  $('btn-test').addEventListener('click', () => refreshUnvFrame(true));
  $('btn-diagnose').addEventListener('click', diagnoseCamera);
  $('btn-save-special-question').addEventListener('click', saveSpecialQuestion);
  $('btn-skip-special-question').addEventListener('click', skipSpecialQuestion);
  ['camera-ip', 'camera-user', 'camera-pass'].forEach(id => {
    $(id).addEventListener('change', saveCameraSettings);
  });
  $('camera-number').addEventListener('input', updateWorkflowStatus);
  $('floor').addEventListener('input', updateWorkflowStatus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.Capacitor?.Plugins?.App?.addListener?.('appStateChange', ({ isActive }) => {
    if (isActive) recoverCameraAfterResume();
    else suspendCameraForBackground();
  });
}

async function checkServer() {
  try {
    const data = await localApi.health();
    $('server-status').textContent = data.success ? 'Mobiel lokaal' : 'Opslag fout';
  } catch {
    $('server-status').textContent = 'Lokale opslag fout';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  bindUI();
  $('app-version').textContent = `v${APP_VERSION}`;
  restoreCameraSettings();
  syncCameraModalFields();
  await checkServer();
  await loadPhoneDevices();
  await loadSessions();
  startGps();
  if (typeof initQuote === 'function') initQuote();
  setMode('beeld');
  openCameraModal();
});

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    recoverCameraAfterResume();
    return;
  }
  suspendCameraForBackground();
}
