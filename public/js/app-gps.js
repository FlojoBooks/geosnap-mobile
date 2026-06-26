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
