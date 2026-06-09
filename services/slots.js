const { getDb } = require('../database');

const SLOT_TIMES = [
  { index: 0, start: '07:00', end: '09:00', label: '07:00 - 09:00' },
  { index: 1, start: '09:00', end: '11:00', label: '09:00 - 11:00' },
  { index: 2, start: '11:00', end: '13:00', label: '11:00 - 13:00' },
  { index: 3, start: '13:00', end: '15:00', label: '13:00 - 15:00' },
  { index: 4, start: '15:00', end: '17:00', label: '15:00 - 17:00' },
];

function isWorkingDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNextWorkingDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  while (!isWorkingDay(localDateStr(date))) {
    date.setDate(date.getDate() + 1);
  }
  return localDateStr(date);
}

function getSlotAvailability(dateStr) {
  const db = getDb();

  const limits = db.prepare('SELECT material_type, max_per_slot FROM slot_limits').all();
  const limitMap = {};
  for (const l of limits) limitMap[l.material_type] = l.max_per_slot;

  const totalMaxRow = db.prepare("SELECT value FROM settings WHERE key = 'max_per_slot_total'").get();
  const totalMax = parseInt(totalMaxRow ? totalMaxRow.value : '6');

  const bookings = db.prepare(`
    SELECT slot_index, material_type, COUNT(*) as count
    FROM bookings
    WHERE booking_date = ? AND status != 'cancelled'
    GROUP BY slot_index, material_type
  `).all(dateStr);

  return SLOT_TIMES.map(slot => {
    const slotBookings = bookings.filter(b => b.slot_index === slot.index);
    const totalCount = slotBookings.reduce((sum, b) => sum + b.count, 0);
    const typeCount = {};
    for (const b of slotBookings) typeCount[b.material_type] = b.count;

    return {
      ...slot,
      total: totalCount,
      totalMax,
      typeCount,
      limits: limitMap,
      isFull: totalCount >= totalMax,
    };
  });
}

function findAvailableSlot(dateStr, materialType) {
  if (!isWorkingDay(dateStr)) return null;

  const db = getDb();
  const limitRow = db.prepare('SELECT max_per_slot FROM slot_limits WHERE material_type = ?').get(materialType);
  const typeMax = limitRow ? limitRow.max_per_slot : 3;

  const slots = getSlotAvailability(dateStr);
  for (const slot of slots) {
    const typeCount = slot.typeCount[materialType] || 0;
    if (!slot.isFull && typeCount < typeMax) {
      return { date: dateStr, slot };
    }
  }
  return null;
}

function findNextAvailableSlot(desiredDate, materialType, maxDaysAhead = 14) {
  const result = findAvailableSlot(desiredDate, materialType);
  if (result) return { ...result, isAlternative: false };

  let currentDate = desiredDate;
  for (let i = 0; i < maxDaysAhead; i++) {
    currentDate = getNextWorkingDay(currentDate);
    const alt = findAvailableSlot(currentDate, materialType);
    if (alt) return { ...alt, isAlternative: true, originalDate: desiredDate };
  }

  return null;
}

function createBooking(data) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO bookings (
      company_name, contact_person, email, phone, license_plate,
      material_type, booking_date, slot_index, slot_time, notes,
      status, is_walkin, is_priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.company_name,
    data.contact_person,
    data.email,
    data.phone,
    data.license_plate,
    data.material_type,
    data.booking_date,
    data.slot_index,
    data.slot_time,
    data.notes || '',
    data.status || 'confirmed',
    data.is_walkin ? 1 : 0,
    data.is_priority ? 1 : 0
  );
  return result.lastInsertRowid;
}

module.exports = {
  SLOT_TIMES,
  isWorkingDay,
  getNextWorkingDay,
  getSlotAvailability,
  findAvailableSlot,
  findNextAvailableSlot,
  createBooking,
};
