const state = {
  section: 'payments',
  paymentFilter: 'all',
  supportFilter: 'all',
  payments: [],
  support: [],
  codeHistory: [],
  selectedPaymentId: null,
  selectedSupportId: null
};

const el = {
  navButtons: [...document.querySelectorAll('.nav-btn')],
  sections: {
    payments: document.querySelector('#section-payments'),
    codes: document.querySelector('#section-codes'),
    support: document.querySelector('#section-support')
  },
  paymentFilters: [...document.querySelectorAll('#paymentFilters .filter-btn')],
  supportFilters: [...document.querySelectorAll('#supportFilters .filter-btn')],
  paymentsList: document.querySelector('#paymentsList'),
  paymentsDetail: document.querySelector('#paymentsDetail'),
  supportList: document.querySelector('#supportList'),
  supportDetail: document.querySelector('#supportDetail'),
  codeInput: document.querySelector('#codeInput'),
  codeHistory: document.querySelector('#codeHistory'),
  generatedCodeResult: document.querySelector('#generatedCodeResult'),
  sidebarStats: document.querySelector('#sidebarStats'),
  refreshPayments: document.querySelector('#refreshPayments'),
  refreshSupport: document.querySelector('#refreshSupport'),
  generateCodeBtn: document.querySelector('#generateCodeBtn')
};

