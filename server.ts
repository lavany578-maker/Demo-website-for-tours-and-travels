import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import {
  createSessionToken,
  generateRawToken,
  getAdminAuthStatus,
  hashPassword,
  hashToken,
  requireAdmin,
  verifyPassword,
  verifySessionToken,
  type AuthedRequest,
} from './server/auth.ts';
import {
  db,
  getAllTrips,
  getEmailNotifications,
  getEnquiries,
  getFaqs,
  getGalleryImages,
  getInstagramPosts,
  getSettings,
  getTestimonials,
} from './server/db.ts';
import { dispatchEmailNotification, isSmtpConfigured } from './server/email.ts';
import type { EnquiryStatus, ItineraryDay, PackageStatus, PackageType } from './src/types/travel.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(uploadsDir));

const VALID_TRIP_STATUSES = new Set<PackageStatus>(['Upcoming', 'Booking Open', 'Filling Fast', 'Fully Booked']);
const VALID_PACKAGE_TYPES = new Set<PackageType>(['Individual', 'Couple', 'Family / Group']);
const VALID_ENQUIRY_STATUSES = new Set<EnquiryStatus>(['New', 'Contacted', 'Confirmed', 'Cancelled']);

function sanitizeString(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLen);
}

function sanitizeImageUrl(url: unknown): string {
  const s = sanitizeString(url, 800);
  if (!s) return '';
  if (s.startsWith('/src/assets/images/') || s.startsWith('/uploads/')) return s;
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function sanitizeExternalUrl(url: unknown): string {
  const s = sanitizeString(url, 500);
  if (!s) return '';
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return base || `trip-${Date.now()}`;
}

function escapeCsvCell(val: unknown): string {
  let s = val === null || val === undefined ? '' : String(val);
  // Neutralize formula injection in spreadsheet tools
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getBrowserMapsApiKey(): string {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

function isRealEmail(val: string): boolean {
  const s = val.trim();
  return (
    s.length > 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) &&
    !s.includes('placeholder-update-in-admin')
  );
}

function getPublicAppUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return envUrl.replace(/\/+$/, '');
      }
    } catch {
      // Fallback to request host below
    }
  }
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'http';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function resolveAdminNotificationEmail(): string {
  const settings = getSettings();
  if (isRealEmail(settings.adminNotificationEmail)) {
    return settings.adminNotificationEmail.trim();
  }
  const primaryAdmin = db
    .prepare('SELECT email FROM admin_users ORDER BY id ASC LIMIT 1')
    .get() as { email?: string } | undefined;
  if (primaryAdmin?.email && isRealEmail(primaryAdmin.email)) {
    return primaryAdmin.email.trim();
  }
  if (isRealEmail(settings.email)) {
    return settings.email.trim();
  }
  const envEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || '';
  if (envEmail && isRealEmail(envEmail)) {
    return envEmail;
  }
  return '';
}

function createEnquiryActionToken(
  enquiryId: number,
  actionType: 'customer_confirm' | 'admin_confirm'
): string {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  db.prepare(
    `INSERT INTO enquiry_action_tokens (enquiry_id, action_type, token_hash, expires_at)
     VALUES (?, ?, ?, datetime('now', '+7 days'))`
  ).run(enquiryId, actionType, tokenHash);
  return rawToken;
}

// ============================================================================
// PUBLIC API ROUTES
// ============================================================================

app.get('/api/bootstrap', (_req, res) => {
  try {
    const mapsApiKey = getBrowserMapsApiKey();
    res.json({
      trips: getAllTrips(),
      gallery: getGalleryImages(),
      testimonials: getTestimonials(true),
      instagramPosts: getInstagramPosts(),
      faqs: getFaqs(),
      settings: getSettings(),
      mapsApiKeyConfigured: Boolean(mapsApiKey),
      mapsApiKey,
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Unable to load travel portal data.' });
  }
});

app.get('/api/trips', (_req, res) => {
  try {
    res.json({ trips: getAllTrips() });
  } catch (err) {
    console.error('Trips fetch error:', err);
    res.status(500).json({ error: 'Unable to fetch trips.' });
  }
});

app.get('/api/trips/:slug', (req, res) => {
  try {
    const slug = sanitizeString(req.params.slug, 120);
    const trip = getAllTrips().find((t) => t.slug === slug);
    if (!trip) {
      res.status(404).json({ error: 'Trip package not found.' });
      return;
    }
    res.json({ trip });
  } catch (err) {
    console.error('Trip detail error:', err);
    res.status(500).json({ error: 'Unable to fetch trip details.' });
  }
});

app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ configured: false, available: false, reason: 'Valid destination coordinates are required.' });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    res.json({
      configured: false,
      available: false,
      reason: 'Weather API key not configured. Live weather will display once configured.',
    });
    return;
  }

  try {
    const url = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('location.latitude', String(lat));
    url.searchParams.append('location.longitude', String(lng));

    const apiRes = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
    });

    if (!apiRes.ok) {
      res.json({
        configured: true,
        available: false,
        reason: 'Live weather service is currently unavailable for this API key or destination.',
      });
      return;
    }

    const data = (await apiRes.json()) as {
      currentTime?: string;
      weatherCondition?: { description?: { text?: string } };
      temperature?: { degrees?: number };
      feelsLikeTemperature?: { degrees?: number };
      relativeHumidity?: number;
      wind?: { speed?: { value?: number } };
    };

    res.json({
      configured: true,
      available: true,
      temperatureCelsius: data.temperature?.degrees,
      feelsLikeCelsius: data.feelsLikeTemperature?.degrees,
      conditionText: data.weatherCondition?.description?.text || 'Clear',
      humidity: data.relativeHumidity,
      windKmh: data.wind?.speed?.value,
      observedAt: data.currentTime,
    });
  } catch (err) {
    console.error('Weather lookup error:', err);
    res.json({
      configured: true,
      available: false,
      reason: 'Unable to reach live weather endpoint.',
    });
  }
});

