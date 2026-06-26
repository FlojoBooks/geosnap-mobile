// Client management and custom client-specific pricing overrides logic.

function initClients() {
  $('btn-show-clients').addEventListener('click', openClientsModal);
  $('btn-close-clients-modal').addEventListener('click', closeClientsModal);
  $('btn-add-client').addEventListener('click', addClient);
  
  // Populate selectors at startup
  populateSessionClientSelects();
}

function openClientsModal() {
  state.clientsModalOpen = true;
  state.selectedClientId = null;
  
  $('clients-modal').classList.add('open');
  document.body.classList.add('modal-open');
  
  renderClientsList();
  renderClientDetails(null);
  
  // Close drawer
  closeDrawer();
}

function closeClientsModal() {
  state.clientsModalOpen = false;
  $('clients-modal').classList.remove('open');
  document.body.classList.remove('modal-open');
  
  // Update dropdowns in drawer & session modal
  populateSessionClientSelects();
}

function renderClientsList() {
  const listEl = $('clients-list');
  if (!listEl) return;
  
  const clients = getClients();
  if (!clients.length) {
    listEl.innerHTML = '<p class="muted" style="font-size: 0.8rem; text-align: center; margin-top: 10px;">Geen klanten</p>';
    return;
  }
  
  listEl.innerHTML = clients.map(client => {
    const isActive = client.id === state.selectedClientId;
    return `
      <button class="session-item${isActive ? ' active' : ''}" type="button" style="text-align: left; padding: 8px 10px;" onclick="selectClient('${client.id}')">
        <strong>${escapeHtml(client.name)}</strong>
      </button>
    `;
  }).join('');
}

function selectClient(clientId) {
  state.selectedClientId = clientId;
  renderClientsList();
  
  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  renderClientDetails(client);
}

function addClient() {
  const inputEl = $('new-client-name');
  const name = inputEl.value.trim();
  
  if (!name) return showToast('Vul een klantnaam in');
  
  const clients = getClients();
  const client = {
    id: uuid(),
    name: name,
    custom_pricing: {}
  };
  
  clients.push(client);
  saveClients(clients);
  
  inputEl.value = '';
  renderClientsList();
  selectClient(client.id);
  showToast('Klant toegevoegd');
}

function deleteClient(clientId) {
  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  
  const confirmed = window.confirm(`Weet je zeker dat je ${client.name} wilt verwijderen?`);
  if (!confirmed) return;
  
  const updated = clients.filter(c => c.id !== clientId);
  saveClients(updated);
  
  state.selectedClientId = null;
  renderClientsList();
  renderClientDetails(null);
  showToast('Klant verwijderd');
}

function renderClientDetails(client) {
  const paneEl = $('client-detail-pane');
  if (!paneEl) return;
  
  if (!client) {
    paneEl.innerHTML = '<p class="muted" style="text-align: center; margin-top: 50px;">Selecteer een klant om tarieven te beheren.</p>';
    return;
  }
  
  const types = getCableTypes();
  const pricing = getCablePricing();
  
  // Options for overriding
  const optionsHtml = types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)} (Std: € ${pricing[t].toFixed(2)})</option>`).join('');
  
  // Overrides list
  const overrides = Object.keys(client.custom_pricing || {});
  let overridesHtml = '';
  if (!overrides.length) {
    overridesHtml = '<p class="muted" style="font-size: 0.8rem; margin: 5px 0;">Geen klant-specifieke tarieven ingesteld.</p>';
  } else {
    overridesHtml = overrides.map(type => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.01); border: 1px solid var(--line); padding: 6px 10px; border-radius: 4px; font-size: 0.82rem; margin-bottom: 4px;">
        <span><strong>${escapeHtml(type)}</strong>: € ${client.custom_pricing[type].toFixed(2)}/m</span>
        <button class="secondary danger" style="min-height: 24px; padding: 0 8px; font-size: 0.75rem;" type="button" onclick="removeClientOverride('${client.id}', '${escapeHtml(type)}')">Verwijderen</button>
      </div>
    `).join('');
  }
  
  paneEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
      <h3 style="margin: 0; font-size: 1.05rem;">${escapeHtml(client.name)}</h3>
      <button class="secondary danger" style="min-height: 32px; font-size: 0.8rem;" type="button" onclick="deleteClient('${client.id}')">Klant verwijderen</button>
    </div>
    
    <div>
      <h4 style="margin: 0 0 8px 0; font-size: 0.88rem;">Klant-specifieke tarieven (overrides)</h4>
      <div id="client-overrides-list" style="margin-bottom: 12px;">
        ${overridesHtml}
      </div>
    </div>
    
    <div style="border-top: 1px solid var(--line); padding-top: 12px;">
      <h4 style="margin: 0 0 8px 0; font-size: 0.88rem;">Tarief overschrijven / toevoegen</h4>
      <div style="display: grid; grid-template-columns: 1fr 100px; gap: 8px; margin-bottom: 8px;">
        <select id="override-cable-type" style="height: 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 0 6px; color: var(--text); font-size: 0.8rem;">
          ${optionsHtml}
        </select>
        <input id="override-cable-price" type="number" step="0.01" min="0" placeholder="Prijs/m" style="height: 36px; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 0 6px; color: var(--text); font-size: 0.8rem;" />
      </div>
      <button id="btn-save-override" class="secondary wide" style="min-height: 32px; font-size: 0.8rem;" type="button" onclick="addClientOverride('${client.id}')">Tarief opslaan</button>
    </div>
  `;
}

function addClientOverride(clientId) {
  const typeSelect = $('override-cable-type');
  const priceInput = $('override-cable-price');
  
  if (!typeSelect || !priceInput) return;
  
  const type = typeSelect.value;
  const price = parseFloat(priceInput.value);
  
  if (isNaN(price) || price < 0) return showToast('Vul een geldige prijs in');
  
  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  
  if (!client.custom_pricing) client.custom_pricing = {};
  client.custom_pricing[type] = price;
  
  saveClients(clients);
  renderClientDetails(client);
  showToast('Tarief-override opgeslagen');
}

function removeClientOverride(clientId, type) {
  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;
  
  if (client.custom_pricing && client.custom_pricing[type] !== undefined) {
    delete client.custom_pricing[type];
    saveClients(clients);
    renderClientDetails(client);
    showToast('Tarief-override verwijderd');
  }
}

function populateSessionClientSelects() {
  const sessionSelect = $('session-client-id');
  const modalSelect = $('modal-session-client-id');
  
  if (!sessionSelect && !modalSelect) return;
  
  const clients = getClients();
  let optionsHtml = '<option value="">-- Geen klant (Standaard tarieven) --</option>';
  optionsHtml += clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  
  if (sessionSelect) {
    sessionSelect.innerHTML = optionsHtml;
    // Set selected client if state has active session
    if (state.session && state.session.client_id) {
      sessionSelect.value = state.session.client_id;
    }
  }
  
  if (modalSelect) {
    modalSelect.innerHTML = optionsHtml;
    if (state.session && state.session.client_id) {
      modalSelect.value = state.session.client_id;
    }
  }
}
