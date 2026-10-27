// Quote generation and cable rates management logic.
const CLIENT_NAME_KEY = 'alphatron-geosnap-mobile-quote-client';

function initQuote() {
  // Bind tab buttons
  $('tab-btn-quote').addEventListener('click', () => setQuoteTab('quote'));
  $('tab-btn-rates').addEventListener('click', () => setQuoteTab('rates'));
  
  // Bind other actions
  $('btn-add-rate').addEventListener('click', addCustomRate);
  $('btn-print-quote').addEventListener('click', () => window.print());
  $('quote-client-name').addEventListener('input', saveQuoteClientName);
  
  // Load saved client name
  $('quote-client-name').value = localStorage.getItem(CLIENT_NAME_KEY) || '';
  
  // Populate dropdown lists initially
  populateCableSelects();
}

function setQuoteTab(tab) {
  // Reset all tabs
  $('tab-btn-quote').classList.remove('active');
  $('tab-btn-excel').classList.remove('active');
  $('tab-btn-rates').classList.remove('active');
  $('tab-content-quote').style.display = 'none';
  $('tab-content-excel').style.display = 'none';
  $('tab-content-rates').style.display = 'none';
  
  if (tab === 'quote') {
    $('tab-btn-quote').classList.add('active');
    $('tab-content-quote').style.display = 'flex';
    renderQuoteTable();
  } else if (tab === 'excel') {
    $('tab-btn-excel').classList.add('active');
    $('tab-content-excel').style.display = 'flex';
    renderExcelTable();
  } else {
    $('tab-btn-rates').classList.add('active');
    $('tab-content-rates').style.display = 'flex';
    renderRatesList();
  }
}

function populateCableSelects() {
  const types = getCableTypes();
  const wfSelect = $('wf-cable-type');
  const noteSelect = $('note-cable-type');
  
  const optionsHtml = types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  
  if (wfSelect) wfSelect.innerHTML = optionsHtml;
  if (noteSelect) noteSelect.innerHTML = optionsHtml;
}

function populateConnectedToSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  
  const optRec = document.createElement('option');
  optRec.value = 'recorder';
  optRec.textContent = 'Recorder';
  selectEl.appendChild(optRec);
  
  const config = state.session?.quote_config || {};
  if (config.subswitch_needed === 'ja' && config.switches && config.switches.length) {
    config.switches.forEach((sw, index) => {
      const optSw = document.createElement('option');
      optSw.value = `switch_${index + 1}`;
      optSw.textContent = `Switch ${index + 1} (${sw.ports} poorts)`;
      selectEl.appendChild(optSw);
    });
  }
}

function saveQuoteClientName() {
  localStorage.setItem(CLIENT_NAME_KEY, $('quote-client-name').value.trim());
}

function openQuoteModal() {
  if (!state.session) {
    openSessionModal();
    return showToast('Start eerst een sessie');
  }
  
  state.quoteModalOpen = true;
  populateCableSelects();
  setQuoteTab('quote');
  
  const clientNameInput = $('quote-client-name');
  if (state.session.client_id) {
    const clients = getClients();
    const client = clients.find(c => c.id === state.session.client_id);
    if (client) {
      clientNameInput.value = client.name;
    } else {
      clientNameInput.value = localStorage.getItem(CLIENT_NAME_KEY) || '';
    }
  } else {
    clientNameInput.value = localStorage.getItem(CLIENT_NAME_KEY) || '';
  }
  
  $('quote-modal').classList.add('open');
  document.body.classList.add('modal-open');
}

function closeQuoteModal() {
  state.quoteModalOpen = false;
  $('quote-modal').classList.remove('open');
  document.body.classList.remove('modal-open');
}

function renderRatesList() {
  const listEl = $('rates-list');
  if (!listEl) return;
  
  const pricing = getCablePricing();
  const keys = Object.keys(pricing);
  
  if (!keys.length) {
    listEl.innerHTML = '<p class="muted">Geen montagetypes geconfigureerd.</p>';
    return;
  }
  
  listEl.innerHTML = keys.map(name => `
    <div class="rate-item-row">
      <span><strong>${escapeHtml(name)}</strong></span>
      <span>€ ${pricing[name].toFixed(2)} per meter</span>
      <button class="secondary danger" type="button" onclick="deleteRate('${escapeHtml(name)}')">Verwijderen</button>
    </div>
  `).join('');
}