app.post('/api/enquiries', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const fullName = sanitizeString(body.fullName, 120);
    const mobileRaw = sanitizeString(body.mobile, 25);
    const mobileDigits = mobileRaw.replace(/\D/g, '');
    const email = sanitizeString(body.email, 140);
    const tripId = Number(body.tripId);
    const departureDate = sanitizeString(body.departureDate, 40);
    const adults = Math.max(1, Math.min(50, Math.floor(Number(body.adults) || 1)));
    const children = Math.max(0, Math.min(30, Math.floor(Number(body.children) || 0)));
    const requestedTotal = Math.max(1, Math.min(80, Math.floor(Number(body.totalTravellers) || adults + children)));
    const packageType = sanitizeString(body.packageType, 30) as PackageType;
    const pickupLocation = sanitizeString(body.pickupLocation, 140);
    const requirements = sanitizeString(body.requirements, 1000);

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (mobileDigits.length < 10 || mobileDigits.length > 13) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(400).json({ error: 'Please select an available tour package.' });
      return;
    }
    if (!VALID_PACKAGE_TYPES.has(packageType)) {
      res.status(400).json({ error: 'Please select Individual, Couple, or Family / Group package.' });
      return;
    }
    if (!pickupLocation) {
      res.status(400).json({ error: 'Please enter your preferred pickup city/location.' });
      return;
    }

    const trip = db.prepare('SELECT id, title, status FROM trips WHERE id = ?').get(tripId) as
      | { id: number; title: string; status: string }
      | undefined;

    if (!trip) {
      res.status(404).json({ error: 'Selected tour package was not found.' });
      return;
    }
    if (trip.status !== 'Booking Open' && trip.status !== 'Filling Fast') {
      res.status(400).json({
        error: 'Enquiries are currently restricted to tours marked as Booking Open or Filling Fast.',
      });
      return;
    }

    const randomCode = crypto.randomBytes(2).toString('hex').toUpperCase();
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const enquiryCode = `AEM-${dateStamp}-${randomCode}`;

    const result = db
      .prepare(
        `INSERT INTO enquiries (
          enquiry_code, trip_id, trip_title, full_name, mobile, email,
          departure_date, adults, children, total_travellers,
          package_type, pickup_location, requirements, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`
      )
      .run(
        enquiryCode,
        trip.id,
        trip.title,
        fullName,
        mobileRaw,
        email,
        departureDate,
        adults,
        children,
        requestedTotal,
        packageType,
        pickupLocation,
        requirements
      );

    const enquiryId = Number(result.lastInsertRowid);
    const appUrl = getPublicAppUrl(req);
    const adminEmail = resolveAdminNotificationEmail();
    let adminEmailStatus: 'sent' | 'smtp_unconfigured' | 'failed' | 'not_configured' = 'not_configured';
    let customerEmailStatus: 'sent' | 'smtp_unconfigured' | 'failed' | 'not_provided' = 'not_provided';

    const adminConfirmToken = createEnquiryActionToken(enquiryId, 'admin_confirm');
    const adminConfirmUrl = `${appUrl}/enquiry-action?token=${encodeURIComponent(adminConfirmToken)}`;

    const adminLines = [
      `New tour enquiry received (${enquiryCode}) for ${trip.title}.`,
      `Traveller: ${fullName} | Mobile: ${mobileRaw}${email ? ` | Email: ${email}` : ''}`,
      `Group: ${requestedTotal} Traveller(s) (${adults} Adults, ${children} Children) · ${packageType}`,
      `Departure: ${departureDate || 'Flexible'} · Pickup: ${pickupLocation}`,
      requirements ? `Requirements: ${requirements}` : 'No additional requirements noted.',
      'Click the button below to confirm this customer request directly from email.',
    ];

    if (adminEmail) {
      const adminMail = await dispatchEmailNotification({
        enquiryId,
        to: adminEmail,
        type: 'admin_new_enquiry',
        subject: `New Enquiry ${enquiryCode}: ${trip.title} — ${fullName}`,
        text: `${adminLines.join('\n')}\n\nConfirm Customer Request: ${adminConfirmUrl}`,
        htmlParagraphs: adminLines,
        actionLabel: 'Confirm Customer Request',
        actionUrl: adminConfirmUrl,
      });
      adminEmailStatus = adminMail.deliveryStatus;
    } else {
      db.prepare(
        `INSERT INTO email_notifications (
          enquiry_id, recipient_email, notification_type, subject, body_text, action_url, delivery_status, error_message
        ) VALUES (?, ?, 'admin_new_enquiry', ?, ?, ?, 'smtp_unconfigured', ?)`
      ).run(
        enquiryId,
        '(Admin notification email not set)',
        `New Enquiry ${enquiryCode}: ${trip.title} — ${fullName}`,
        adminLines.join('\n'),
        adminConfirmUrl,
        'Configure Admin Notification Email under Contact & Settings to receive automatic alerts.'
      );
    }

    if (email && isRealEmail(email)) {
      const customerConfirmToken = createEnquiryActionToken(enquiryId, 'customer_confirm');
      const customerConfirmUrl = `${appUrl}/enquiry-action?token=${encodeURIComponent(customerConfirmToken)}`;
      const customerLines = [
        `Namaste ${fullName}, thank you for submitting enquiry ${enquiryCode} for ${trip.title}.`,
        `Travellers: ${requestedTotal} (${packageType}) · Preferred Date: ${departureDate || 'Flexible'} · Pickup: ${pickupLocation}`,
        'Please confirm your enquiry request using the button below so our team receives your confirmed interest and finalizes seat availability.',
      ];
      const custMail = await dispatchEmailNotification({
        enquiryId,
        to: email,
        type: 'customer_request_confirm',
        subject: `Confirm Your Tour Enquiry (${enquiryCode}) — ${trip.title}`,
        text: `${customerLines.join('\n')}\n\nConfirm My Enquiry Request: ${customerConfirmUrl}`,
        htmlParagraphs: customerLines,
        actionLabel: 'Confirm My Enquiry Request',
        actionUrl: customerConfirmUrl,
      });
      customerEmailStatus = custMail.deliveryStatus;
    }

    res.status(201).json({
      enquiry: {
        id: enquiryId,
        enquiry_code: enquiryCode,
        trip_title: trip.title,
        full_name: fullName,
        mobile: mobileRaw,
        email,
        departure_date: departureDate,
        adults,
        children,
        total_travellers: requestedTotal,
        package_type: packageType,
        pickup_location: pickupLocation,
        status: 'New',
      },
      emailSummary: {
        adminEmailConfigured: Boolean(adminEmail),
        adminEmailStatus,
        customerEmailProvided: Boolean(email && isRealEmail(email)),
        customerEmailStatus,
      },
    });
  } catch (err) {
    console.error('Enquiry create error:', err);
    res.status(500).json({ error: 'Failed to submit enquiry. Please try again.' });
  }
});

