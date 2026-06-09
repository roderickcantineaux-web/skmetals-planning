const express = require('express');
const router = express.Router();
const { findNextAvailableSlot, createBooking, getSlotAvailability, isWorkingDay } = require('../services/slots');
const { sendBookingConfirmation } = require('../services/email');
const { getDb } = require('../database');

const VALID_TYPES = ['e-motoren', 'kabels', 'compressoren', 'rest'];

// Check beschikbaarheid voor een datum
router.get('/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Datum is verplicht' });

  if (!isWorkingDay(date)) {
    return res.json({ working_day: false, message: 'Dit is geen werkdag (ma t/m vr)' });
  }

  const slots = getSlotAvailability(date);
  const db = getDb();
  const limits = db.prepare('SELECT * FROM slot_limits').all();

  return res.json({ working_day: true, slots, limits, date });
});

// Zoek eerstvolgende beschikbare slot
router.get('/next-slot', (req, res) => {
  const { date, material_type } = req.query;

  if (!date || !material_type) {
    return res.status(400).json({ error: 'Datum en materiaaltype zijn verplicht' });
  }
  if (!VALID_TYPES.includes(material_type)) {
    return res.status(400).json({ error: 'Ongeldig materiaaltype' });
  }

  const result = findNextAvailableSlot(date, material_type);
  if (!result) {
    return res.json({ available: false, message: 'Geen beschikbare slots in de komende 14 werkdagen' });
  }

  return res.json({ available: true, ...result });
});

// Nieuwe boeking aanmaken
router.post('/bookings', async (req, res) => {
  const { company_name, contact_person, email, phone, license_plate, material_type, desired_date, slot_index, notes } = req.body;

  if (!company_name || !contact_person || !email || !phone || !license_plate || !material_type || !desired_date) {
    return res.status(400).json({ error: 'Alle verplichte velden moeten ingevuld zijn' });
  }
  if (!VALID_TYPES.includes(material_type)) {
    return res.status(400).json({ error: 'Ongeldig materiaaltype' });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return res.status(400).json({ error: 'Ongeldig e-mailadres' });
  }

  const { SLOT_TIMES } = require('../services/slots');
  const db = getDb();
  let bookingDate, bookingSlot;

  if (slot_index !== undefined && slot_index !== null && slot_index !== '') {
    // Leverancier heeft zelf een slot gekozen — valideer of het nog beschikbaar is
    const slotIdx = parseInt(slot_index);
    bookingSlot = SLOT_TIMES[slotIdx];
    if (!bookingSlot) return res.status(400).json({ error: 'Ongeldig tijdslot geselecteerd' });

    const limitRow = db.prepare('SELECT max_per_slot FROM slot_limits WHERE material_type = ?').get(material_type);
    const typeMax = limitRow ? limitRow.max_per_slot : 3;
    const totalMaxRow = db.prepare("SELECT value FROM settings WHERE key = 'max_per_slot_total'").get();
    const totalMax = parseInt(totalMaxRow ? totalMaxRow.value : '6');

    const totalCount = db.prepare(
      "SELECT COUNT(*) as c FROM bookings WHERE booking_date = ? AND slot_index = ? AND status != 'cancelled'"
    ).get(desired_date, slotIdx).c;
    const typeCount = db.prepare(
      "SELECT COUNT(*) as c FROM bookings WHERE booking_date = ? AND slot_index = ? AND material_type = ? AND status != 'cancelled'"
    ).get(desired_date, slotIdx, material_type).c;

    if (totalCount >= totalMax) {
      return res.status(409).json({ error: 'Dit tijdslot is inmiddels vol. Ververs de pagina en kies een ander slot.' });
    }
    if (typeCount >= typeMax) {
      return res.status(409).json({ error: `Het maximaal aantal voor ${material_type} in dit tijdslot is bereikt. Kies een ander slot.` });
    }

    bookingDate = desired_date;
  } else {
    // Geen slot gekozen — automatisch toewijzen
    const slotResult = findNextAvailableSlot(desired_date, material_type);
    if (!slotResult) {
      return res.status(409).json({ error: 'Geen beschikbare slots gevonden in de komende 14 werkdagen' });
    }
    bookingDate = slotResult.date;
    bookingSlot = slotResult.slot;
  }

  const bookingId = createBooking({
    company_name: company_name.trim(),
    contact_person: contact_person.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    license_plate: license_plate.trim().toUpperCase(),
    material_type,
    booking_date: bookingDate,
    slot_index: bookingSlot.index,
    slot_time: bookingSlot.label,
    notes: (notes || '').trim(),
    status: 'confirmed',
    is_walkin: false,
    is_priority: false,
  });

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);

  try {
    await sendBookingConfirmation(booking);
  } catch (err) {
    console.error('[Email FOUT] Bevestiging niet verstuurd:', err.message);
  }

  res.json({
    success: true,
    booking_id: bookingId,
    booking_date: bookingDate,
    slot_time: bookingSlot.label,
  });
});

module.exports = router;