function addCustomRate() {
  const nameInput = $('new-rate-name');
  const priceInput = $('new-rate-price');
  
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  
  if (!name) return showToast('Vul een naam in');
  if (isNaN(price) || price < 0) return showToast('Vul een geldige prijs in');
  
  const pricing = getCablePricing();
  pricing[name] = price;
  saveCablePricing(pricing);
  
  nameInput.value = '';
  priceInput.value = '';
  
  populateCableSelects();
  renderRatesList();
  showToast('Montagetype toegevoegd');
}

function deleteRate(name) {
  const pricing = getCablePricing();
  if (pricing[name] !== undefined) {
    delete pricing[name];
    saveCablePricing(pricing);
    populateCableSelects();
    renderRatesList();
    showToast('Montagetype verwijderd');
  }
}

function renderQuoteTable() {
  const tableBody = $('quote-table-body');
  const totalPriceEl = $('quote-total-price');
  if (!tableBody || !totalPriceEl) return;
  
  // Collect all unique camera numbers in the session
  const camNumbers = Array.from(
    new Set(
      state.photos
        .filter(p => p.type === 'beeld' || p.type === 'locatie')
        .map(p => Number(p.camera_number || 1))
    )
  ).sort((a, b) => a - b);
  
  if (!camNumbers.length) {
    tableBody.innerHTML = '<tr><td colspan="3" class="muted" style="text-align: center; padding: 20px;">Geen camera\'s met foto\'s gevonden in deze sessie.</td></tr>';
    return;
  }
  
  tableBody.innerHTML = camNumbers.map(camNum => {
    const photos = state.photos.filter(p => Number(p.camera_number) === camNum);
    const mainPhoto = photos.find(p => p.type === 'beeld') || photos.find(p => p.type === 'locatie');
    
    const cableType = mainPhoto ? (mainPhoto.cable_type || '') : '';
    const cableLength = mainPhoto ? (mainPhoto.cable_length || 0) : 0;
    
    return `
      <tr>
        <td style="padding: 8px 4px;">CAM-${String(camNum).padStart(3, '0')}</td>
        <td style="padding: 8px 4px;">${escapeHtml(cableType || 'Geen kabel opgegeven')}</td>
        <td style="padding: 8px 4px; text-align: right;">${cableLength} m</td>
      </tr>
    `;
  }).join('');
}

function openConfigureModal() {
  if (!state.session) return showToast('Start of open eerst een sessie');
  
  // Collect all camera numbers in the session
  const camNumbers = Array.from(
    new Set(
      state.photos
        .filter(p => p.type === 'beeld' || p.type === 'locatie')
        .map(p => Number(p.camera_number || 1))
    )
  ).sort((a, b) => a - b);
  
  const totalCams = camNumbers.length;
  $('cfg-total-cams').textContent = totalCams;
  
  // Load saved config or use defaults
  const config = state.session.quote_config || {};
  
  setRadioValue('cfg-new-install', config.new_install || 'ja');
  $('cfg-std-cams').value = config.std_cams !== undefined ? config.std_cams : totalCams;
  $('cfg-lift-cams').value = config.lift_cams !== undefined ? config.lift_cams : 0;
  $('cfg-wall-brackets').value = config.wall_brackets || 0;
  $('cfg-coax-converters').value = config.coax_converters || 0;
  $('cfg-server-channels').value = config.server_channels || 'geen';
  setRadioValue('cfg-subswitch-needed', config.subswitch_needed || 'nee');
  $('cfg-subswitch-qty').value = config.subswitch_qty || 1;
  $('cfg-cabinet-type').value = config.cabinet_type || 'geen';
  
  // Update view toggles
  updateConfigureModalVisibility();
  
  $('configure-quote-modal').classList.add('open');
  document.body.classList.add('modal-open');
}