function money(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function dateLabel(value) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function toneClass(value) {
  return value === 'ok' ? 'ok' : value === 'alert' ? 'alert' : 'warn';
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function setSection(section) {
  state.section = section;
  el.navButtons.forEach((button) => button.classList.toggle('active', button.dataset.section === section));
  Object.entries(el.sections).forEach(([key, node]) => node.classList.toggle('active', key === section));
}

function renderSidebarStats() {
  const manualPayments = state.payments.filter((item) => item.bucket === 'manual').length;
  const resolvedPayments = state.payments.filter((item) => item.bucket === 'resolved').length;
  const openSupport = state.support.filter((item) => item.status !== 'resolved').length;
  el.sidebarStats.innerHTML = `
    <div class="stat-row"><span>Pagos manuales</span><strong>${manualPayments}</strong></div>
    <div class="stat-row"><span>Pagos resueltos</span><strong>${resolvedPayments}</strong></div>
    <div class="stat-row"><span>Soporte abierto</span><strong>${openSupport}</strong></div>
    <div class="stat-row"><span>Tokens generados</span><strong>${state.codeHistory.length}</strong></div>
  `;
}

function renderPayments() {
  const filtered = state.payments.filter((item) => state.paymentFilter === 'all' || item.bucket === state.paymentFilter);
  if (!state.selectedPaymentId && filtered[0]) state.selectedPaymentId = filtered[0].id;
  if (!filtered.some((item) => item.id === state.selectedPaymentId)) state.selectedPaymentId = filtered[0]?.id || null;

  el.paymentsList.innerHTML = `<div class="list-stack">${filtered.map((item) => `
    <article class="ticket-card ${toneClass(item.stateTone)} ${item.id === state.selectedPaymentId ? 'active' : ''}" data-payment-id="${item.id}">
      <div class="ticket-top">
        <div>
          <div class="ticket-id">${item.orderId}</div>
          <div class="ticket-title">${item.title}</div>
        </div>
        <div class="state-pill ${toneClass(item.stateTone)}">${item.label}</div>
      </div>
      <div class="ticket-desc">${item.description}</div>
      <div class="meta-row">
        <div class="tag-pill">${item.source}</div>
        <div class="tag-pill">${money(item.amount)}</div>
        <div class="tag-pill">${item.customerName}</div>
      </div>
      <div class="ticket-bottom">
        <span>${item.customerPhone}</span>
        <span>${dateLabel(item.updatedAt)}</span>
      </div>
    </article>
  `).join('')}</div>`;

  const selected = state.payments.find((item) => item.id === state.selectedPaymentId);
  if (!selected) {
    el.paymentsDetail.innerHTML = '<div class="detail-empty">No hay pagos para este filtro.</div>';
    return;
  }

  el.paymentsDetail.innerHTML = `
    <h2 class="detail-title">${selected.orderId} • ${selected.title}</h2>
    <p class="detail-sub">${selected.description}</p>
    <div class="detail-grid">
      <div class="detail-box"><label>Cliente</label><strong>${selected.customerName}</strong></div>
      <div class="detail-box"><label>WhatsApp</label><strong>${selected.customerPhone}</strong></div>
      <div class="detail-box"><label>Monto pedido</label><strong>${money(selected.amount)}</strong></div>
      <div class="detail-box"><label>Monto detectado</label><strong>${money(selected.detectedAmount)}</strong></div>
      <div class="detail-box"><label>Operacion</label><strong>${selected.operationCode || 'Sin codigo'}</strong></div>
      <div class="detail-box"><label>Juegos</label><strong>${selected.games.join(', ') || 'Sin juegos'}</strong></div>
    </div>
    <div class="detail-actions">
      <button class="action-btn green" data-open-wa="${selected.customerPhone}">Abrir WhatsApp<small>Ir al chat del cliente</small></button>
      <button class="action-btn blue" data-payment-action="reviewed" data-id="${selected.id}">Marcar revisado<small>Para control de casos ya cerrados o validados</small></button>
      <button class="action-btn gold" data-payment-action="resolve" data-id="${selected.id}">Resolver<small>Cerrar caso sin mas trabajo</small></button>
      <button class="action-btn red" data-payment-action="reject" data-id="${selected.id}">Marcar problema<small>Dejar el caso visible como conflicto</small></button>
    </div>
    <div class="note-box">Nota privada: ${selected.privateNote || 'Sin nota.'}</div>
  `;

  el.paymentsList.querySelectorAll('[data-payment-id]').forEach((node) => {
    node.addEventListener('click', () => {
      state.selectedPaymentId = node.dataset.paymentId;
      renderPayments();
    });
  });

  el.paymentsDetail.querySelectorAll('[data-payment-action]').forEach((node) => {
    node.addEventListener('click', async () => {
      await api(`/api/payments/${node.dataset.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: node.dataset.paymentAction })
      });
      await loadState();
    });
  });

  const waBtn = el.paymentsDetail.querySelector('[data-open-wa]');
  waBtn?.addEventListener('click', async () => {
    const { link } = await api(`/api/whatsapp-link/${waBtn.dataset.openWa}`);
    window.open(link, '_blank');
  });
}

function renderSupport() {
  const filtered = state.support.filter((item) => state.supportFilter === 'all' || item.status === state.supportFilter);
  if (!state.selectedSupportId && filtered[0]) state.selectedSupportId = filtered[0].id;
  if (!filtered.some((item) => item.id === state.selectedSupportId)) state.selectedSupportId = filtered[0]?.id || null;

  el.supportList.innerHTML = `<div class="list-stack">${filtered.map((item) => `
    <article class="ticket-card warn ${item.id === state.selectedSupportId ? 'active' : ''}" data-support-id="${item.id}">
      <div class="ticket-top">
        <div>
          <div class="ticket-id">${item.orderId}</div>
          <div class="ticket-title">${item.title}</div>
        </div>
        <div class="state-pill warn">${item.label}</div>
      </div>
      <div class="ticket-desc">${item.description}</div>
      <div class="meta-row">
        <div class="tag-pill">${item.game}</div>
        <div class="tag-pill">${item.source}</div>
      </div>
      <div class="ticket-bottom">
        <span>${item.customerPhone}</span>
        <span>${dateLabel(item.updatedAt)}</span>
      </div>
    </article>
  `).join('')}</div>`;

  const selected = state.support.find((item) => item.id === state.selectedSupportId);
  if (!selected) {
    el.supportDetail.innerHTML = '<div class="detail-empty">No hay tickets para este filtro.</div>';
    return;
  }

  el.supportDetail.innerHTML = `
    <h2 class="detail-title">${selected.orderId} • ${selected.title}</h2>
    <p class="detail-sub">${selected.description}</p>
    <div class="detail-grid">
      <div class="detail-box"><label>Juego</label><strong>${selected.game}</strong></div>
      <div class="detail-box"><label>Estado</label><strong>${selected.label}</strong></div>
      <div class="detail-box"><label>WhatsApp</label><strong>${selected.customerPhone}</strong></div>
      <div class="detail-box"><label>Origen</label><strong>${selected.source}</strong></div>
    </div>
    <div class="detail-actions">
      <button class="action-btn green" data-open-wa="${selected.customerPhone}">Abrir WhatsApp<small>Seguir el ticket con el cliente</small></button>
      <button class="action-btn blue" data-support-action="in_progress" data-id="${selected.id}">Tomar ticket<small>Pasarlo a en curso</small></button>
      <button class="action-btn gold" data-support-action="waiting_capture" data-id="${selected.id}">Esperando captura<small>Dejarlo en espera del cliente</small></button>
      <button class="action-btn blue" data-support-action="resolved" data-id="${selected.id}">Resolver ticket<small>Cerrar soporte</small></button>
    </div>
    <div class="note-box">Nota privada: ${selected.privateNote || 'Sin nota.'}</div>
  `;

  el.supportList.querySelectorAll('[data-support-id]').forEach((node) => {
    node.addEventListener('click', () => {
      state.selectedSupportId = node.dataset.supportId;
      renderSupport();
    });
  });

  el.supportDetail.querySelectorAll('[data-support-action]').forEach((node) => {
    node.addEventListener('click', async () => {
      await api(`/api/support/${node.dataset.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: node.dataset.supportAction })
      });
      await loadState();
    });
  });

  const waBtn = el.supportDetail.querySelector('[data-open-wa]');
  waBtn?.addEventListener('click', async () => {
    const { link } = await api(`/api/whatsapp-link/${waBtn.dataset.openWa}`);
    window.open(link, '_blank');
  });
}

