'use strict';

const DAY_NAMES   = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTH_NAMES = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
                     'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function formatDateNL(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function materialLabel(type) {
  return { 'e-motoren': 'E-motoren', 'kabels': 'Kabels', 'compressoren': 'Compressoren', 'rest': 'Restmateriaal' }[type] || type;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Datum ────────────────────────────────────────────────────────────────────

function initDatePicker() {
  const input = document.getElementById('desired_date');
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  input.min = `${y}-${m}-${d}`;
}

// ── Slot Picker ──────────────────────────────────────────────────────────────

let slotTimer       = null;
let currentSlot     = null;   // { index, label } van gekozen slot
let lastFetchDate   = null;   // om onnodige fetches te vermijden
let lastFetchType   = null;

function scheduleSlotUpdate() {
  clearTimeout(slotTimer);
  slotTimer = setTimeout(updateSlotPicker, 350);
}

async function updateSlotPicker() {
  const date         = document.getElementById('desired_date').value;
  const materialType = document.getElementById('material_type').value;
  const container    = document.getElementById('slot-picker-container');
  const msgEl        = document.getElementById('slot-picker-msg');
  const picker       = document.getElementById('slot-picker');

  // Reset selectie wanneer datum of type wijzigt
  currentSlot = null;

  // Nog niet beide velden ingevuld
  if (!date || !materialType) {
    container.classList.add('hidden');
    if (!date && !materialType) {
      msgEl.classList.add('hidden');
    } else {
      msgEl.className = 'slot-preview not-working';
      msgEl.classList.remove('hidden');
      msgEl.innerHTML = 'Selecteer een <strong>datum</strong> en <strong>materiaaltype</strong> om de beschikbare tijdslots te zien.';
    }
    return;
  }

  // Hetzelfde verzoek als vorige keer — sla over
  if (date === lastFetchDate && materialType === lastFetchType) return;

  lastFetchDate = date;
  lastFetchType = materialType;

  // Laadstatus tonen
  msgEl.classList.add('hidden');
  container.classList.remove('hidden');
  document.getElementById('slot-picker-date-label').textContent = formatDateNL(date);
  picker.innerHTML = '<div class="slot-picker-loading">Beschikbaarheid laden…</div>';

  try {
    const res  = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
    const data = await res.json();

    if (!data.working_day) {
      container.classList.add('hidden');
      msgEl.className = 'slot-preview not-working';
      msgEl.classList.remove('hidden');
      msgEl.innerHTML = '🚫 Geen werkdag — kies een maandag t/m vrijdag.';
      return;
    }

    renderSlotPicker(picker, data.slots, data.limits, materialType);
  } catch {
    container.classList.add('hidden');
    msgEl.className = 'slot-preview unavailable';
    msgEl.classList.remove('hidden');
    msgEl.innerHTML = '⚠️ Kon beschikbaarheid niet laden. Probeer het opnieuw.';
    lastFetchDate = null; // volgende poging mag opnieuw fetchen
  }
}

function getTypeMax(limits, materialType) {
  const found = limits.find(l => l.material_type === materialType);
  return found ? found.max_per_slot : 3;
}

function renderSlotPicker(container, slots, limits, materialType) {
  const typeMax = getTypeMax(limits, materialType);
  container.innerHTML = '';

  slots.forEach(slot => {
    const typeCount     = (slot.typeCount && slot.typeCount[materialType]) || 0;
    const totalUsed     = slot.total;
    const totalMax      = slot.totalMax;
    const typeRemaining = typeMax - typeCount;
    const totalRemaining = totalMax - totalUsed;
    const spotsLeft     = Math.min(totalRemaining, typeRemaining);

    const totalFull    = totalUsed >= totalMax;
    const typeFull     = typeCount >= typeMax;
    const disabled     = totalFull || typeFull;

    const card = document.createElement('div');
    card.className = 'slot-card' + (disabled ? ' slot-card--disabled' : '');
    card.dataset.index = slot.index;

    // Tijdlabel: splits op spatie-streepje-spatie
    const [startTime, endTime] = slot.label.split(' - ');

    let bodyHtml = '';

    if (disabled) {
      if (totalFull) {
        bodyHtml = '<span class="slot-badge slot-badge--full">Slot vol</span>';
      } else {
        bodyHtml = `<span class="slot-badge slot-badge--type-full">Type vol</span>`
                 + `<div class="slot-card-type-info">${materialLabel(materialType)}<br>${typeCount}/${typeMax} bezet</div>`;
      }
    } else {
      const spotsClass = spotsLeft <= 1 ? 'slot-card-spots slot-card-spots--low' : 'slot-card-spots';
      const spotsText  = spotsLeft === 1 ? '1 plek vrij' : `${spotsLeft} plekken vrij`;
      bodyHtml = `<div class="${spotsClass}">${spotsText}</div>`
               + `<div class="slot-card-type-info">${materialLabel(materialType)}<br>${typeCount}/${typeMax} bezet</div>`;
    }

    card.innerHTML = `
      <div class="slot-card-time">${escHtml(startTime)}<br>${escHtml(endTime)}</div>
      ${bodyHtml}
    `;

    if (!disabled) {
      card.addEventListener('click', () => selectSlot(slot.index, slot.label, card));
    }

    container.appendChild(card);
  });
}

