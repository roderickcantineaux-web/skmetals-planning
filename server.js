require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./database');
const bookingRoutes = require('./routes/booking');
const adminRoutes = require('./routes/admin');
const { startReminderCron } = require('./services/reminders');

const app = express();
const PORT = process.env.PORT || 3000; // Railway stelt PORT in via env; 3000 is alleen voor lokaal

initDatabase();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'skmetals-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

app.use('/api', bookingRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

startReminderCron();

app.listen(PORT, () => {
  console.log(`\nSK Metals losplanning draait op http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin\n`);
});