function closeConfigureModal() {
  $('configure-quote-modal').classList.remove('open');
  document.body.classList.remove('modal-open');
}

function updateConfigureModalVisibility() {
  const liftCams = Number($('cfg-lift-cams').value || 0);
  const container = $('cfg-lift-details-container');
  
  if (liftCams > 0 && container) {
    container.style.display = 'flex';
    
    // Get camera numbers in session
    const camNumbers = Array.from(
      new Set(
        state.photos
          .filter(p => p.type === 'beeld' || p.type === 'locatie')
          .map(p => Number(p.camera_number || 1))
      )
    ).sort((a, b) => a - b);
    
    // Retrieve previously saved lift configs
    const savedLifts = state.session.quote_config?.lifts || [];
    
    let html = '';
    for (let i = 0; i < liftCams; i++) {
      const savedLift = savedLifts[i] || {};
      const selectedCam = savedLift.cam_number || (camNumbers[i] ? `CAM-${String(camNumbers[i]).padStart(3, '0')}` : '');
      const floors = savedLift.floors || 1;
      
      const optionsHtml = camNumbers.length 
        ? camNumbers.map(n => {
            const val = `CAM-${String(n).padStart(3, '0')}`;
            const sel = val === selectedCam ? 'selected' : '';
            return `<option value="${val}" ${sel}>${val}</option>`;
          }).join('')
        : '<option value="">Geen camera\'s beschikbaar</option>';
        
      html += `
        <div class="lift-config-row" style="border-bottom: 1px dashed var(--line); padding-bottom: 10px; margin-bottom: 5px;">
          <h4 style="margin: 0 0 5px 0; font-size: 0.85rem; color: var(--accent);">Liftcamera ${i + 1}</h4>
          <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px;">
            <div>
              <label style="font-size: 0.75rem; color: var(--muted);">Welke camera?</label>
              <select class="cfg-lift-cam-select" style="width: 100%; height: 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 0 8px; color: var(--text); margin-top: 4px;">
                ${optionsHtml}
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--muted);">Aantal verdiepingen</label>
              <input class="cfg-lift-floors-input" type="number" min="1" value="${floors}" style="height: 36px; margin-top: 4px; width: 100%;" />
            </div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  } else if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
  
  const subswitchNeeded = getRadioValue('cfg-subswitch-needed');
  const subswitchContainer = $('cfg-subswitch-details-container');
  
  if (subswitchNeeded === 'ja' && subswitchContainer) {
    subswitchContainer.style.display = 'flex';
    
    const qty = Number($('cfg-subswitch-qty').value || 1);
    const switchesList = $('cfg-switches-list');
    
    // Retrieve previously saved switches configurations
    const savedSwitches = state.session.quote_config?.switches || [];
    
    let html = '';
    for (let i = 0; i < qty; i++) {
      const savedSw = savedSwitches[i] || {};
      const ports = savedSw.ports || '8';
      const cabNeeded = savedSw.cabinet_needed || 'nee';
      
      html += `
        <div class="switch-config-row" style="border-bottom: 1px dashed var(--line); padding-bottom: 10px; margin-bottom: 5px;">
          <h4 style="margin: 0 0 5px 0; font-size: 0.85rem; color: var(--accent);">Subswitch ${i + 1}</h4>
          <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; align-items: end;">
            <div>
              <label style="font-size: 0.75rem; color: var(--muted);">Type poort</label>
              <select class="cfg-switch-ports" style="width: 100%; height: 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 0 8px; color: var(--text); margin-top: 4px;">
                <option value="8" ${ports === '8' ? 'selected' : ''}>8-poorts</option>
                <option value="24" ${ports === '24' ? 'selected' : ''}>24-poorts</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--muted); display: block; margin-bottom: 4px;">Kast nodig?</label>
              <div style="display: flex; gap: 10px; height: 36px; align-items: center;">
                <label style="text-transform: none; font-size: 0.85rem; display: flex; align-items: center; gap: 4px; font-weight: normal; color: var(--text); margin: 0;">
                  <input type="radio" name="cfg-switch-cab-${i}" value="ja" ${cabNeeded === 'ja' ? 'checked' : ''} style="width: auto; min-height: auto;" /> Ja
                </label>
                <label style="text-transform: none; font-size: 0.85rem; display: flex; align-items: center; gap: 4px; font-weight: normal; color: var(--text); margin: 0;">
                  <input type="radio" name="cfg-switch-cab-${i}" value="nee" ${cabNeeded === 'nee' ? 'checked' : ''} style="width: auto; min-height: auto;" /> Nee
                </label>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    switchesList.innerHTML = html;
    
    switchesList.querySelectorAll('.cfg-switch-ports').forEach(select => {
      select.addEventListener('change', updateCameraConnectionsMappingSection);
    });
  } else if (subswitchContainer) {
    subswitchContainer.style.display = 'none';
  }
  
  updateCameraConnectionsMappingSection();
}