app.get('/api/enquiry-action', (req, res) => {
  try {
    const rawToken = sanitizeString(req.query.token, 240);
    if (!rawToken) {
      res.status(400).json({ error: 'Confirmation token is missing.' });
      return;
    }
    const tokenHash = hashToken(rawToken);
    const row = db
      .prepare(
        `SELECT t.id as token_id, t.action_type, t.expires_at, t.used_at,
                e.enquiry_code, e.trip_title, e.full_name, e.departure_date,
                e.adults, e.children, e.total_travellers, e.package_type,
                e.pickup_location, e.status, e.customer_confirmed
         FROM enquiry_action_tokens t
         JOIN enquiries e ON e.id = t.enquiry_id
         WHERE t.token_hash = ?`
      )
      .get(tokenHash) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'Invalid or unknown confirmation link.' });
      return;
    }

    const expired = Boolean(
      db.prepare("SELECT CASE WHEN datetime(?) <= datetime('now') THEN 1 ELSE 0 END as is_exp").get(
        String(row.expires_at)
      )?.is_exp
    );

    res.json({
      action_type: String(row.action_type),
      already_used: Boolean(row.used_at),
      expired,
      enquiry: {
        enquiry_code: String(row.enquiry_code),
        trip_title: String(row.trip_title),
        full_name: String(row.full_name),
        departure_date: String(row.departure_date || ''),
        adults: Number(row.adults || 1),
        children: Number(row.children || 0),
        total_travellers: Number(row.total_travellers || 1),
        package_type: String(row.package_type || 'Individual'),
        pickup_location: String(row.pickup_location || ''),
        status: String(row.status || 'New'),
        customer_confirmed: Boolean(row.customer_confirmed),
      },
    });
  } catch (err) {
    console.error('Enquiry action preview error:', err);
    res.status(500).json({ error: 'Unable to load confirmation link details.' });
  }
});

app.post('/api/enquiry-action', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rawToken = sanitizeString(body.token, 240);
    if (!rawToken) {
      res.status(400).json({ error: 'Confirmation token is missing.' });
      return;
    }

    const tokenHash = hashToken(rawToken);
    const row = db
      .prepare(
        `SELECT t.id as token_id, t.enquiry_id, t.action_type, t.expires_at, t.used_at,
                e.enquiry_code, e.trip_title, e.full_name, e.mobile, e.email,
                e.departure_date, e.total_travellers, e.package_type, e.pickup_location,
                e.status, e.customer_confirmed
         FROM enquiry_action_tokens t
         JOIN enquiries e ON e.id = t.enquiry_id
         WHERE t.token_hash = ?`
      )
      .get(tokenHash) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'Invalid or unknown confirmation link.' });
      return;
    }
    if (row.used_at) {
      res.status(400).json({ error: 'This confirmation link has already been used.' });
      return;
    }

    const expired = Boolean(
      db.prepare("SELECT CASE WHEN datetime(?) <= datetime('now') THEN 1 ELSE 0 END as is_exp").get(
        String(row.expires_at)
      )?.is_exp
    );
    if (expired) {
      res.status(400).json({ error: 'This confirmation link has expired.' });
      return;
    }

    const claim = db
      .prepare("UPDATE enquiry_action_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL")
      .run(Number(row.token_id));
    if (claim.changes !== 1) {
      res.status(400).json({ error: 'This confirmation link has already been used.' });
      return;
    }

    const enquiryId = Number(row.enquiry_id);
    const actionType = String(row.action_type);
    const appUrl = getPublicAppUrl(req);

    if (actionType === 'customer_confirm') {
      db.prepare("UPDATE enquiries SET customer_confirmed = 1, updated_at = datetime('now') WHERE id = ?").run(
        enquiryId
      );

      const adminEmail = resolveAdminNotificationEmail();
      let adminEmailStatus: 'sent' | 'smtp_unconfigured' | 'failed' | 'not_configured' = 'not_configured';

      if (adminEmail) {
        const nextAdminToken = createEnquiryActionToken(enquiryId, 'admin_confirm');
        const nextAdminUrl = `${appUrl}/enquiry-action?token=${encodeURIComponent(nextAdminToken)}`;
        const lines = [
          `Customer ${String(row.full_name)} has confirmed their enquiry request (${String(row.enquiry_code)}).`,
          `Tour: ${String(row.trip_title)} | Travellers: ${Number(row.total_travellers)} (${String(row.package_type)})`,
          `Mobile: ${String(row.mobile)} | Pickup: ${String(row.pickup_location)} | Date: ${String(
            row.departure_date || 'Flexible'
          )}`,
          'Click the button below to mark this customer request as Confirmed from your email.',
        ];
        const mailRes = await dispatchEmailNotification({
          enquiryId,
          to: adminEmail,
          type: 'admin_customer_confirmed',
          subject: `Customer Confirmed Request ${String(row.enquiry_code)} — Action Required`,
          text: `${lines.join('\n')}\n\nConfirm Customer Booking Request: ${nextAdminUrl}`,
          htmlParagraphs: lines,
          actionLabel: 'Confirm Booking Request',
          actionUrl: nextAdminUrl,
        });
        adminEmailStatus = mailRes.deliveryStatus;
      }

      res.json({
        ok: true,
        action_type: 'customer_confirm',
        enquiry_code: String(row.enquiry_code),
        status: String(row.status),
        customer_confirmed: true,
        adminNotified: Boolean(adminEmail),
        adminEmailStatus,
      });
      return;
    }

    if (actionType === 'admin_confirm') {
      db.prepare("UPDATE enquiries SET status = 'Confirmed', updated_at = datetime('now') WHERE id = ?").run(
        enquiryId
      );

      const customerEmail = String(row.email || '');
      let customerEmailStatus: 'sent' | 'smtp_unconfigured' | 'failed' | 'not_provided' = 'not_provided';
      if (customerEmail && isRealEmail(customerEmail)) {
        const lines = [
          `Namaste ${String(row.full_name)}, great news!`,
          `Aai Ekveera Mauli Tours & Travel has confirmed your tour request (${String(row.enquiry_code)}) for ${String(
            row.trip_title
          )}.`,
          `Plan: ${Number(row.total_travellers)} Traveller(s) (${String(row.package_type)}) · Pickup: ${String(
            row.pickup_location
          )} · Preferred Date: ${String(row.departure_date || 'Flexible')}`,
          'Our coordinator will share seat allotment and final payment instructions with you shortly.',
        ];
        const custRes = await dispatchEmailNotification({
          enquiryId,
          to: customerEmail,
          type: 'customer_booking_confirmed',
          subject: `Booking Request Confirmed (${String(row.enquiry_code)}) — ${String(row.trip_title)}`,
          text: lines.join('\n'),
          htmlParagraphs: lines,
        });
        customerEmailStatus = custRes.deliveryStatus;
      }

      res.json({
        ok: true,
        action_type: 'admin_confirm',
        enquiry_code: String(row.enquiry_code),
        status: 'Confirmed',
        customer_confirmed: Boolean(row.customer_confirmed),
        customerEmailed: Boolean(customerEmail && isRealEmail(customerEmail)),
        customerEmailStatus,
      });
      return;
    }

    res.status(400).json({ error: 'Unsupported confirmation action.' });
  } catch (err) {
    console.error('Enquiry action execution error:', err);
    res.status(500).json({ error: 'Failed to process confirmation action.' });
  }
});