function renderCodes() {
  el.codeHistory.innerHTML = state.codeHistory.length ? state.codeHistory.map((item) => `
    <article class="history-item">
      <strong>${item.token}</strong>
      <p>${item.titles.join(', ') || 'Sin nombres'}${item.numericIds.length ? ` • AppIDs: ${item.numericIds.join(', ')}` : ''}</p>
      <p>${dateLabel(item.createdAt)}</p>
    </article>
  `).join('') : '<div class="empty-state">No hay codigos generados todavia.</div>';
}

async function loadState() {
  const [payments, support, codeHistory] = await Promise.all([
    api(`/api/payments?filter=${state.paymentFilter}`),
    api(`/api/support?filter=${state.supportFilter}`),
    api('/api/codes/history')
  ]);
  state.payments = payments;
  state.support = support;
  state.codeHistory = codeHistory;
  renderSidebarStats();
  renderPayments();
  renderSupport();
  renderCodes();
}

el.navButtons.forEach((button) => button.addEventListener('click', () => setSection(button.dataset.section)));
el.paymentFilters.forEach((button) => button.addEventListener('click', async () => {
  state.paymentFilter = button.dataset.filter;
  el.paymentFilters.forEach((node) => node.classList.toggle('active', node === button));
  await loadState();
}));
el.supportFilters.forEach((button) => button.addEventListener('click', async () => {
  state.supportFilter = button.dataset.filter;
  el.supportFilters.forEach((node) => node.classList.toggle('active', node === button));
  await loadState();
}));
el.refreshPayments.addEventListener('click', loadState);
el.refreshSupport.addEventListener('click', loadState);
el.generateCodeBtn.addEventListener('click', async () => {
  const rawInput = el.codeInput.value.trim();
  if (!rawInput) return;
  const result = await api('/api/codes/generate', {
    method: 'POST',
    body: JSON.stringify({ rawInput })
  });
  el.generatedCodeResult.innerHTML = `<strong>${result.token}</strong><p>${result.titles.join(', ') || 'Sin nombres'}${result.numericIds.length ? ` • AppIDs: ${result.numericIds.join(', ')}` : ''}</p>`;
  el.codeInput.value = '';
  await loadState();
  setSection('codes');
});

loadState().catch((error) => {
  console.error(error);
  el.generatedCodeResult.textContent = 'Error cargando la app local.';
});
