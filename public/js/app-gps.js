// GPS lifecycle and map preloading trigger.
function startGps() {
  if (!navigator.geolocation) {
    $('gps-status').textContent = 'GPS niet beschikbaar';
    return;
  }
  navigator.geolocation.getCurrentPosition(handleGpsPosition, () => {}, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 20000
  });
  navigator.geolocation.watchPosition(handleGpsPosition, () => {
    $('gps-status').textContent = 'GPS wacht op toestemming';
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}

function handleGpsPosition(pos) {
  state.gps = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy
  };
  $('gps-status').textContent = `GPS +/-${Math.round(pos.coords.accuracy)}m`;
  $('gps-lat').textContent = pos.coords.latitude.toFixed(6);
  $('gps-lng').textContent = pos.coords.longitude.toFixed(6);
  $('gps-acc').textContent = `${Math.round(pos.coords.accuracy)}m`;
  centerMapOnGps(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
  preloadMapTilesForGps(pos.coords.latitude, pos.coords.longitude).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  const gpsStatus = document.getElementById('gps-status');
  if (gpsStatus) {
    gpsStatus.style.cursor = 'pointer';
    gpsStatus.title = 'Klik om GPS handmatig te starten of toestemming te vragen';
    gpsStatus.addEventListener('click', () => {
      gpsStatus.textContent = 'GPS opstarten...';
      startGps();
    });
  }
});
