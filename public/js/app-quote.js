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
  if (tab === 'quote') {
    $('tab-btn-quote').classList.add('active');
    $('tab-btn-rates').classList.remove('active');
    $('tab-content-quote').style.display = 'flex';
    $('tab-content-rates').style.display = 'none';
    renderQuoteTable();
  } else {
    $('tab-btn-quote').classList.remove('active');
    $('tab-btn-rates').classList.add('active');
    $('tab-content-quote').style.display = 'none';
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
    tableBody.innerHTML = '<tr><td colspan="5" class="muted" style="text-align: center; padding: 20px;">Geen camera\'s met foto\'s gevonden in deze sessie.</td></tr>';
    totalPriceEl.textContent = '€ 0,00';
    return;
  }
  
  const pricing = getCablePricing();
  let grandTotal = 0;
  
  tableBody.innerHTML = camNumbers.map(camNum => {
    // Find cable info for this camera. We check the 'beeld' photo first, then 'locatie'
    const photos = state.photos.filter(p => Number(p.camera_number) === camNum);
    const mainPhoto = photos.find(p => p.type === 'beeld') || photos.find(p => p.type === 'locatie');
    
    const cableType = mainPhoto ? (mainPhoto.cable_type || '') : '';
    const cableLength = mainPhoto ? (mainPhoto.cable_length || 0) : 0;
    const rate = pricing[cableType] || 0;
    const subtotal = cableLength * rate;
    grandTotal += subtotal;
    
    return `
      <tr>
        <td style="padding: 8px 4px;">CAM-${String(camNum).padStart(3, '0')}</td>
        <td style="padding: 8px 4px;">${escapeHtml(cableType || 'Geen kabel opgegeven')}</td>
        <td style="padding: 8px 4px; text-align: right;">${cableLength} m</td>
        <td style="padding: 8px 4px; text-align: right;">€ ${rate.toFixed(2)}</td>
        <td style="padding: 8px 4px; text-align: right;">€ ${subtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
  
  totalPriceEl.textContent = `€ ${grandTotal.toFixed(2)}`;
}
