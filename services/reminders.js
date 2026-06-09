const cron = require('node-cron');
const { getDb } = require('../database');
const { sendReminder } = require('./email');

function getTomorrowDateStr() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

async function sendDailyReminders() {
  const db = getDb();
  const tomorrowDate = getTomorrowDateStr();

  const bookings = db.prepare(
    "SELECT * FROM bookings WHERE booking_date = ? AND status = 'confirmed'"
  ).all(tomorrowDate);

  console.log(`[Herinneringen] ${tomorrowDate}: ${bookings.length} boeking(en) gevonden`);

  for (const booking of bookings) {
    try {
      await sendReminder(booking);
      console.log(`[Herinnering OK] #${booking.id} -> ${booking.email}`);
    } catch (err) {
      console.error(`[Herinnering FOUT] #${booking.id}:`, err.message);
    }
  }
}

function startReminderCron() {
  // Elke werkdag om 16:00 (Europe/Berlin = Kleve, Duitsland)
  cron.schedule('0 16 * * 1-5', async () => {
    console.log('[Cron] Dagelijkse herinneringen worden verstuurd...');
    await sendDailyReminders();
  }, { timezone: 'Europe/Berlin' });

  console.log('[Cron] Herinneringen gepland: werkdagen 16:00 (Europe/Berlin)');
}

module.exports = { startReminderCron, sendDailyReminders };
