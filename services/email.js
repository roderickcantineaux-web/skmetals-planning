require('dotenv').config();
const nodemailer = require('nodemailer');

const SK_ADDRESS = 'Ziegelstrasse 64, 47533 Kleve, Duitsland';

const MATERIAL_NAMES = {
  'e-motoren': 'E-motoren',
  'kabels': 'Kabels',
  'compressoren': 'Compressoren',
  'rest': 'Restmateriaal',
};

function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = port === 465;
  console.log(`[SMTP] host=${process.env.SMTP_HOST} port=${port} secure=${secure} user=${process.env.SMTP_USER} pass=${process.env.SMTP_PASS ? 'set' : 'MISSING'}`);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: true,
  });
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
}

function baseLayout(title, content) {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:'Open Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:30px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;max-width:600px;box-shadow:0 4px 24px rgba(26,48,96,0.12);">
      <tr>
        <td style="background:#1a3060;padding:20px 32px;">
          <table width="100%"><tr>
            <td>
              <img src="https://www.skmetals.de/logo.jpg" alt="SK Metals" height="40" style="display:block;background:white;border-radius:4px;padding:4px 8px;" onerror="this.style.display='none'">
              <p style="margin:8px 0 0;color:#7a9cc0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${title}</p>
            </td>
            <td align="right" style="vertical-align:top;">
              <span style="background:#47b8d4;color:white;font-size:11px;font-weight:700;padding:4px 10px;border-radius:3px;letter-spacing:1px;">KLEVE</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="height:4px;background:linear-gradient(90deg,#1a3060,#47b8d4);"></td>
      </tr>
      <tr><td style="padding:32px;">${content}</td></tr>
      <tr>
        <td style="background:#f5f7fb;padding:16px 32px;text-align:center;font-size:12px;color:#888;border-top:1px solid #dde2ee;">
          <strong style="color:#1a3060;">SK Metals GmbH</strong> &nbsp;|&nbsp; ${SK_ADDRESS}
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

async function sendBookingConfirmation(booking) {
  const transporter = createTransporter();
  const materialName = MATERIAL_NAMES[booking.material_type] || booking.material_type;

  const content = `
    <p style="color:#333;font-size:16px;">Beste <strong>${booking.contact_person}</strong>,</p>
    <p style="color:#555;">Uw losafspraak bij SK Metals is bevestigd. Hieronder vindt u de details:</p>

    <div style="background:#f5f7fb;border-left:4px solid #47b8d4;padding:20px;border-radius:4px;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#888;width:45%;font-size:14px;">Boekingnummer</td>
            <td style="padding:8px 0;font-weight:bold;font-size:14px;">#${booking.id}</td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:14px;">Bedrijf</td>
            <td style="padding:8px 0;font-size:14px;">${booking.company_name}</td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:14px;">Kenteken</td>
            <td style="padding:8px 0;font-size:14px;font-family:monospace;">${booking.license_plate}</td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:14px;">Materiaaltype</td>
            <td style="padding:8px 0;font-size:14px;">${materialName}</td></tr>
        <tr style="border-top:1px solid #e0e0e0;">
            <td style="padding:12px 0 8px;color:#888;font-size:14px;">Datum</td>
            <td style="padding:12px 0 8px;font-weight:bold;font-size:16px;color:#1a3060;">${formatDate(booking.booking_date)}</td></tr>
        <tr><td style="padding:4px 0 8px;color:#888;font-size:14px;">Tijdslot</td>
            <td style="padding:4px 0 8px;font-weight:bold;font-size:18px;color:#47b8d4;">${booking.slot_time}</td></tr>
      </table>
    </div>

    <div style="background:#f0f6fb;border:1px solid #b0d8ea;border-radius:4px;padding:16px;margin:24px 0;">
      <strong style="color:#1a3060;">&#9888; Belangrijke informatie</strong>
      <ul style="margin:8px 0;padding-left:20px;color:#555;font-size:14px;">
        <li>Meld u aan bij de receptie bij aankomst</li>
        <li>Kom op tijd &ndash; bij meer dan <strong>30 minuten vertraging</strong> kan uw slot vervallen</li>
        <li>Zorg dat uw kenteken klopt zoals opgegeven</li>
      </ul>
    </div>

    <p style="color:#555;font-size:14px;"><strong>Adres:</strong><br>${SK_ADDRESS}</p>
    <p style="color:#555;font-size:14px;">Vragen? Neem contact met ons op via <a href="mailto:${process.env.FROM_EMAIL}" style="color:#47b8d4;">${process.env.FROM_EMAIL}</a>.</p>
    <p style="color:#333;font-size:14px;margin-top:24px;">Met vriendelijke groet,<br><strong>SK Metals Team</strong></p>
  `;

  console.log(`[SMTP] Bevestiging versturen naar ${booking.email} voor boeking #${booking.id}`);
  const info = await transporter.sendMail({
    from: `"SK Metals" <${process.env.FROM_EMAIL}>`,
    to: booking.email,
    subject: `Bevestiging boeking #${booking.id} – ${formatDate(booking.booking_date)} ${booking.slot_time}`,
    html: baseLayout('Boekingsbevestiging', content),
  });
  console.log(`[SMTP] Bevestiging verstuurd: messageId=${info.messageId} response=${info.response}`);
}

async function sendReminder(booking) {
  const transporter = createTransporter();
  const materialName = MATERIAL_NAMES[booking.material_type] || booking.material_type;

  const content = `
    <p style="color:#333;font-size:16px;">Beste <strong>${booking.contact_person}</strong>,</p>
    <p style="color:#555;">Dit is een herinnering voor uw losafspraak bij SK Metals <strong>morgen</strong>.</p>

    <div style="background:#f0f9f0;border-left:4px solid #2ecc71;padding:20px;border-radius:4px;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#888;width:45%;font-size:14px;">Bedrijf</td>
            <td style="padding:8px 0;font-size:14px;">${booking.company_name}</td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:14px;">Kenteken</td>
            <td style="padding:8px 0;font-family:monospace;font-size:14px;">${booking.license_plate}</td></tr>
        <tr><td style="padding:8px 0;color:#888;font-size:14px;">Materiaaltype</td>
            <td style="padding:8px 0;font-size:14px;">${materialName}</td></tr>
        <tr style="border-top:1px solid #c8e6c9;">
            <td style="padding:12px 0 8px;color:#888;font-size:14px;">Datum</td>
            <td style="padding:12px 0 8px;font-weight:bold;font-size:16px;color:#1a3060;">${formatDate(booking.booking_date)}</td></tr>
        <tr><td style="padding:4px 0 8px;color:#888;font-size:14px;">Tijdslot</td>
            <td style="padding:4px 0 8px;font-weight:bold;font-size:20px;color:#47b8d4;">${booking.slot_time}</td></tr>
      </table>
    </div>

    <div style="background:#e8f4fd;border:1px solid #90caf9;border-radius:4px;padding:16px;margin:24px 0;">
      <strong style="color:#1565c0;">&#128205; Adres SK Metals</strong><br>
      <span style="color:#555;font-size:14px;">${SK_ADDRESS}</span>
    </div>

    <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:4px;padding:12px 16px;margin:16px 0;">
      <span style="color:#e65100;font-size:14px;">&#9888; Bij meer dan 30 minuten vertraging kan uw tijdslot vervallen.</span>
    </div>

    <p style="color:#333;font-size:14px;margin-top:24px;">Tot morgen!<br><strong>SK Metals Team</strong></p>
  `;

  console.log(`[SMTP] Herinnering versturen naar ${booking.email} voor boeking #${booking.id}`);
  const info = await transporter.sendMail({
    from: `"SK Metals" <${process.env.FROM_EMAIL}>`,
    to: booking.email,
    subject: `Herinnering: losafspraak morgen ${formatDate(booking.booking_date)} – ${booking.slot_time}`,
    html: baseLayout('Herinnering losafspraak', content),
  });
  console.log(`[SMTP] Herinnering verstuurd: messageId=${info.messageId} response=${info.response}`);
}

module.exports = { sendBookingConfirmation, sendReminder, formatDate };