app.post('/api/contact', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const name = sanitizeString(body.name, 120);
    const mobile = sanitizeString(body.mobile, 25);
    const email = sanitizeString(body.email, 140);
    const subject = sanitizeString(body.subject, 160);
    const message = sanitizeString(body.message, 1500);

    if (name.length < 2 || mobile.replace(/\D/g, '').length < 10 || message.length < 5) {
      res.status(400).json({ error: 'Please provide your name, valid mobile number, and message.' });
      return;
    }

    db.prepare('INSERT INTO contact_messages (name, mobile, email, subject, message) VALUES (?, ?, ?, ?, ?)').run(
      name,
      mobile,
      email,
      subject,
      message
    );

    res.status(201).json({ ok: true, message: 'Message received. Our team will respond shortly.' });
  } catch (err) {
    console.error('Contact message error:', err);
    res.status(500).json({ error: 'Failed to submit contact message.' });
  }
});

app.post('/api/newsletter', (req, res) => {
  try {
    const email = sanitizeString((req.body as Record<string, unknown>).email, 160).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email) VALUES (?)').run(email);
    res.status(201).json({ ok: true, message: 'Subscribed for upcoming tour alerts.' });
  } catch (err) {
    console.error('Newsletter error:', err);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// ============================================================================
// ADMIN AUTH ROUTES
// ============================================================================

app.get('/api/admin/auth-status', (req, res) => {
  const status = getAdminAuthStatus();
  const header = req.headers.authorization;
  let authenticated = false;
  let user: { username: string; displayName: string; role: string } | null = null;
  if (header && header.startsWith('Bearer ')) {
    const payload = verifySessionToken(header.slice('Bearer '.length).trim());
    if (payload) {
      authenticated = true;
      user = { username: payload.username, displayName: payload.displayName, role: payload.role };
    }
  }
  res.json({ ...status, authenticated, user });
});

app.post('/api/admin/bootstrap', (req, res) => {
  try {
    const status = getAdminAuthStatus();
    if (!status.needsSetup) {
      res.status(403).json({ error: 'Administrator account has already been configured.' });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const username = sanitizeString(body.username, 60).toLowerCase() || 'owner';
    const displayName = sanitizeString(body.displayName, 80) || 'Tour Administrator';
    const email = sanitizeString(body.email, 140).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (email && !isRealEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid administrator email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    db.prepare(
      'INSERT INTO admin_users (username, display_name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, displayName, email, hash, salt, 'owner');

    if (email && isRealEmail(email)) {
      const currentSettings = getSettings();
      if (!currentSettings.adminNotificationEmail) {
        db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(
          'adminNotificationEmail',
          email
        );
      }
    }

    const token = createSessionToken({ sub: username, username, displayName, role: 'owner' });
    res.status(201).json({
      token,
      user: { username, displayName, role: 'owner' },
    });
  } catch (err) {
    console.error('Admin bootstrap error:', err);
    res.status(500).json({ error: 'Failed to create initial administrator account.' });
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const usernameInput = sanitizeString(body.username, 60).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!password) {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    // Optional server-side ADMIN_PASSCODE override (constant-time check)
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPasscode);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        const name = usernameInput || 'owner';
        const token = createSessionToken({ sub: name, username: name, displayName: 'Owner Admin', role: 'owner' });
        res.json({ token, user: { username: name, displayName: 'Owner Admin', role: 'owner' } });
        return;
      }
    }

    const adminRow = (
      usernameInput
        ? db.prepare('SELECT * FROM admin_users WHERE username = ? OR lower(email) = ?').get(usernameInput, usernameInput)
        : db.prepare('SELECT * FROM admin_users ORDER BY id ASC LIMIT 1').get()
    ) as
      | { id: number; username: string; display_name: string; password_hash: string; salt: string; role: string }
      | undefined;

    if (!adminRow || !verifyPassword(password, adminRow.password_hash, adminRow.salt)) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const token = createSessionToken({
      sub: String(adminRow.id),
      username: adminRow.username,
      displayName: adminRow.display_name,
      role: adminRow.role,
    });
    res.json({
      token,
      user: { username: adminRow.username, displayName: adminRow.display_name, role: adminRow.role },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

app.post('/api/admin/request-password-reset', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const identifier = sanitizeString(body.identifier, 140).toLowerCase();
    if (!identifier) {
      res.status(400).json({ error: 'Please enter your admin username or recovery email.' });
      return;
    }

    const settings = getSettings();
    let adminRow = db
      .prepare('SELECT id, username, display_name, email FROM admin_users WHERE lower(username) = ? OR lower(email) = ?')
      .get(identifier, identifier) as
      | { id: number; username: string; display_name: string; email: string }
      | undefined;

    if (!adminRow && settings.adminNotificationEmail.toLowerCase() === identifier) {
      adminRow = db
        .prepare('SELECT id, username, display_name, email FROM admin_users ORDER BY id ASC LIMIT 1')
        .get() as { id: number; username: string; display_name: string; email: string } | undefined;
    }

    const recoveryEmail =
      adminRow?.email && isRealEmail(adminRow.email)
        ? adminRow.email
        : isRealEmail(settings.adminNotificationEmail)
          ? settings.adminNotificationEmail
          : '';

    if (adminRow && recoveryEmail) {
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE admin_id = ? AND used_at IS NULL").run(
        adminRow.id
      );
      db.prepare(
        "INSERT INTO password_reset_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, datetime('now', '+30 minutes'))"
      ).run(adminRow.id, tokenHash);

      const appUrl = getPublicAppUrl(req);
      const resetUrl = `${appUrl}/admin?reset_token=${encodeURIComponent(rawToken)}`;
      const lines = [
        `A password reset was requested for administrator account "${adminRow.username}".`,
        'Click the button below within 30 minutes to set a new password. If you did not request this, you can safely ignore this email.',
      ];

      await dispatchEmailNotification({
        to: recoveryEmail,
        type: 'admin_password_reset',
        subject: `Reset Administrator Password — ${settings.businessName}`,
        text: `${lines.join('\n')}\n\nReset Link: ${resetUrl}`,
        htmlParagraphs: lines,
        actionLabel: 'Reset Admin Password',
        actionUrl: resetUrl,
      });
    }

    res.json({
      ok: true,
      smtpConfigured: isSmtpConfigured(),
      message:
        'If an administrator account with a recovery email exists, a password reset link has been sent to that email.',
    });
  } catch (err) {
    console.error('Admin password reset request error:', err);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

app.post('/api/admin/reset-password', (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rawToken = sanitizeString(body.token, 240);
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!rawToken) {
      res.status(400).json({ error: 'Reset token is required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const tokenHash = hashToken(rawToken);
    const row = db
      .prepare(
        `SELECT id, admin_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token_hash = ?`
      )
      .get(tokenHash) as { id: number; admin_id: number; expires_at: string; used_at: string | null } | undefined;

    if (!row || row.used_at) {
      res.status(400).json({ error: 'This password reset link is invalid or has already been used.' });
      return;
    }

    const expired = Boolean(
      db.prepare("SELECT CASE WHEN datetime(?) <= datetime('now') THEN 1 ELSE 0 END as is_exp").get(row.expires_at)
        ?.is_exp
    );
    if (expired) {
      res.status(400).json({ error: 'This password reset link has expired. Please request a new one.' });
      return;
    }

    const claim = db
      .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL")
      .run(row.id);
    if (claim.changes !== 1) {
      res.status(400).json({ error: 'This password reset link has already been used.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, row.admin_id);

    res.json({ ok: true, message: 'Administrator password updated successfully. Please sign in.' });
  } catch (err) {
    console.error('Admin reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.post('/api/admin/change-password', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const recoveryEmail = sanitizeString(body.recoveryEmail, 140).toLowerCase();

    if (recoveryEmail && !isRealEmail(recoveryEmail)) {
      res.status(400).json({ error: 'Please enter a valid recovery email address.' });
      return;
    }

    const adminRow = (
      req.admin?.username
        ? db.prepare('SELECT * FROM admin_users WHERE username = ?').get(req.admin.username)
        : db.prepare('SELECT * FROM admin_users ORDER BY id ASC LIMIT 1').get()
    ) as
      | { id: number; username: string; display_name: string; email: string; password_hash: string; salt: string }
      | undefined;

    if (!adminRow) {
      res.status(400).json({
        error: 'No stored admin database account exists (currently signing in with ADMIN_PASSCODE).',
      });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const matchesEnvPasscode = Boolean(
      envPasscode &&
        currentPassword.length === envPasscode.length &&
        crypto.timingSafeEqual(Buffer.from(currentPassword), Buffer.from(envPasscode))
    );

    if (!matchesEnvPasscode && !verifyPassword(currentPassword, adminRow.password_hash, adminRow.salt)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters long.' });
        return;
      }
      const { hash, salt } = hashPassword(newPassword);
      db.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, adminRow.id);
    }

    if (recoveryEmail) {
      db.prepare('UPDATE admin_users SET email = ? WHERE id = ?').run(recoveryEmail, adminRow.id);
      const settings = getSettings();
      if (!settings.adminNotificationEmail) {
        db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(
          'adminNotificationEmail',
          recoveryEmail
        );
      }
    }

    res.json({
      ok: true,
      adminEmail: recoveryEmail || adminRow.email,
      message: newPassword
        ? 'Administrator password and security settings updated.'
        : 'Administrator recovery email updated.',
    });
  } catch (err) {
    console.error('Admin change password error:', err);
    res.status(500).json({ error: 'Failed to update security credentials.' });
  }
});

app.post('/api/admin/logout', (_req, res) => {
  res.json({ ok: true });
});

// ============================================================================
// PROTECTED ADMIN CRUD ROUTES
// ============================================================================

app.get('/api/admin/dashboard-data', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const contactMessages = db.prepare('SELECT * FROM contact_messages ORDER BY id DESC LIMIT 100').all();
    const newsletterCount = db.prepare('SELECT COUNT(*) as count FROM newsletter_subscribers').get() as { count: number };
    const adminRow = (
      req.admin?.username
        ? db.prepare('SELECT email FROM admin_users WHERE username = ?').get(req.admin.username)
        : db.prepare('SELECT email FROM admin_users ORDER BY id ASC LIMIT 1').get()
    ) as { email?: string } | undefined;

    res.json({
      trips: getAllTrips(),
      enquiries: getEnquiries(),
      gallery: getGalleryImages(),
      testimonials: getTestimonials(false),
      instagramPosts: getInstagramPosts(),
      faqs: getFaqs(),
      settings: getSettings(),
      contactMessages,
      newsletterCount: newsletterCount.count,
      emailNotifications: getEmailNotifications(100),
      smtpConfigured: isSmtpConfigured(),
      adminEmail: adminRow?.email || '',
    });
  } catch (err) {
    console.error('Admin dashboard fetch error:', err);
    res.status(500).json({ error: 'Failed to load admin data.' });
  }
});

app.post('/api/admin/upload', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPEG, or WebP images are allowed.' });
      return;
    }
    const mime = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be 5MB or less.' });
      return;
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const resolvedPath = path.resolve(uploadsDir, fileName);
    if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid upload path.' });
      return;
    }

    fs.writeFileSync(resolvedPath, buffer);
    res.status(201).json({ url: `/uploads/${fileName}` });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to save uploaded image.' });
  }
});

function parseTripPayload(body: Record<string, unknown>) {
  const title = sanitizeString(body.title, 160);
  const destination = sanitizeString(body.destination, 120);
  const subtitle = sanitizeString(body.subtitle, 200);
  const summary = sanitizeString(body.summary, 1500);
  const coverImage = sanitizeImageUrl(body.cover_image) || '/src/assets/images/package_manali_solang_1795421892503.jpg';
  const startDate = sanitizeString(body.start_date, 30);
  const returnDate = sanitizeString(body.return_date, 30);
  const days = Math.max(1, Math.min(60, Math.floor(Number(body.days) || 1)));
  const nights = Math.max(0, Math.min(60, Math.floor(Number(body.nights) ?? Math.max(0, days - 1))));
  const parseOptInt = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const pricePerPerson = parseOptInt(body.price_per_person);
  const couplePrice = parseOptInt(body.couple_price);
  const availableSeats = parseOptInt(body.available_seats);
  const departureLocation = sanitizeString(body.departure_location, 160);
  const statusRaw = sanitizeString(body.status, 30) as PackageStatus;
  const status: PackageStatus = VALID_TRIP_STATUSES.has(statusRaw) ? statusRaw : 'Upcoming';
  const isVerified = body.is_verified ? 1 : 0;
  const priceNote = sanitizeString(body.price_note, 300);
  const hotelInfo = sanitizeString(body.hotel_info, 500);
  const foodInfo = sanitizeString(body.food_info, 500);
  const transportInfo = sanitizeString(body.transport_info, 500);
  const cleanStrArr = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.map((x) => sanitizeString(x, 300)).filter(Boolean) : [];
  const inclusions = cleanStrArr(body.inclusions);
  const exclusions = cleanStrArr(body.exclusions);
  const instructions = cleanStrArr(body.instructions);
  const parseCoord = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const latitude = parseCoord(body.latitude);
  const longitude = parseCoord(body.longitude);
  const isFeatured = body.is_featured ? 1 : 0;
  const itineraryRaw = Array.isArray(body.itinerary) ? (body.itinerary as ItineraryDay[]) : [];
  const itinerary = itineraryRaw.map((d, idx) => ({
    day_number: Math.max(1, Math.floor(Number(d.day_number) || idx + 1)),
    title: sanitizeString(d.title, 160) || `Day ${idx + 1}`,
    location: sanitizeString(d.location, 160),
    description: sanitizeString(d.description, 1200),
    meals: sanitizeString(d.meals, 120),
    stay: sanitizeString(d.stay, 120),
    highlights: cleanStrArr(d.highlights),
  }));

  return {
    title,
    destination,
    subtitle,
    summary,
    coverImage,
    startDate,
    returnDate,
    days,
    nights,
    pricePerPerson,
    couplePrice,
    availableSeats,
    departureLocation,
    status,
    isVerified,
    priceNote,
    hotelInfo,
    foodInfo,
    transportInfo,
    inclusions,
    exclusions,
    instructions,
    latitude,
    longitude,
    isFeatured,
    itinerary,
  };
}

app.post('/api/admin/trips', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const p = parseTripPayload(req.body as Record<string, unknown>);
    if (!p.title || !p.destination) {
      res.status(400).json({ error: 'Trip title and destination are required.' });
      return;
    }

    let slug = slugify(p.title);
    const existingSlug = db.prepare('SELECT id FROM trips WHERE slug = ?').get(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const result = db
      .prepare(
        `INSERT INTO trips (
          slug, title, destination, subtitle, summary, cover_image,
          start_date, return_date, days, nights, price_per_person, couple_price,
          available_seats, departure_location, status, is_verified, price_note,
          hotel_info, food_info, transport_info, inclusions, exclusions, instructions,
          latitude, longitude, is_featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug,
        p.title,
        p.destination,
        p.subtitle,
        p.summary,
        p.coverImage,
        p.startDate,
        p.returnDate,
        p.days,
        p.nights,
        p.pricePerPerson,
        p.couplePrice,
        p.availableSeats,
        p.departureLocation,
        p.status,
        p.isVerified,
        p.priceNote,
        p.hotelInfo,
        p.foodInfo,
        p.transportInfo,
        JSON.stringify(p.inclusions),
        JSON.stringify(p.exclusions),
        JSON.stringify(p.instructions),
        p.latitude,
        p.longitude,
        p.isFeatured
      );

    const newTripId = Number(result.lastInsertRowid);
    const insertDay = db.prepare(
      'INSERT INTO itineraries (trip_id, day_number, title, location, description, meals, stay, highlights) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const day of p.itinerary) {
      insertDay.run(
        newTripId,
        day.day_number,
        day.title,
        day.location,
        day.description,
        day.meals,
        day.stay,
        JSON.stringify(day.highlights)
      );
    }

    db.prepare(
      'INSERT INTO destination_images (trip_id, destination_name, image_url, caption, sort_order) VALUES (?, ?, ?, ?, 1)'
    ).run(newTripId, p.destination, p.coverImage, p.title);

    res.status(201).json({ id: newTripId, trips: getAllTrips() });
  } catch (err) {
    console.error('Create trip error:', err);
    res.status(500).json({ error: 'Failed to create trip package.' });
  }
});

app.put('/api/admin/trips/:id', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(400).json({ error: 'Invalid trip ID.' });
      return;
    }
    const existing = db.prepare('SELECT id FROM trips WHERE id = ?').get(tripId);
    if (!existing) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    const p = parseTripPayload(req.body as Record<string, unknown>);
    if (!p.title || !p.destination) {
      res.status(400).json({ error: 'Trip title and destination are required.' });
      return;
    }

    db.prepare(
      `UPDATE trips SET
        title = ?, destination = ?, subtitle = ?, summary = ?, cover_image = ?,
        start_date = ?, return_date = ?, days = ?, nights = ?,
        price_per_person = ?, couple_price = ?, available_seats = ?,
        departure_location = ?, status = ?, is_verified = ?, price_note = ?,
        hotel_info = ?, food_info = ?, transport_info = ?,
        inclusions = ?, exclusions = ?, instructions = ?,
        latitude = ?, longitude = ?, is_featured = ?, updated_at = datetime('now')
      WHERE id = ?`
    ).run(
      p.title,
      p.destination,
      p.subtitle,
      p.summary,
      p.coverImage,
      p.startDate,
      p.returnDate,
      p.days,
      p.nights,
      p.pricePerPerson,
      p.couplePrice,
      p.availableSeats,
      p.departureLocation,
      p.status,
      p.isVerified,
      p.priceNote,
      p.hotelInfo,
      p.foodInfo,
      p.transportInfo,
      JSON.stringify(p.inclusions),
      JSON.stringify(p.exclusions),
      JSON.stringify(p.instructions),
      p.latitude,
      p.longitude,
      p.isFeatured,
      tripId
    );

    db.prepare('DELETE FROM itineraries WHERE trip_id = ?').run(tripId);
    const insertDay = db.prepare(
      'INSERT INTO itineraries (trip_id, day_number, title, location, description, meals, stay, highlights) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const day of p.itinerary) {
      insertDay.run(
        tripId,
        day.day_number,
        day.title,
        day.location,
        day.description,
        day.meals,
        day.stay,
        JSON.stringify(day.highlights)
      );
    }

    res.json({ trips: getAllTrips() });
  } catch (err) {
    console.error('Update trip error:', err);
    res.status(500).json({ error: 'Failed to update trip package.' });
  }
});

app.delete('/api/admin/trips/:id', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(400).json({ error: 'Invalid trip ID.' });
      return;
    }
    db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);
    res.json({ trips: getAllTrips() });
  } catch (err) {
    console.error('Delete trip error:', err);
    res.status(500).json({ error: 'Failed to delete trip package.' });
  }
});

app.get('/api/admin/enquiries', requireAdmin, (_req: AuthedRequest, res) => {
  res.json({ enquiries: getEnquiries() });
});

app.patch('/api/admin/enquiries/:id', requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body as Record<string, unknown>;
    const status = sanitizeString(body.status, 30) as EnquiryStatus;
    const adminNotes = sanitizeString(body.admin_notes, 600);
    const notifyCustomer = Boolean(body.notifyCustomer);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid enquiry ID.' });
      return;
    }
    if (!VALID_ENQUIRY_STATUSES.has(status)) {
      res.status(400).json({ error: 'Invalid enquiry status.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Enquiry not found.' });
      return;
    }

    db.prepare(
      "UPDATE enquiries SET status = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, adminNotes, id);

    let customerEmailStatus: string | undefined;
    const customerEmail = String(existing.email || '');
    if (status === 'Confirmed' && notifyCustomer && customerEmail && isRealEmail(customerEmail)) {
      const lines = [
        `Namaste ${String(existing.full_name)},`,
        `Aai Ekveera Mauli Tours & Travel has confirmed your tour request (${String(
          existing.enquiry_code
        )}) for ${String(existing.trip_title)}.`,
        `Plan: ${Number(existing.total_travellers)} Traveller(s) (${String(existing.package_type)}) · Pickup: ${String(
          existing.pickup_location
        )} · Preferred Date: ${String(existing.departure_date || 'Flexible')}`,
        'Our coordinator will reach out with final seat allocation and payment details.',
      ];
      const mailRes = await dispatchEmailNotification({
        enquiryId: id,
        to: customerEmail,
        type: 'customer_booking_confirmed',
        subject: `Booking Request Confirmed (${String(existing.enquiry_code)}) — ${String(existing.trip_title)}`,
        text: lines.join('\n'),
        htmlParagraphs: lines,
      });
      customerEmailStatus = mailRes.deliveryStatus;
    }

    res.json({
      enquiries: getEnquiries(),
      emailNotifications: getEmailNotifications(100),
      customerEmailStatus,
    });
  } catch (err) {
    console.error('Update enquiry error:', err);
    res.status(500).json({ error: 'Failed to update enquiry.' });
  }
});

app.get('/api/admin/enquiries/export.csv', requireAdmin, (_req: AuthedRequest, res) => {
  const rows = getEnquiries();
  const headers = [
    'Enquiry ID',
    'Trip Title',
    'Full Name',
    'Mobile',
    'Email',
    'Departure Date',
    'Adults',
    'Children',
    'Total Travellers',
    'Package Type',
    'Pickup Location',
    'Requirements',
    'Status',
    'Admin Notes',
    'Created At',
  ];
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) =>
      [
        r.enquiry_code,
        r.trip_title,
        r.full_name,
        r.mobile,
        r.email,
        r.departure_date,
        r.adults,
        r.children,
        r.total_travellers,
        r.package_type,
        r.pickup_location,
        r.requirements,
        r.status,
        r.admin_notes,
        r.created_at,
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="aai-ekveera-mauli-enquiries.csv"');
  res.send(csvLines.join('\r\n'));
});

app.post('/api/admin/gallery', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const tripId = body.trip_id ? Number(body.trip_id) : null;
    const destinationName = sanitizeString(body.destination_name, 120);
    const imageUrl = sanitizeImageUrl(body.image_url);
    const caption = sanitizeString(body.caption, 200);
    if (!imageUrl || !destinationName) {
      res.status(400).json({ error: 'Destination name and valid image URL are required.' });
      return;
    }
    db.prepare(
      'INSERT INTO destination_images (trip_id, destination_name, image_url, caption, sort_order) VALUES (?, ?, ?, ?, 10)'
    ).run(tripId, destinationName, imageUrl, caption);
    res.status(201).json({ gallery: getGalleryImages(), trips: getAllTrips() });
  } catch (err) {
    console.error('Add gallery error:', err);
    res.status(500).json({ error: 'Failed to add destination image.' });
  }
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid image ID.' });
    return;
  }
  db.prepare('DELETE FROM destination_images WHERE id = ?').run(id);
  res.json({ gallery: getGalleryImages(), trips: getAllTrips() });
});

app.post('/api/admin/instagram', requireAdmin, (req: AuthedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const imageUrl = sanitizeImageUrl(body.image_url);
  const caption = sanitizeString(body.caption, 300);
  const postUrl =
    sanitizeExternalUrl(body.post_url) || 'https://www.instagram.com/aai_ekveera_mauli_tours_0139/';
  const tag = sanitizeString(body.tag, 60);
  if (!imageUrl || !caption) {
    res.status(400).json({ error: 'Image and caption are required.' });
    return;
  }
  db.prepare('INSERT INTO instagram_posts (image_url, caption, post_url, tag) VALUES (?, ?, ?, ?)').run(
    imageUrl,
    caption,
    postUrl,
    tag
  );
  res.status(201).json({ instagramPosts: getInstagramPosts() });
});

app.delete('/api/admin/instagram/:id', requireAdmin, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid post ID.' });
    return;
  }
  db.prepare('DELETE FROM instagram_posts WHERE id = ?').run(id);
  res.json({ instagramPosts: getInstagramPosts() });
});

app.post('/api/admin/testimonials', requireAdmin, (req: AuthedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const customerName = sanitizeString(body.customer_name, 100);
  const city = sanitizeString(body.city, 100);
  const tripName = sanitizeString(body.trip_name, 120);
  const quote = sanitizeString(body.quote, 600);
  const rating = Math.max(1, Math.min(5, Math.floor(Number(body.rating) || 5)));
  const isDemo = body.is_demo ? 1 : 0;
  if (!customerName || !quote) {
    res.status(400).json({ error: 'Customer name and review quote are required.' });
    return;
  }
  db.prepare(
    'INSERT INTO testimonials (customer_name, city, trip_name, quote, rating, is_demo, is_published) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(customerName, city, tripName, quote, rating, isDemo);
  res.status(201).json({ testimonials: getTestimonials(false) });
});

app.delete('/api/admin/testimonials/:id', requireAdmin, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid testimonial ID.' });
    return;
  }
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
  res.json({ testimonials: getTestimonials(false) });
});

app.post('/api/admin/faqs', requireAdmin, (req: AuthedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const question = sanitizeString(body.question, 250);
  const answer = sanitizeString(body.answer, 1200);
  if (!question || !answer) {
    res.status(400).json({ error: 'Question and answer are required.' });
    return;
  }
  db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, 10)').run(question, answer);
  res.status(201).json({ faqs: getFaqs() });
});

app.delete('/api/admin/faqs/:id', requireAdmin, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid FAQ ID.' });
    return;
  }
  db.prepare('DELETE FROM faqs WHERE id = ?').run(id);
  res.json({ faqs: getFaqs() });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const adminNotificationEmail = sanitizeString(body.adminNotificationEmail, 140).toLowerCase();
    if (adminNotificationEmail && !isRealEmail(adminNotificationEmail)) {
      res.status(400).json({ error: 'Please enter a valid admin notification email address.' });
      return;
    }

    const updates: Record<string, string> = {
      businessName: sanitizeString(body.businessName, 140) || 'AAI EKVEERA MAULI TOURS & TRAVEL',
      tagline: sanitizeString(body.tagline, 140) || 'आपला विश्वास... आमची जबाबदारी...',
      mobile: sanitizeString(body.mobile, 80),
      whatsapp: sanitizeString(body.whatsapp, 30),
      email: sanitizeString(body.email, 140),
      adminNotificationEmail,
      officeAddress: sanitizeString(body.officeAddress, 300),
      officeLat: String(Number(body.officeLat) || 19.076),
      officeLng: String(Number(body.officeLng) || 72.8777),
      instagramHandle: sanitizeString(body.instagramHandle, 80) || '@aai_ekveera_mauli_tours_0139',
      instagramUrl:
        sanitizeExternalUrl(body.instagramUrl) || 'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
      completedTours:
        body.completedTours === null || body.completedTours === '' || body.completedTours === undefined
          ? ''
          : String(Math.max(0, Math.floor(Number(body.completedTours) || 0))),
      happyTravellers:
        body.happyTravellers === null || body.happyTravellers === '' || body.happyTravellers === undefined
          ? ''
          : String(Math.max(0, Math.floor(Number(body.happyTravellers) || 0))),
      statsVerified: body.statsVerified ? 'true' : 'false',
      contactVerified: body.contactVerified ? 'true' : 'false',
      cancellationPolicy: sanitizeString(body.cancellationPolicy, 2000),
    };

    const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(updates)) {
      upsert.run(k, v);
    }

    if (adminNotificationEmail && req.admin?.username) {
      db.prepare("UPDATE admin_users SET email = ? WHERE username = ? AND email = ''").run(
        adminNotificationEmail,
        req.admin.username
      );
    }

    res.json({ settings: getSettings() });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

app.post('/api/admin/test-email', requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const overrideRecipient = sanitizeString(body.recipientEmail, 140).toLowerCase();
    const targetEmail = overrideRecipient || resolveAdminNotificationEmail();

    if (!targetEmail || !isRealEmail(targetEmail)) {
      res.status(400).json({
        error: 'Please enter and save a valid Admin Notification Email address first.',
      });
      return;
    }

    const settings = getSettings();
    const result = await dispatchEmailNotification({
      to: targetEmail,
      type: 'test_email',
      subject: `Test Notification — ${settings.businessName}`,
      text: `This is a test notification verifying admin email alerts for ${settings.businessName}.`,
      htmlParagraphs: [
        `This is a verification email from ${settings.businessName}.`,
        'When a new enquiry arrives or a customer confirms their request, notifications and one-click confirmation buttons will be sent to this email address.',
      ],
    });

    res.json({
      recipient: targetEmail,
      deliveryStatus: result.deliveryStatus,
      errorMessage: result.errorMessage,
      smtpConfigured: isSmtpConfigured(),
      emailNotifications: getEmailNotifications(100),
    });
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: 'Failed to send test email.' });
  }
});

// ============================================================================
// VITE / STATIC SPA ENTRYPOINT
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aai Ekveera Mauli Tours & Travel server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