function syncConfigureCameraCounts(changedField) {
  const total = Number($('cfg-total-cams').textContent || 0);
  let std = Number($('cfg-std-cams').value || 0);
  let lift = Number($('cfg-lift-cams').value || 0);
  
  if (changedField === 'lift') {
    if (lift > total) {
      lift = total;
      $('cfg-lift-cams').value = lift;
    }
    std = total - lift;
    $('cfg-std-cams').value = std;
  } else if (changedField === 'std') {
    if (std > total) {
      std = total;
      $('cfg-std-cams').value = std;
    }
    lift = total - std;
    $('cfg-lift-cams').value = lift;
  }
  
  updateConfigureModalVisibility();
}

async function saveConfigureSettings() {
  const lifts = [];
  const liftRows = document.querySelectorAll('.lift-config-row');
  liftRows.forEach(row => {
    const camSelect = row.querySelector('.cfg-lift-cam-select');
    const floorsInput = row.querySelector('.cfg-lift-floors-input');
    lifts.push({
      cam_number: camSelect ? camSelect.value : '',
      floors: floorsInput ? Number(floorsInput.value || 1) : 1
    });
  });
  
  const switches = [];
  if (getRadioValue('cfg-subswitch-needed') === 'ja') {
    const switchRows = document.querySelectorAll('.switch-config-row');
    switchRows.forEach((row, index) => {
      const portsSelect = row.querySelector('.cfg-switch-ports');
      const checkedRadio = row.querySelector(`input[name="cfg-switch-cab-${index}"]:checked`);
      const cabinetNeeded = checkedRadio ? checkedRadio.value : 'nee';
      
      switches.push({
        ports: portsSelect ? portsSelect.value : '8',
        cabinet_needed: cabinetNeeded
      });
    });
  }

  // Camera verbindingen centraal opslaan
  const camConnectionSelects = document.querySelectorAll('.cfg-cam-conn-select');
  for (const select of camConnectionSelects) {
    const camNr = Number(select.dataset.camNr);
    const connTo = select.value;
    const photosToUpdate = state.photos.filter(p => Number(p.camera_number) === camNr);
    for (const photo of photosToUpdate) {
      if (photo.connected_to !== connTo) {
        photo.connected_to = connTo;
        await localApi.updatePhoto(photo.id, { connected_to: connTo });
      }
    }
  }

  const config = {
    new_install: getRadioValue('cfg-new-install'),
    std_cams: Number($('cfg-std-cams').value || 0),
    lift_cams: Number($('cfg-lift-cams').value || 0),
    lifts: lifts,
    wall_brackets: Number($('cfg-wall-brackets').value || 0),
    coax_converters: Number($('cfg-coax-converters').value || 0),
    server_channels: $('cfg-server-channels').value,
    subswitch_needed: getRadioValue('cfg-subswitch-needed'),
    subswitch_qty: getRadioValue('cfg-subswitch-needed') === 'ja' ? Number($('cfg-subswitch-qty').value || 1) : 0,
    switches: switches,
    cabinet_type: $('cfg-cabinet-type').value
  };
  
  state.session.quote_config = config;
  const res = await localApi.updateSession(state.session.id, { quote_config: config });
  if (res.success) {
    showToast('Configuratie opgeslagen');
    if (typeof updateSwitchButtonVisibility === 'function') updateSwitchButtonVisibility();
    closeConfigureModal();
    if (state.quoteModalOpen) {
      renderExcelTable();
    }
  } else {
    showToast('Fout bij opslaan: ' + res.error);
  }
}

