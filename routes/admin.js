const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../database');
const { SLOT_TIMES, getSlotAvailability, createBooking, findNextAvailableSlot } = require('../services/slots');
const { sendBookingConfirmation } = require('../services/email');

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ error: 'Niet geautoriseerd' });
}

// Admin hoofdpagina
router.get('/', (req, res) => {
  if (!req.session || !req.session.admin) {
    return res.sendFile(path.join(__dirname, '../public', 'login.html'));
  }
  res.sendFile(path.join(__dirname, '../public', 'admin.html'));
});

// Inloggen
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === adminPassword) {
    req.session.admin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Onjuist wachtwoord' });
  }
});

// Uitloggen
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Auth status check
router.get('/auth-check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.admin) });
});

// Weekoverzicht
router.get('/api/week', requireAuth, (req, res) => {
  const { start } = req.query;
  if (!start) return res.status(400).json({ error: 'Start datum verplicht' });

  const db = getDb();
  const startDate = new Date(start + 'T00:00:00');
  const dates = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const bookings = db.prepare(`
      SELECT * FROM bookings WHERE booking_date = ?
      ORDER BY slot_index, is_priority DESC, created_at
    `).all(dateStr);

    const availability = getSlotAvailability(dateStr);

    dates.push({ date: dateStr, bookings, availability });
  }

  res.json({ dates, slots: SLOT_TIMES });
});

// Dagoverzicht
router.get('/api/day', requireAuth, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Datum verplicht' });

  const db = getDb();
  const bookings = db.prepare(`
    SELECT * FROM bookings WHERE booking_date = ?
    ORDER BY slot_index, is_priority DESC, created_at
  `).all(date);

  const availability = getSlotAvailability(date);

  res.json({ date, bookings, slots: availability });
});

// Admin boeking toevoegen
router.post('/api/bookings', requireAuth, async (req, res) => {
  const {
    company_name, contact_person, email, phone, license_plate,
    material_type, desired_date, slot_index, notes, is_walkin, is_priority, send_email,
  } = req.body;

  if (!company_name || !contact_person || !email || !phone || !license_plate || !material_type || !desired_date) {
    return res.status(400).json({ error: 'Alle verplichte velden moeten ingevuld zijn' });
  }

  let bookingDate = desired_date;
  let slot;

  if (slot_index !== undefined && slot_index !== null && slot_index !== '') {
    slot = SLOT_TIMES[parseInt(slot_index)];
    if (!slot) return res.status(400).json({ error: 'Ongeldig slot' });
  } else {
    const slotResult = findNextAvailableSlot(desired_date, material_type);
    if (!slotResult) return res.status(409).json({ error: 'Geen beschikbare slots gevonden' });
    bookingDate = slotResult.date;
    slot = slotResult.slot;
  }

  const bookingId = createBooking({
    company_name: company_name.trim(),
    contact_person: contact_person.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    license_plate: license_plate.trim().toUpperCase(),
    material_type,
    booking_date: bookingDate,
    slot_index: slot.index,
    slot_time: slot.label,
    notes: (notes || '').trim(),
    status: 'confirmed',
    is_walkin: !!is_walkin,
    is_priority: !!is_priority,
  });

  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

  if (send_email) {
    try {
      await sendBookingConfirmation(booking);
    } catch (err) {
      console.error('[Email FOUT]', err.message);
    }
  }

  res.json({ success: true, booking });
});

// Boeking annuleren
router.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Boeking niet gevonden' });

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Status bijwerken
router.patch('/api/bookings/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['confirmed', 'arrived', 'completed', 'no-show', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Ongeldige status' });

  const db = getDb();
  const booking = db.prepare('SELECT id FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Boeking niet gevonden' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Capaciteitslimieten ophalen
router.get('/api/limits', requireAuth, (req, res) => {
  const db = getDb();
  const limits = db.prepare('SELECT * FROM slot_limits').all();
  const totalMaxRow = db.prepare("SELECT value FROM settings WHERE key = 'max_per_slot_total'").get();
  res.json({ limits, total_max: parseInt(totalMaxRow ? totalMaxRow.value : '6') });
});

// Capaciteitslimieten aanpassen
router.put('/api/limits', requireAuth, (req, res) => {
  const { limits, total_max } = req.body;
  const db = getDb();

  if (limits && typeof limits === 'object') {
    const stmt = db.prepare('UPDATE slot_limits SET max_per_slot = ? WHERE material_type = ?');
    for (const [type, max] of Object.entries(limits)) {
      const val = parseInt(max);
      if (!isNaN(val) && val > 0) stmt.run(val, type);
    }
  }

  if (total_max !== undefined) {
    const val = parseInt(total_max);
    if (!isNaN(val) && val > 0) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'max_per_slot_total'").run(String(val));
    }
  }

  res.json({ success: true });
});

// Zoek/filter boekingen
router.get('/api/bookings', requireAuth, (req, res) => {
  const { date, status, q } = req.query;
  const db = getDb();

  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (date) { query += ' AND booking_date = ?'; params.push(date); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (q) {
    query += ' AND (company_name LIKE ? OR license_plate LIKE ? OR contact_person LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  query += ' ORDER BY booking_date DESC, slot_index, is_priority DESC';

  const bookings = db.prepare(query).all(...params);
  res.json({ bookings });
});

module.exports = router;
