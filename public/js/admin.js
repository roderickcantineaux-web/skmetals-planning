'use strict';

// ── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAY_NAMES_FULL  = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const MONTH_NAMES     = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTH_NAMES_FULL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateNL(str) {
  const d = parseDateLocal(str);
  return `${d.getDate()} ${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(str) {
  const d = parseDateLocal(str);
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function materialLabel(type) {
  return { 'e-motoren': 'E-motoren', 'kabels': 'Kabels', 'compressoren': 'Compressoren', 'rest': 'Restmateriaal' }[type] || type;
}

function statusLabel(s) {
  return { confirmed: 'Bevestigd', arrived: 'Aangekomen', completed: 'Afgerond', 'no-show': 'Niet verschenen', cancelled: 'Geannuleerd' }[s] || s;
}

// ── Toast ───────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast-${type}`;
  el.style.display = 'block';
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 3500);
}

// ── Auth ────────────────────────────────────────────────────────────────────

async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  window.location.href = '/admin';
}

// ── Page Navigation ─────────────────────────────────────────────────────────

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a[data-page]').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const link = document.querySelector(`.sidebar-nav a[data-page="${name}"]`);
  if (link) link.classList.add('active');
}

// ── Week View ───────────────────────────────────────────────────────────────

let currentMonday = getThisMonday();

function getThisMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getMondayOfDate(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function prevWeek() {
  currentMonday.setDate(currentMonday.getDate() - 7);
  loadWeek();
}

function nextWeek() {
  currentMonday.setDate(currentMonday.getDate() + 7);
  loadWeek();
}

function gotoToday() {
  currentMonday = getThisMonday();
  loadWeek();
}

async function loadWeek() {
  const start = dateStr(currentMonday);
  const friday = new Date(currentMonday);
  friday.setDate(currentMonday.getDate() + 4);

  // Update label
  const labelEl = document.getElementById('week-label');
  const startM = MONTH_NAMES[currentMonday.getMonth()];
  const endM   = MONTH_NAMES[friday.getMonth()];
  labelEl.textContent = startM === endM
    ? `${currentMonday.getDate()} – ${friday.getDate()} ${startM} ${currentMonday.getFullYear()}`
    : `${currentMonday.getDate()} ${startM} – ${friday.getDate()} ${endM} ${currentMonday.getFullYear()}`;

  // Update column headers
  for (let i = 0; i < 5; i++) {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    const th = document.getElementById('th-' + i);
    th.innerHTML = `${DAY_NAMES_FULL[d.getDay()]}<br><span style="font-size:12px;font-weight:400;opacity:0.8">${d.getDate()} ${MONTH_NAMES[d.getMonth()]}</span>`;
    th.dataset.date = dateStr(d);
  }

  try {
    const res = await fetch(`/admin/api/week?start=${start}`);
    const data = await res.json();
    renderWeekTable(data);
  } catch {
    showToast('Kon weekdata niet laden.', 'error');
  }
}

const SLOT_LABELS = ['07:00 - 09:00', '09:00 - 11:00', '11:00 - 13:00', '13:00 - 15:00', '15:00 - 17:00'];

function renderWeekTable(data) {
  const tbody = document.getElementById('week-body');
  tbody.innerHTML = '';

  for (let si = 0; si < 5; si++) {
    const tr = document.createElement('tr');

    // Slot label
    const labelTd = document.createElement('td');
    labelTd.className = 'slot-label';
    labelTd.textContent = SLOT_LABELS[si];
    tr.appendChild(labelTd);

    // Each day
    for (let di = 0; di < 5; di++) {
      const dayData = data.dates[di];
      const availability = dayData ? dayData.availability[si] : null;
      const bookings = dayData ? dayData.bookings.filter(b => b.slot_index === si) : [];

      const td = document.createElement('td');
      td.className = 'slot-cell';

      if (availability) {
        const total = availability.total;
        const max = availability.totalMax;
        const capacEl = document.createElement('div');
        capacEl.className = 'slot-capacity' + (total >= max ? ' full' : '');
        capacEl.textContent = `${total}/${max}`;
        td.appendChild(capacEl);
      }

      bookings.forEach(b => {
        const chip = document.createElement('div');
        chip.className = `booking-chip ${b.material_type} ${b.status === 'cancelled' ? 'cancelled' : ''}`;
        chip.title = `${b.company_name} | ${b.license_plate} | ${statusLabel(b.status)}`;

        let flags = '';
        if (b.is_priority) flags += '<span class="chip-priority" title="Prioriteit">★</span> ';
        if (b.is_walkin)   flags += '<span class="chip-walkin" title="Walk-in">W</span> ';

        chip.innerHTML = `${flags}${escHtml(b.company_name.length > 14 ? b.company_name.slice(0, 13) + '…' : b.company_name)}`;
        chip.addEventListener('click', () => showBookingDetail(b));
        td.appendChild(chip);
      });

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

// ── Day View ────────────────────────────────────────────────────────────────

async function loadDay(dateValue) {
  if (!dateValue) return;

  try {
    const res = await fetch(`/admin/api/day?date=${dateValue}`);
    const data = await res.json();
    renderDayView(data);
  } catch {
    showToast('Kon dagdata niet laden.', 'error');
  }
}

function renderDayView(data) {
  // Stats
  const statsEl = document.getElementById('day-stats');
  const active   = data.bookings.filter(b => b.status !== 'cancelled');
  const walkins  = active.filter(b => b.is_walkin);
  const cancelled = data.bookings.filter(b => b.status === 'cancelled');

  statsEl.innerHTML = `
    <div class="stat-card total">
      <div class="stat-value">${active.length}</div>
      <div class="stat-label">Actieve boekingen</div>
    </div>
    <div class="stat-card walkin">
      <div class="stat-value">${walkins.length}</div>
      <div class="stat-label">Walk-ins</div>
    </div>
    <div class="stat-card cancelled">
      <div class="stat-value">${cancelled.length}</div>
      <div class="stat-label">Geannuleerd</div>
    </div>
    <div class="stat-card confirmed">
      <div class="stat-value">${data.bookings.filter(b => b.status === 'arrived').length}</div>
      <div class="stat-label">Aangekomen</div>
    </div>
  `;

  // Slots
  const slotsEl = document.getElementById('day-slots');
  slotsEl.innerHTML = '';

  data.slots.forEach(slot => {
    const bookings = data.bookings.filter(b => b.slot_index === slot.index);
    const active = bookings.filter(b => b.status !== 'cancelled');

    const card = document.createElement('div');
    card.className = 'day-slot-card';

    card.innerHTML = `
      <div class="day-slot-header">
        <span class="slot-time">${slot.label}</span>
        <span class="slot-count">${active.length}/${slot.totalMax} wagens &nbsp;|&nbsp; `;

    // Type counts
    const parts = [];
    ['e-motoren', 'kabels', 'compressoren', 'rest'].forEach(type => {
      const cnt = active.filter(b => b.material_type === type).length;
      const max = slot.limits[type] || '?';
      if (cnt > 0 || max) parts.push(`${materialLabel(type)}: ${cnt}/${max}`);
    });
    card.querySelector('.day-slot-header').innerHTML += parts.join(' &nbsp;|&nbsp; ') + '</span></div>';

    if (bookings.length === 0) {
      card.innerHTML += '<div class="day-slot-empty">Geen boekingen</div>';
    } else {
      const list = document.createElement('div');
      list.className = 'day-slot-bookings';
      bookings.forEach(b => {
        list.appendChild(renderBookingRow(b));
      });
      card.appendChild(list);
    }

    slotsEl.appendChild(card);
  });
}

function renderBookingRow(b) {
  const row = document.createElement('div');
  row.className = 'booking-row';
  row.innerHTML = `
    <div class="booking-row-type ${b.material_type}"></div>
    <div class="booking-row-info">
      <div class="booking-row-company">
        ${b.is_priority ? '<span style="color:#e74c3c" title="Prioriteit">★ </span>' : ''}
        ${escHtml(b.company_name)}
        ${b.is_walkin ? '<span style="font-size:11px;color:#888;font-style:italic"> (walk-in)</span>' : ''}
      </div>
      <div class="booking-row-meta">
        <span class="booking-row-plate">${escHtml(b.license_plate)}</span>
        &nbsp; ${escHtml(b.contact_person)} &nbsp;&bull;&nbsp; ${escHtml(b.phone)}
        &nbsp;&bull;&nbsp; ${materialLabel(b.material_type)}
      </div>
    </div>
    <div class="booking-row-actions">
      <span class="status-badge status-${b.status}">${statusLabel(b.status)}</span>
    </div>
  `;
  row.addEventListener('click', () => showBookingDetail(b));
  return row;
}

// ── Booking Detail Modal ────────────────────────────────────────────────────

let currentDetailBooking = null;

function showBookingDetail(b) {
  currentDetailBooking = b;
  document.getElementById('detail-title').textContent = `Boeking #${b.id} – ${b.company_name}`;

  const cancelBtn = document.getElementById('detail-cancel-btn');
  cancelBtn.style.display = (b.status === 'cancelled') ? 'none' : '';

  document.getElementById('detail-body').innerHTML = `
    <div style="display:grid;gap:10px;font-size:14px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="status-badge status-${b.status}">${statusLabel(b.status)}</span>
        ${b.is_priority ? '<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">★ PRIORITEIT</span>' : ''}
        ${b.is_walkin ? '<span style="background:#e8f4fd;color:#1565c0;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">WALK-IN</span>' : ''}
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${detailRow('Datum', formatDateNL(b.booking_date))}
        ${detailRow('Tijdslot', `<strong style="color:#e63946;font-size:16px">${b.slot_time}</strong>`)}
        ${detailRow('Bedrijf', escHtml(b.company_name))}
        ${detailRow('Contactpersoon', escHtml(b.contact_person))}
        ${detailRow('E-mail', `<a href="mailto:${escHtml(b.email)}" style="color:#e63946">${escHtml(b.email)}</a>`)}
        ${detailRow('Telefoon', escHtml(b.phone))}
        ${detailRow('Kenteken', `<span style="font-family:monospace;font-weight:700">${escHtml(b.license_plate)}</span>`)}
        ${detailRow('Materiaaltype', materialLabel(b.material_type))}
        ${b.notes ? detailRow('Opmerking', escHtml(b.notes)) : ''}
        ${detailRow('Aangemeld', new Date(b.created_at).toLocaleString('nl-NL'))}
      </table>

      ${b.status !== 'cancelled' ? `
      <div style="margin-top:8px">
        <label style="font-size:12px;font-weight:600;color:#555">Status wijzigen:</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <button class="btn btn-xs btn-outline" onclick="changeStatus(${b.id}, 'confirmed')">Bevestigd</button>
          <button class="btn btn-xs btn-success" onclick="changeStatus(${b.id}, 'arrived')">Aangekomen</button>
          <button class="btn btn-xs btn-secondary" onclick="changeStatus(${b.id}, 'completed')">Afgerond</button>
          <button class="btn btn-xs btn-danger" onclick="changeStatus(${b.id}, 'no-show')">Niet verschenen</button>
        </div>
      </div>` : ''}
    </div>
  `;

  openModal('modal-detail');
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:7px 0;color:#888;width:38%;font-size:13px;vertical-align:top">${label}</td>
    <td style="padding:7px 0;font-size:13px">${value}</td>
  </tr>`;
}

async function cancelBookingFromDetail() {
  if (!currentDetailBooking) return;
  if (!confirm(`Boeking #${currentDetailBooking.id} van ${currentDetailBooking.company_name} annuleren?`)) return;

  try {
    const res = await fetch(`/admin/api/bookings/${currentDetailBooking.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('Boeking geannuleerd.', 'success');
    closeModal('modal-detail');
    refreshCurrentView();
  } catch {
    showToast('Kon boeking niet annuleren.', 'error');
  }
}

async function changeStatus(id, status) {
  try {
    const res = await fetch(`/admin/api/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error();
    showToast(`Status gewijzigd naar: ${statusLabel(status)}`, 'success');
    closeModal('modal-detail');
    refreshCurrentView();
  } catch {
    showToast('Kon status niet wijzigen.', 'error');
  }
}

function refreshCurrentView() {
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-week') loadWeek();
  if (activePage && activePage.id === 'page-day') {
    const picker = document.getElementById('day-date-picker');
    if (picker.value) loadDay(picker.value);
  }
}

// ── Add Booking Modal ───────────────────────────────────────────────────────

function openAddModal() {
  document.getElementById('add-booking-form').reset();
  document.getElementById('add-booking-error').style.display = 'none';
  // Pre-fill date from current view
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-day') {
    const picker = document.getElementById('day-date-picker');
    if (picker.value) {
      document.querySelector('#add-booking-form [name="desired_date"]').value = picker.value;
    }
  }
  openModal('modal-add');
}

async function submitAddBooking() {
  const form = document.getElementById('add-booking-form');
  const errorEl = document.getElementById('add-booking-error');
  const btn = document.getElementById('add-booking-btn');
  errorEl.style.display = 'none';

  const getData = n => form.querySelector(`[name="${n}"]`);
  const fields = ['company_name', 'contact_person', 'email', 'phone', 'license_plate', 'material_type', 'desired_date'];
  for (const f of fields) {
    if (!getData(f).value.trim()) {
      errorEl.textContent = `Veld "${f.replace('_', ' ')}" is verplicht.`;
      errorEl.style.display = 'block';
      getData(f).focus();
      return;
    }
  }

  const body = {
    company_name:   getData('company_name').value.trim(),
    contact_person: getData('contact_person').value.trim(),
    email:          getData('email').value.trim(),
    phone:          getData('phone').value.trim(),
    license_plate:  getData('license_plate').value.trim().toUpperCase(),
    material_type:  getData('material_type').value,
    desired_date:   getData('desired_date').value,
    slot_index:     getData('slot_index').value,
    notes:          getData('notes').value.trim(),
    is_walkin:      getData('is_walkin').checked,
    is_priority:    getData('is_priority').checked,
    send_email:     getData('send_email').checked,
  };

  btn.disabled = true;
  btn.textContent = 'Bezig...';

  try {
    const res = await fetch('/admin/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Fout bij opslaan.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Boeking toevoegen';
      return;
    }

    showToast(`Boeking toegevoegd: #${data.booking.id} – ${data.booking.slot_time}`, 'success');
    closeModal('modal-add');
    refreshCurrentView();
  } catch {
    errorEl.textContent = 'Verbindingsfout. Probeer opnieuw.';
    errorEl.style.display = 'block';
  }

  btn.disabled = false;
  btn.textContent = 'Boeking toevoegen';
}

// ── Limits Modal ────────────────────────────────────────────────────────────

async function openLimitsModal() {
  try {
    const res = await fetch('/admin/api/limits');
    const data = await res.json();
    data.limits.forEach(l => {
      const el = document.getElementById('limit-' + l.material_type);
      if (el) el.value = l.max_per_slot;
    });
    document.getElementById('limit-total').value = data.total_max;
  } catch {
    showToast('Kon limieten niet laden.', 'error');
    return;
  }
  document.getElementById('limits-error').style.display = 'none';
  openModal('modal-limits');
}

async function saveLimits() {
  const errorEl = document.getElementById('limits-error');
  errorEl.style.display = 'none';

  const limits = {
    'e-motoren':    parseInt(document.getElementById('limit-e-motoren').value),
    'kabels':       parseInt(document.getElementById('limit-kabels').value),
    'compressoren': parseInt(document.getElementById('limit-compressoren').value),
    'rest':         parseInt(document.getElementById('limit-rest').value),
  };
  const total_max = parseInt(document.getElementById('limit-total').value);

  for (const [k, v] of Object.entries(limits)) {
    if (isNaN(v) || v < 0) {
      errorEl.textContent = `Ongeldige waarde voor ${k}.`;
      errorEl.style.display = 'block';
      return;
    }
  }

  try {
    const res = await fetch('/admin/api/limits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limits, total_max }),
    });
    if (!res.ok) throw new Error();
    showToast('Limieten opgeslagen.', 'success');
    closeModal('modal-limits');
  } catch {
    errorEl.textContent = 'Kon limieten niet opslaan.';
    errorEl.style.display = 'block';
  }
}

// ── Modal Helpers ───────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ── Init ────────────────────────────────────────────────────────────────────

// Set today as default for day picker
const today = new Date();
const todayStr = dateStr(today);
document.getElementById('day-date-picker').value = todayStr;

// Load week on startup
loadWeek();
