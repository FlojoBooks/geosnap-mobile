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
  $('btn-switch-equipment').addEventListener('click', () => {
    const qty = state.session?.quote_config?.subswitch_qty || 1;
    if (qty <= 1) {
      startSpecialReferenceCapture('switch_1');
    } else {
      const choice = prompt('Welke switch wil je vastleggen? (1 of 2)', '1');
      if (choice === '1' || choice === '2') {
        startSpecialReferenceCapture('switch_' + choice);
      } else {
        if (choice !== null) showToast('Ongeldige keuze, kies 1 of 2');
      }
    }
  });
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
  $('btn-download-startup-map').addEventListener('click', downloadStartupMapTiles);
  $('btn-skip-startup-map').addEventListener('click', () => {
    closeStartupMapModal();
    openCameraModal();
  });
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
  $('btn-configure-quote').addEventListener('click', openConfigureModal);
  $('btn-open-configure').addEventListener('click', openConfigureModal);
  $('btn-close-configure-modal').addEventListener('click', closeConfigureModal);
  $('btn-save-configure').addEventListener('click', saveConfigureSettings);
  $('btn-download-excel-csv').addEventListener('click', downloadExcelCsv);
  $('btn-trigger-import-csv').addEventListener('click', () => {
    $('csv-file-input').click();
  });
  $('csv-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importExcelCsv(file);
      e.target.value = '';
    }
  });
  $('tab-btn-excel').addEventListener('click', () => setQuoteTab('excel'));
  $('cfg-std-cams').addEventListener('input', () => syncConfigureCameraCounts('std'));
  $('cfg-lift-cams').addEventListener('input', () => syncConfigureCameraCounts('lift'));
  $('cfg-subswitch-qty').addEventListener('input', updateConfigureModalVisibility);
  document.querySelectorAll('input[name="cfg-subswitch-needed"]').forEach(input => {
    input.addEventListener('change', updateConfigureModalVisibility);
  });
  $('btn-export-session').addEventListener('click', openExportModal);
  $('btn-export-session-bottom').addEventListener('click', openExportModal);
  $('btn-close-export-modal').addEventListener('click', closeExportModal);
  $('btn-start-export').addEventListener('click', exportSessionFromModal);
  $('export-marker-size').addEventListener('input', updateExportMarkerSizeLabel);
  $('btn-refresh-map').addEventListener('click', renderMap);
  $('map-floor-select')?.addEventListener('change', (e) => {
    state.mapFloorFilter = e.target.value;
    renderMap();
  });
  $('btn-download-map')?.addEventListener('click', downloadVisibleTiles);
  $('btn-parking-photo').addEventListener('click', () => startSpecialReferenceCapture('parking'));
  $('btn-close-cone-overlay').addEventListener('click', closeConeOverlay);
  $('btn-save-cone').addEventListener('click', saveSelectedCone);
  ['heading-slider', 'fov-slider', 'range-slider'].forEach(id => {
    $(id).addEventListener('input', updateSelectedConeFromControls);
  });
  document.querySelectorAll('.btn-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const sliderId = btn.getAttribute('data-slider');
      const step = Number(btn.getAttribute('data-step'));
      const slider = $(sliderId);
      if (slider) {
        let val = Number(slider.value) + step;
        const min = Number(slider.min || 0);
        const max = Number(slider.max || 100);
        if (val < min) val = min;
        if (val > max) val = max;
        slider.value = val;
        slider.dispatchEvent(new Event('input'));
      }
    });
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
  $('floor').addEventListener('change', updateWorkflowStatus);
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
  if (typeof initClients === 'function') initClients();
  setMode('beeld');
  openStartupMapModal();
});

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    recoverCameraAfterResume();
    return;
  }
  suspendCameraForBackground();
}
