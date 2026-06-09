# SK Metals – Losplanning

Webapplicatie voor het plannen van losafspraken bij SK Metals in Kleve, Duitsland.

## Functionaliteiten

- **Extern boekingsformulier** – leveranciers plannen zelf een tijdslot
- **Automatische slottoewijzing** – systeem vindt eerste vrije slot, of alternatief als de gewenste dag vol is
- **Bevestigingsmail** – direct na boeking via e-mail
- **Admin dashboard** – week- en dagoverzicht, boekingen beheren, capaciteit instellen
- **Dagelijkse herinneringen** – automatisch om 16:00 verstuurd naar leveranciers die de volgende dag een afspraak hebben

## Tijdslotstructuur

| Slot | Tijd |
|------|------|
| 1 | 07:00 – 09:00 |
| 2 | 09:00 – 11:00 |
| 3 | 11:00 – 13:00 |
| 4 | 13:00 – 15:00 |
| 5 | 15:00 – 17:00 |

**Standaard capaciteit per slot:**
- E-motoren: max 2
- Kabels: max 3
- Compressoren: max 2
- Restmateriaal: max 3
- Totaal: max 6 wagens per slot

Capaciteitslimieten zijn aanpasbaar via het admin dashboard.

## Vereisten

- **Node.js** v18 of hoger
- **npm** v8 of hoger

## Installatie

### 1. Repository klonen of bestanden kopiëren

```bash
cd skmetals-planning
```

### 2. Dependencies installeren

```bash
npm install
```

### 3. Omgevingsvariabelen instellen

Kopieer het voorbeeldbestand en vul uw gegevens in:

```bash
copy .env.example .env
```

Open `.env` en vul de SMTP-gegevens in:

```env
PORT=3000
SESSION_SECRET=verander-dit-naar-een-veilig-geheim

ADMIN_PASSWORD=admin123

SMTP_HOST=smtp.uw-provider.nl
SMTP_PORT=587
SMTP_USER=noreply@skmetals.de
SMTP_PASS=uw-smtp-wachtwoord
FROM_EMAIL=noreply@skmetals.de
```

### 4. Applicatie starten

**Productie:**
```bash
npm start
```

**Ontwikkelmodus (automatisch herstarten bij wijzigingen):**
```bash
npm run dev
```

De applicatie is nu beschikbaar op:
- **Boekingsformulier:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

## Admin dashboard

- **URL:** `/admin`
- **Standaard wachtwoord:** `admin123`

> Wijzig het wachtwoord via de `ADMIN_PASSWORD` variabele in `.env`.

### Functies admin dashboard

- **Weekoverzicht** – alle boekingen per dag/slot, kleurgecodeerd per materiaaltype
- **Dagoverzicht** – gedetailleerd overzicht per tijdslot met statussen
- **Boeking toevoegen** – inclusief walk-in vlag en prioriteit
- **Boeking annuleren** – via het detailvenster
- **Status wijzigen** – Bevestigd → Aangekomen → Afgerond / Niet verschenen
- **Capaciteit aanpassen** – limieten per type en totaal per slot

## E-mail configuratie

De applicatie gebruikt Nodemailer met SMTP. Stel de volgende variabelen in `.env` in:

| Variabele | Omschrijving |
|-----------|-------------|
| `SMTP_HOST` | SMTP-server adres (bijv. `smtp.gmail.com`) |
| `SMTP_PORT` | Poort: `587` (STARTTLS) of `465` (SSL) |
| `SMTP_USER` | SMTP-gebruikersnaam / e-mailadres |
| `SMTP_PASS` | SMTP-wachtwoord of app-wachtwoord |
| `FROM_EMAIL` | Afzenderadres (bijv. `noreply@skmetals.de`) |

### Gmail instellen

1. Schakel 2-factor authenticatie in op uw Google-account
2. Maak een **App-wachtwoord** aan via Mijn Account → Beveiliging → App-wachtwoorden
3. Gebruik dit app-wachtwoord als `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=uw@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
FROM_EMAIL=uw@gmail.com
```

## Herinneringen

Elke werkdag om 16:00 (Europe/Berlin) worden automatisch herinneringsmails verstuurd naar alle leveranciers met een boeking de volgende werkdag.

## Bestandsstructuur

```
skmetals-planning/
├── server.js              # Express-server (startpunt)
├── database.js            # SQLite initialisatie
├── routes/
│   ├── booking.js         # Publieke boekings-API
│   └── admin.js           # Admin API + authenticatie
├── services/
│   ├── slots.js           # Slotlogica & beschikbaarheidscheck
│   ├── email.js           # E-mailsjablonen & verzending
│   └── reminders.js       # Cron-job voor herinneringen
├── public/
│   ├── index.html         # Boekingsformulier
│   ├── login.html         # Admin inlogscherm
│   ├── admin.html         # Admin dashboard
│   ├── css/
│   │   ├── style.css      # Publieke stijlen
│   │   └── admin.css      # Admin stijlen
│   └── js/
│       ├── booking.js     # Frontend boekingslogica
│       └── admin.js       # Frontend admin logica
├── skmetals.db            # SQLite database (aangemaakt bij eerste start)
├── .env                   # Omgevingsvariabelen (niet in versiebeheeer)
├── .env.example           # Voorbeeldconfiguratie
└── package.json
```

## Productie-aanbevelingen

- Gebruik een reverse proxy zoals **nginx** voor HTTPS
- Stel `SESSION_SECRET` in op een lang willekeurig wachtwoord
- Wijzig `ADMIN_PASSWORD` naar een sterk wachtwoord
- Maak regelmatig een backup van `skmetals.db`
- Gebruik **PM2** voor procbeheer in productie:

```bash
npm install -g pm2
pm2 start server.js --name skmetals
pm2 save
pm2 startup
```

## Licentie

Intern gebruik SK Metals GmbH.