function updateCameraConnectionsMappingSection() {
  const section = $('cfg-cam-connections-section');
  const listEl = $('cfg-cam-connections-list');
  if (!section || !listEl) return;
  
  const camNumbers = Array.from(
    new Set(
      state.photos
        .filter(p => p.type === 'beeld' || p.type === 'locatie')
        .map(p => Number(p.camera_number || 1))
    )
  ).sort((a, b) => a - b);
  
  if (camNumbers.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'flex';
  
  const connectionsMap = {};
  camNumbers.forEach(n => {
    const photo = state.photos.find(p => Number(p.camera_number) === n && p.connected_to);
    connectionsMap[n] = photo ? photo.connected_to : 'recorder';
  });
  
  const hasSubswitch = getRadioValue('cfg-subswitch-needed') === 'ja';
  const subswitchQty = Number($('cfg-subswitch-qty').value || 1);
  
  const options = [{ value: 'recorder', label: 'Recorder' }];
  if (hasSubswitch) {
    const switchRows = document.querySelectorAll('.switch-config-row');
    for (let i = 0; i < subswitchQty; i++) {
      const row = switchRows[i];
      const portsSelect = row ? row.querySelector('.cfg-switch-ports') : null;
      const ports = portsSelect ? portsSelect.value : '8';
      options.push({ value: `switch_${i + 1}`, label: `Switch ${i + 1} (${ports}p)` });
    }
  }
  
  listEl.innerHTML = camNumbers.map(n => {
    const selectedVal = connectionsMap[n] || 'recorder';
    const selectOptionsHtml = options.map(opt => {
      const sel = opt.value === selectedVal ? 'selected' : '';
      return `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
    }).join('');
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--line); padding-bottom: 6px; margin-bottom: 6px;">
        <span style="font-weight: 600; font-size: 0.85rem;">CAM-${String(n).padStart(3, '0')}</span>
        <select class="cfg-cam-conn-select" data-cam-nr="${n}" style="width: 150px; height: 32px; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; color: var(--text); font-size: 0.8rem;">
          ${selectOptionsHtml}
        </select>
      </div>
    `;
  }).join('');
}

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : '';
}

function setRadioValue(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function renderExcelTable() {
  const tableBody = $('excel-table-body');
  if (!tableBody) return;
  
  const config = state.session?.quote_config || {};
  
  if (!config.std_cams && !config.lift_cams && (!config.server_channels || config.server_channels === 'geen')) {
    tableBody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align: center; padding: 20px;">Geen offerte-configuratie gevonden. Klik op "Wijzig" om te beginnen.</td></tr>';
    return;
  }
  
  const rows = [];
  
  if (config.std_cams > 0) {
    rows.push({ code: '6082', desc: 'Standaard camera (6082)', qty: config.std_cams, unit: 'stuks' });
  }
  if (config.lift_cams > 0 && config.lifts && config.lifts.length) {
    config.lifts.forEach((lift, index) => {
      rows.push({ code: '6011', desc: `Liftcamera (6011) - camera ${lift.cam_number || '-'}`, qty: 1, unit: 'stuks' });
      rows.push({ code: 'VERDIEPING', desc: `Aantal verdiepingen lift ${index + 1} (${lift.cam_number || '-'})`, qty: lift.floors || 1, unit: 'verdiepingen' });
    });
  }
  if (config.wall_brackets > 0) {
    rows.push({ code: 'MUURBEUGEL', desc: 'Muurbeugel camera', qty: config.wall_brackets, unit: 'stuks' });
  }
  if (config.coax_converters > 0) {
    rows.push({ code: 'COAX_CONVERTER', desc: 'IP over coax-converter', qty: config.coax_converters, unit: 'stuks' });
  }
  if (config.server_channels && config.server_channels !== 'geen') {
    rows.push({ code: `SERVER_${config.server_channels}CH`, desc: `Server ${config.server_channels}-kanaals`, qty: 1, unit: 'stuks' });
  }
  if (config.subswitch_needed === 'ja' && config.switches && config.switches.length) {
    let switch8pCount = 0;
    let switch24pCount = 0;
    let cabinetCount = 0;
    
    config.switches.forEach(sw => {
      if (sw.ports === '8') switch8pCount++;
      else if (sw.ports === '24') switch24pCount++;
      if (sw.cabinet_needed === 'ja') cabinetCount++;
    });
    
    if (switch8pCount > 0) {
      rows.push({ code: 'SWITCH_8P', desc: 'Subswitch 8-poorts', qty: switch8pCount, unit: 'stuks' });
    }
    if (switch24pCount > 0) {
      rows.push({ code: 'SWITCH_24P', desc: 'Subswitch 24-poorts', qty: switch24pCount, unit: 'stuks' });
    }
    if (cabinetCount > 0) {
      rows.push({ code: 'SWITCH_KAST', desc: 'Subswitch kast', qty: cabinetCount, unit: 'stuks' });
    }
  }
  if (config.cabinet_type && config.cabinet_type !== 'geen') {
    let desc = '';
    let code = '';
    if (config.cabinet_type === 'groot') {
      desc = 'Kast Groot 600mm diep';
      code = 'KAST_600';
    } else if (config.cabinet_type === 'middel') {
      desc = 'Kast Middel 450mm diep';
      code = 'KAST_450';
    } else if (config.cabinet_type === 'brievenbus') {
      desc = 'Brievenbuskast';
      code = 'KAST_BRIEVENBUS';
    }
    rows.push({ code, desc, qty: 1, unit: 'stuks' });
  }
  if (config.new_install === 'ja') {
    rows.push(
      { code: 'UPS', desc: 'UPS back-up voeding', qty: 1, unit: 'stuks' },
      { code: 'ROUTER_4G', desc: '4G Router', qty: 1, unit: 'stuks' },
      { code: 'ANTENNE_4G', desc: '4G Router Antenne', qty: 1, unit: 'stuks' },
      { code: 'DEURCONTACT', desc: 'Deurcontact', qty: 1, unit: 'stuks' }
    );
  }
  
  tableBody.innerHTML = rows.map(r => `
    <tr>
      <td style="padding: 8px 4px;">${escapeHtml(r.code)}</td>
      <td style="padding: 8px 4px;">${escapeHtml(r.desc)}</td>
      <td style="padding: 8px 4px; text-align: right;">${r.qty}</td>
      <td style="padding: 8px 4px;">${escapeHtml(r.unit)}</td>
    </tr>
  `).join('');
}

async function downloadExcelCsv() {
  const config = state.session?.quote_config || {};
  if (!config.std_cams && !config.lift_cams && (!config.server_channels || config.server_channels === 'geen')) {
    return showToast('Geconfigureer eerst de schouw-opties');
  }
  
  const rows = [];
  
  if (config.std_cams > 0) {
    rows.push(['6082', 'Standaard camera (6082)', config.std_cams, 'stuks']);
  }
  if (config.lift_cams > 0 && config.lifts && config.lifts.length) {
    config.lifts.forEach((lift, index) => {
      rows.push(['6011', `Liftcamera (6011) - camera ${lift.cam_number || '-'}`, 1, 'stuks']);
      rows.push(['VERDIEPING', `Aantal verdiepingen lift ${index + 1} (${lift.cam_number || '-'})`, lift.floors || 1, 'verdiepingen']);
    });
  }
  if (config.wall_brackets > 0) {
    rows.push(['MUURBEUGEL', 'Muurbeugel camera', config.wall_brackets, 'stuks']);
  }
  if (config.coax_converters > 0) {
    rows.push(['COAX_CONVERTER', 'IP over coax-converter', config.coax_converters, 'stuks']);
  }
  if (config.server_channels && config.server_channels !== 'geen') {
    rows.push([`SERVER_${config.server_channels}CH`, `Server ${config.server_channels}-kanaals`, 1, 'stuks']);
  }
  if (config.subswitch_needed === 'ja' && config.switches && config.switches.length) {
    let switch8pCount = 0;
    let switch24pCount = 0;
    let cabinetCount = 0;
    
    config.switches.forEach(sw => {
      if (sw.ports === '8') switch8pCount++;
      else if (sw.ports === '24') switch24pCount++;
      if (sw.cabinet_needed === 'ja') cabinetCount++;
    });
    
    if (switch8pCount > 0) {
      rows.push(['SWITCH_8P', 'Subswitch 8-poorts', switch8pCount, 'stuks']);
    }
    if (switch24pCount > 0) {
      rows.push(['SWITCH_24P', 'Subswitch 24-poorts', switch24pCount, 'stuks']);
    }
    if (cabinetCount > 0) {
      rows.push(['SWITCH_KAST', 'Subswitch kast', cabinetCount, 'stuks']);
    }
  }
  if (config.cabinet_type && config.cabinet_type !== 'geen') {
    let desc = '';
    let code = '';
    if (config.cabinet_type === 'groot') {
      desc = 'Kast Groot 600mm diep';
      code = 'KAST_600';
    } else if (config.cabinet_type === 'middel') {
      desc = 'Kast Middel 450mm diep';
      code = 'KAST_450';
    } else if (config.cabinet_type === 'brievenbus') {
      desc = 'Brievenbuskast';
      code = 'KAST_BRIEVENBUS';
    }
    rows.push([code, desc, 1, 'stuks']);
  }
  if (config.new_install === 'ja') {
    rows.push(
      ['UPS', 'UPS back-up voeding', 1, 'stuks'],
      ['ROUTER_4G', '4G Router', 1, 'stuks'],
      ['ANTENNE_4G', '4G Router Antenne', 1, 'stuks'],
      ['DEURCONTACT', 'Deurcontact', 1, 'stuks']
    );
  }
  
  const header = ['Code', 'Omschrijving', 'Aantal', 'Eenheid'];
  const csvContent = [
    header.join(';'),
    ...rows.map(r => r.map(cell => {
      const text = String(cell);
      return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(';'))
  ].join('\n');
  
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const fileName = `offerte-${sanitizeFileName(state.session.name || 'sessie')}.csv`;
  
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  const share = window.Capacitor?.Plugins?.Share;
  if (isNativeMobileApp() && filesystem) {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const saved = await filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: 'DOCUMENTS',
          recursive: true
        });
        let fileUrl = saved.uri;
        try {
          const uriResult = await filesystem.getUri({ path: fileName, directory: 'DOCUMENTS' });
          fileUrl = uriResult.uri || fileUrl;
        } catch {}
        if (share && fileUrl) {
          await share.share({
            title: 'Offerte Excel Export',
            text: fileName,
            url: fileUrl,
            dialogTitle: 'Exporteer CSV'
          });
          showToast('CSV export klaar om te delen');
        } else {
          showToast(`CSV opgeslagen in Documenten: ${fileName}`);
        }
      } catch (e) {
        showToast('Fout bij exporteren: ' + e.message);
      }
    };
    reader.readAsDataURL(blob);
    return;
  }
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('CSV download gestart');
}

async function importExcelCsv(file) {
  if (!state.session) return showToast('Open of start eerst een sessie');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      
      // Parse CSV rows
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) throw new Error('Ongeldig CSV-bestand');
      
      // Parse header to find column indices
      const headerLine = lines[0].replace(/^\uFEFF/, ''); // Remove BOM if present
      const headers = headerLine.split(';').map(h => h.trim().toLowerCase());
      
      const codeIdx = headers.indexOf('code');
      const descIdx = headers.indexOf('omschrijving');
      const qtyIdx = headers.indexOf('aantal');
      
      if (codeIdx === -1 || qtyIdx === -1) {
        throw new Error('Kolommen "Code" of "Aantal" ontbreken in het CSV-bestand');
      }
      
      // Initialize a new empty config structure
      const config = {
        new_install: 'nee',
        std_cams: 0,
        lift_cams: 0,
        lifts: [],
        wall_brackets: 0,
        coax_converters: 0,
        server_channels: 'geen',
        subswitch_needed: 'nee',
        subswitch_qty: 0,
        switches: [],
        cabinet_type: 'geen'
      };
      
      let parsedLifts = [];
      let parsedSwitches = [];
      let cabinetNeededCount = 0;
      let hasNewInstallItems = false;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cells = line.split(';').map(c => {
          let val = c.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
          }
          return val;
        });
        
        const code = cells[codeIdx];
        const desc = cells[descIdx] || '';
        const qty = Number(cells[qtyIdx] || 0);
        
        if (!code) continue;
        
        if (code === '6082') {
          config.std_cams = qty;
        } else if (code === '6011') {
          config.lift_cams += qty;
          const match = desc.match(/camera\s+(CAM-\d+)/i);
          const camNum = match ? match[1] : '';
          for (let j = 0; j < qty; j++) {
            parsedLifts.push({
              cam_number: camNum,
              floors: 1
            });
          }
        } else if (code === 'VERDIEPING') {
          const match = desc.match(/\((CAM-\d+)\)/i);
          const camNum = match ? match[1] : '';
          
          let matched = false;
          if (camNum) {
            const lift = parsedLifts.find(l => l.cam_number === camNum);
            if (lift) {
              lift.floors = qty;
              matched = true;
            }
          }
          if (!matched) {
            const lift = parsedLifts.find(l => l.floors === 1);
            if (lift) {
              lift.floors = qty;
            }
          }
        } else if (code === 'MUURBEUGEL') {
          config.wall_brackets = qty;
        } else if (code === 'COAX_CONVERTER') {
          config.coax_converters = qty;
        } else if (code.startsWith('SERVER_')) {
          const channels = code.replace('SERVER_', '').replace('CH', '');
          config.server_channels = channels;
        } else if (code === 'SWITCH_8P') {
          config.subswitch_needed = 'ja';
          config.subswitch_qty += qty;
          for (let j = 0; j < qty; j++) {
            parsedSwitches.push({ ports: '8', cabinet_needed: 'nee' });
          }
        } else if (code === 'SWITCH_24P') {
          config.subswitch_needed = 'ja';
          config.subswitch_qty += qty;
          for (let j = 0; j < qty; j++) {
            parsedSwitches.push({ ports: '24', cabinet_needed: 'nee' });
          }
        } else if (code === 'SWITCH_KAST') {
          cabinetNeededCount = qty;
        } else if (code === 'KAST_600') {
          config.cabinet_type = 'groot';
        } else if (code === 'KAST_450') {
          config.cabinet_type = 'middel';
        } else if (code === 'KAST_BRIEVENBUS') {
          config.cabinet_type = 'brievenbus';
        } else if (['UPS', 'ROUTER_4G', 'ANTENNE_4G', 'DEURCONTACT'].includes(code)) {
          hasNewInstallItems = true;
        }
      }
      
      config.lifts = parsedLifts;
      
      for (let j = 0; j < parsedSwitches.length; j++) {
        if (j < cabinetNeededCount) {
          parsedSwitches[j].cabinet_needed = 'ja';
        }
      }
      config.switches = parsedSwitches;
      
      if (hasNewInstallItems) {
        config.new_install = 'ja';
      }
      
      state.session.quote_config = config;
      const res = await localApi.updateSession(state.session.id, { quote_config: config });
      if (res.success) {
        showToast('Offerte succesvol geïmporteerd!');
        renderExcelTable();
      } else {
        throw new Error(res.error || 'Kon database niet updaten');
      }
    } catch (err) {
      console.error(err);
      showToast('Fout bij importeren: ' + err.message);
    }
  };
  reader.readAsText(file);
}