function selectSlot(index, label, clickedCard) {
  currentSlot = { index, label };

  document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('slot-card--selected'));
  clickedCard.classList.add('slot-card--selected');
}

// ── Formulier validatie & verzenden ──────────────────────────────────────────

function validateForm() {
  const required = [
    ['company_name',   'Bedrijfsnaam'],
    ['contact_person', 'Contactpersoon'],
    ['email',          'E-mailadres'],
    ['phone',          'Telefoonnummer'],
    ['license_plate',  'Kenteken'],
    ['material_type',  'Materiaaltype'],
    ['desired_date',   'Datum'],
  ];

  for (const [id, label] of required) {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.focus();
      showToast(`Vul het veld "${label}" in.`, 'error');
      return false;
    }
  }

  const emailVal = document.getElementById('email').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    document.getElementById('email').focus();
    showToast('Voer een geldig e-mailadres in.', 'error');
    return false;
  }

  if (!currentSlot) {
    showToast('Kies een tijdslot voordat u de boeking bevestigt.', 'error');
    document.getElementById('slot-picker-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  return true;
}

document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Moment…';

  const body = {
    company_name:   document.getElementById('company_name').value.trim(),
    contact_person: document.getElementById('contact_person').value.trim(),
    email:          document.getElementById('email').value.trim(),
    phone:          document.getElementById('phone').value.trim(),
    license_plate:  document.getElementById('license_plate').value.trim().toUpperCase(),
    material_type:  document.getElementById('material_type').value,
    desired_date:   document.getElementById('desired_date').value,
    slot_index:     currentSlot.index,
    notes:          document.getElementById('notes').value.trim(),
  };

  try {
    const res  = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      // Bij 409 (slot inmiddels vol): picker verversen
      if (res.status === 409) {
        showToast(data.error, 'error');
        currentSlot = null;
        lastFetchDate = null;
        lastFetchType = null;
        await updateSlotPicker();
      } else {
        showToast(data.error || 'Er is een fout opgetreden.', 'error');
      }
      btn.disabled = false;
      btn.textContent = 'Tijdslot reserveren';
      return;
    }

    showConfirmation(data, body);
  } catch {
    showToast('Verbindingsfout. Controleer uw internetverbinding.', 'error');
    btn.disabled = false;
    btn.textContent = 'Tijdslot reserveren';
  }
});

// ── Bevestigingsscherm ───────────────────────────────────────────────────────

function showConfirmation(result, formData) {
  document.getElementById('booking-form-container').classList.add('hidden');

  document.getElementById('confirmation-details').innerHTML = `
    <div class="detail-row"><span class="detail-label">Boekingnummer</span><span class="detail-value">#${result.booking_id}</span></div>
    <div class="detail-row"><span class="detail-label">Bedrijf</span><span class="detail-value">${escHtml(formData.company_name)}</span></div>
    <div class="detail-row"><span class="detail-label">Contactpersoon</span><span class="detail-value">${escHtml(formData.contact_person)}</span></div>
    <div class="detail-row"><span class="detail-label">Kenteken</span><span class="detail-value" style="font-family:monospace">${escHtml(formData.license_plate)}</span></div>
    <div class="detail-row"><span class="detail-label">Materiaaltype</span><span class="detail-value">${materialLabel(formData.material_type)}</span></div>
    <div class="detail-row"><span class="detail-label">Datum</span><span class="detail-value">${formatDateNL(result.booking_date)}</span></div>
    <div class="detail-row"><span class="detail-label">Tijdslot</span><span class="detail-value" style="color:var(--accent);font-size:18px;font-weight:700">${escHtml(result.slot_time)}</span></div>
  `;

  document.getElementById('alt-notice').classList.add('hidden');
  document.getElementById('confirmation-card').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('confirmation-card').classList.add('hidden');
  document.getElementById('booking-form-container').classList.remove('hidden');
  document.getElementById('booking-form').reset();
  document.getElementById('slot-picker-container').classList.add('hidden');
  document.getElementById('slot-picker-msg').classList.add('hidden');
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('submit-btn').textContent = 'Tijdslot reserveren';
  currentSlot   = null;
  lastFetchDate = null;
  lastFetchType = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Toast ────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, type = 'error') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast-${type}`;
  el.style.display  = 'block';
  el.style.opacity  = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 4500);
}

// ── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('desired_date').addEventListener('change', () => {
  lastFetchDate = null; // forceer refresh
  scheduleSlotUpdate();
});

document.getElementById('material_type').addEventListener('change', () => {
  lastFetchType = null; // forceer refresh
  scheduleSlotUpdate();
});

initDatePicker();
