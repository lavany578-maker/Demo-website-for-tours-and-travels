import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  CustomerEnquiry,
  DestinationImage,
  EmailNotificationLog,
  EnquiryStatus,
  FaqItem,
  InstagramPost,
  ItineraryDay,
  PackageStatus,
  PackageType,
  SiteSettings,
  Testimonial,
  TripPackage,
} from '../src/types/travel.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(path.join(dataDir, 'aai_ekveera.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    destination TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    cover_image TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    return_date TEXT NOT NULL DEFAULT '',
    days INTEGER NOT NULL DEFAULT 1,
    nights INTEGER NOT NULL DEFAULT 0,
    price_per_person INTEGER,
    couple_price INTEGER,
    available_seats INTEGER,
    departure_location TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Upcoming',
    is_verified INTEGER NOT NULL DEFAULT 0,
    price_note TEXT NOT NULL DEFAULT '',
    hotel_info TEXT NOT NULL DEFAULT '',
    food_info TEXT NOT NULL DEFAULT '',
    transport_info TEXT NOT NULL DEFAULT '',
    inclusions TEXT NOT NULL DEFAULT '[]',
    exclusions TEXT NOT NULL DEFAULT '[]',
    instructions TEXT NOT NULL DEFAULT '[]',
    latitude REAL,
    longitude REAL,
    is_featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS itineraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    meals TEXT NOT NULL DEFAULT '',
    stay TEXT NOT NULL DEFAULT '',
    highlights TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS destination_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER,
    destination_name TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enquiry_code TEXT NOT NULL UNIQUE,
    trip_id INTEGER,
    trip_title TEXT NOT NULL,
    full_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    departure_date TEXT NOT NULL DEFAULT '',
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    total_travellers INTEGER NOT NULL DEFAULT 1,
    package_type TEXT NOT NULL DEFAULT 'Individual',
    pickup_location TEXT NOT NULL DEFAULT '',
    requirements TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'New',
    customer_confirmed INTEGER NOT NULL DEFAULT 0,
    admin_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enquiry_action_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enquiry_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS email_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enquiry_id INTEGER,
    recipient_email TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    action_url TEXT NOT NULL DEFAULT '',
    delivery_status TEXT NOT NULL DEFAULT 'smtp_unconfigured',
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    trip_name TEXT NOT NULL DEFAULT '',
    quote TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    is_demo INTEGER NOT NULL DEFAULT 1,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS instagram_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL,
    post_url TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function ensureColumnExists(tableName: string, columnName: string, columnSql: string) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
}

ensureColumnExists('enquiries', 'customer_confirmed', 'customer_confirmed INTEGER NOT NULL DEFAULT 0');
ensureColumnExists('admin_users', 'email', "email TEXT NOT NULL DEFAULT ''");

function parseJsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export function seedInitialData() {
  const tripCountRow = db.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number };
  if (tripCountRow.count === 0) {
    const insertTrip = db.prepare(`
      INSERT INTO trips (
        slug, title, destination, subtitle, summary, cover_image,
        start_date, return_date, days, nights, price_per_person, couple_price,
        available_seats, departure_location, status, is_verified, price_note,
        hotel_info, food_info, transport_info, inclusions, exclusions, instructions,
        latitude, longitude, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDay = db.prepare(`
      INSERT INTO itineraries (trip_id, day_number, title, location, description, meals, stay, highlights)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertImage = db.prepare(`
      INSERT INTO destination_images (trip_id, destination_name, image_url, caption, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    // 1. Manali – Solang Valley – Atal Tunnel – Kasol – Manikaran Sahib
    const manaliRes = insertTrip.run(
      'manali-solang-atal-tunnel-kasol-manikaran',
      'Manali – Solang Valley – Atal Tunnel – Kasol – Manikaran Sahib',
      'Manali & Kasol, Himachal Pradesh',
      'Group, Family & Couple Himalayan Escape (Sample Itinerary — Confirm Poster Details)',
      'A classic Himachal itinerary covering Manali local heritage, Solang Valley snow point, Atal Tunnel crossing, riverside Kasol, and the sacred Manikaran Sahib Gurudwara. Dates, tariff, and seat availability are pending final confirmation from the operator.',
      '/src/assets/images/package_manali_solang_1795421892503.jpg',
      '',
      '',
      6,
      5,
      null,
      null,
      null,
      'Pending Operator Confirmation (Maharashtra / Delhi Pickup Options)',
      'Booking Open',
      0,
      'Sample Package — Tariff & batch dates to be confirmed with Aai Ekveera Mauli Tours & Travel based on the official tour poster.',
      'Family-friendly / Couple mountain hotel & riverside camp accommodation (exact property category confirmed at booking).',
      'Breakfast & Dinner as per final package plan (confirmed by operator).',
      'AC Volvo / Tempo Traveller / Private Cab transfer as per group size (confirmed by operator).',
      JSON.stringify([
        'Accommodation as per selected sharing / couple plan (to be confirmed)',
        'Sightseeing transfers across Manali, Solang Valley, Atal Tunnel & Kasol',
        'Dedicated tour coordinator support during group departures',
      ]),
      JSON.stringify([
        'Personal adventure activities (paragliding, skiing, snow scooter, river rafting)',
        'Train / Airfare unless specified in final confirmed quote',
        'Room heater charges, monument entry fees & personal expenses',
      ]),
      JSON.stringify([
        'Carry original government photo ID (Aadhaar / Passport / Driving Licence)',
        'Pack layered woollens, thermal wear, waterproof shoes & sunglasses',
        'Atal Tunnel / Rohtang corridor visits depend on local weather & BRO traffic advisories',
      ]),
      32.2432,
      77.1892,
      1
    );
    const manaliId = Number(manaliRes.lastInsertRowid);

    const manaliDays = [
      {
        day: 1,
        title: 'Departure & Scenic Mountain Drive',
        location: 'Pickup Hub -> Manali Corridor',
        desc: 'Assemble at the designated departure point and begin the overnight scenic journey towards the Kullu-Manali valley.',
        meals: 'As per confirmed plan',
        stay: 'Overnight Transit',
        highlights: ['Group briefing', 'Overnight mountain highway transit'],
      },
      {
        day: 2,
        title: 'Manali Arrival & Local Sightseeing',
        location: 'Hadimba Temple · Van Vihar · Mall Road',
        desc: 'Check in, refresh, and explore Hadimba Devi Temple nestled in cedar woods, Vashisht Hot Springs, Tibetan Monastery, and evening stroll at Mall Road.',
        meals: 'Dinner (To be confirmed)',
        stay: 'Manali Hotel',
        highlights: ['Hadimba Devi Temple', 'Vashisht Temple', 'Mall Road evening'],
      },
      {
        day: 3,
        title: 'Solang Valley & Atal Tunnel Excursion',
        location: 'Solang Valley · Atal Tunnel · Sissu (Weather Permitting)',
        desc: 'Full-day mountain excursion to Solang Valley snow activities zone and pass through the engineering marvel Atal Tunnel towards Lahaul valley.',
        meals: 'Breakfast & Dinner (To be confirmed)',
        stay: 'Manali Hotel',
        highlights: ['Solang Valley', 'Atal Tunnel crossing', 'Snow viewpoints'],
      },
      {
        day: 4,
        title: 'Kullu Valley, Kasol & Manikaran Sahib',
        location: 'Kullu · Parvati Valley · Manikaran Sahib',
        desc: 'Drive along the Beas and Parvati rivers to visit Kullu shawl factories, pay respects at Manikaran Sahib Gurudwara hot springs, and explore Kasol market.',
        meals: 'Breakfast & Dinner (To be confirmed)',
        stay: 'Kasol / Parvati Camp or Hotel',
        highlights: ['Manikaran Sahib Gurudwara', 'Kasol riverside walk', 'Parvati Valley'],
      },
      {
        day: 5,
        title: 'Parvati Valley Leisure & Return Departure',
        location: 'Kasol -> Return Corridor',
        desc: 'Morning riverside relaxation in Kasol before boarding the return vehicle back towards home destination.',
        meals: 'Breakfast (To be confirmed)',
        stay: 'Overnight Return Transit',
        highlights: ['Chalal trail walk (optional)', 'Return journey'],
      },
      {
        day: 6,
        title: 'Arrival Back Home',
        location: 'Drop Point',
        desc: 'Arrive back at the drop location with unforgettable Himalayan memories.',
        meals: 'None',
        stay: 'Tour Concludes',
        highlights: ['Safe arrival'],
      },
    ];
    for (const d of manaliDays) {
      insertDay.run(manaliId, d.day, d.title, d.location, d.desc, d.meals, d.stay, JSON.stringify(d.highlights));
    }

    insertImage.run(manaliId, 'Manali & Solang', '/src/assets/images/package_manali_solang_1795421892503.jpg', 'Solang Valley & Himalayan highway approach', 1);
    insertImage.run(manaliId, 'Kasol & Parvati Valley', '/src/assets/images/gallery_kasol_parvati_1795421891463.jpg', 'Parvati River and deodar pine forests near Kasol', 2);
    insertImage.run(manaliId, 'Solang Camp', '/src/assets/images/gallery_alpine_camp_1795421891394.jpg', 'Evening bonfire & alpine camp experience', 3);

    // 2. Kashmir Holiday Package
    const kashmirRes = insertTrip.run(
      'kashmir-holiday-package',
      'Kashmir Holiday Package',
      'Srinagar · Gulmarg · Pahalgam · Sonmarg',
      'Family & Couple Paradise Valley Tour (Sample Package — Confirm Details)',
      'Experience houseboat serenity on Dal Lake, Gondola views in Gulmarg, Betaab Valley in Pahalgam, and Sonmarg alpine meadows. Exact batch dates and pricing will be confirmed upon enquiry.',
      '/src/assets/images/package_kashmir_dal_1795421892103.jpg',
      '',
      '',
      6,
      5,
      null,
      null,
      null,
      'Srinagar Arrival / Pune & Mumbai Group Flight Assistance',
      'Upcoming',
      0,
      'Sample Package — Seasonal dates, hotel tier & airfare options confirmed separately by operator.',
      'Deluxe Srinagar Hotel + Traditional Dal Lake Houseboat stay (subject to final confirmation).',
      'Modified American Plan (Breakfast & Dinner) — confirmed at final quotation.',
      'Private Innova / Tempo Traveller for sightseeing; Srinagar airport pick-up & drop.',
      JSON.stringify([
        'Hotel & Houseboat accommodation (final category confirmed on quote)',
        '1-hour Shikara ride on Dal Lake (subject to package selection)',
        'Sightseeing transfers to Gulmarg, Pahalgam & Sonmarg',
      ]),
      JSON.stringify([
        'Airfare / Train tickets unless opted in',
        'Gulmarg Gondola tickets & pony rides in Pahalgam / Sonmarg',
        'Union cab fees at Pahalgam inner valleys (Aru, Betaab, Chandanwari)',
      ]),
      JSON.stringify([
        'Carry valid postpaid SIM cards (prepaid outside J&K does not roam in Kashmir)',
        'Carry Aadhaar / Passport copies for every traveller including children',
        'Gondola tickets should be booked well in advance once dates are confirmed',
      ]),
      34.0837,
      74.7973,
      1
    );
    const kashmirId = Number(kashmirRes.lastInsertRowid);

    const kashmirDays = [
      {
        day: 1,
        title: 'Srinagar Arrival & Dal Lake Shikara',
        location: 'Srinagar · Dal Lake',
        desc: 'Warm welcome at Srinagar Airport, transfer to Dal Lake Houseboat or hotel, followed by a peaceful sunset Shikara cruise.',
        meals: 'Dinner (To be confirmed)',
        stay: 'Srinagar Houseboat / Hotel',
        highlights: ['Shikara ride on Dal Lake', 'Mughal gardens sunset'],
      },
      {
        day: 2,
        title: 'Sonmarg Glacier Valley Excursion',
        location: 'Sonmarg · Sindh River',
        desc: 'Day trip to the Meadow of Gold (Sonmarg) surrounded by snow-clad peaks and alpine streams.',
        meals: 'Breakfast & Dinner (To be confirmed)',
        stay: 'Srinagar Hotel',
        highlights: ['Sonmarg meadows', 'Thajiwas approach'],
      },
      {
        day: 3,
        title: 'Gulmarg Snow & Gondola Experience',
        location: 'Gulmarg',
        desc: 'Drive to Gulmarg, enjoy snow vistas and optional Gondola cable car ride up to Kongdoori / Apharwat.',
        meals: 'Breakfast & Dinner (To be confirmed)',
        stay: 'Srinagar / Gulmarg',
        highlights: ['Gulmarg Gondola zone', 'Pine meadow walks'],
      },
      {
        day: 4,
        title: 'Pahalgam Valley of Shepherds',
        location: 'Pampore · Avantipura · Pahalgam',
        desc: 'Journey via saffron fields and Lidder River valley to scenic Pahalgam.',
        meals: 'Breakfast & Dinner (To be confirmed)',
        stay: 'Pahalgam Hotel',
        highlights: ['Saffron fields stop', 'Lidder River banks'],
      },
      {
        day: 5,
        title: 'Pahalgam Sightseeing & Return to Srinagar',
        location: 'Betaab Valley · Aru · Srinagar',
        desc: 'Optional local union cab tour to Betaab Valley & Aru Valley before returning to Srinagar for local handicraft shopping.',
        meals: 'Breakfast & Dinner (To be confirmed)',
        stay: 'Srinagar Hotel',
        highlights: ['Betaab Valley', 'Kashmiri handicraft market'],
      },
      {
        day: 6,
        title: 'Srinagar Departure',
        location: 'Srinagar Airport',
        desc: 'Breakfast and timely drop at Srinagar Airport for your onward flight.',
        meals: 'Breakfast (To be confirmed)',
        stay: 'Tour Concludes',
        highlights: ['Airport transfer'],
      },
    ];
    for (const d of kashmirDays) {
      insertDay.run(kashmirId, d.day, d.title, d.location, d.desc, d.meals, d.stay, JSON.stringify(d.highlights));
    }
    insertImage.run(kashmirId, 'Srinagar Dal Lake', '/src/assets/images/package_kashmir_dal_1795421892103.jpg', 'Dal Lake Shikara and Pir Panjal mountains', 1);

    // 3. Kedarkantha Trek
    const kedarkanthaRes = insertTrip.run(
      'kedarkantha-trek',
      'Kedarkantha Trek',
      'Sankri · Juda Ka Talab · Kedarkantha Summit, Uttarakhand',
      'Classic Himalayan Snow Ridge Expedition (Sample Trek — Confirm Batch)',
      'One of India’s most rewarding winter and spring Himalayan summit treks rising to ~12,500 ft through pine forests, frozen Juda Ka Talab, and sweeping 360-degree Garhwal mountain panoramas.',
      '/src/assets/images/package_kedarkantha_trek_1795421892114.jpg',
      '',
      '',
      5,
      4,
      null,
      null,
      null,
      'Dehradun ISBT / Railway Station (Batch Dates Pending Confirmation)',
      'Booking Open',
      0,
      'Sample Trek Package — Winter/Spring batch dates, gear rental inclusions & Dehradun pickup timing confirmed on enquiry.',
      'Base homestay/guesthouse in Sankri + Alpine dome tents on twin/triple sharing during trek.',
      'Nutritious vegetarian mountain meals during the trek (confirmed per batch).',
      'Dehradun to Sankri & return shared Tempo Traveller / SUV (as per final batch plan).',
      JSON.stringify([
        'Certified trek leader, local mountain guides & support crew',
        'Tented accommodation, sleeping bags & high-altitude mats (to be confirmed)',
        'Forest entry permits & basic first-aid medical kit',
      ]),
      JSON.stringify([
        'Personal trekking shoes, poles, jackets & backpack offloading',
        'Travel to/from Dehradun pickup hub',
        'Personal insurance or emergency evacuation costs',
      ]),
      JSON.stringify([
        'Basic cardiovascular fitness recommended prior to Himalayan altitude gain',
        'Layered thermals, waterproof trekking boots, gloves & headlamp are essential',
        'Summit push timing depends strictly on weather and trail snow conditions',
      ]),
      31.0216,
      78.1725,
      1
    );
    const kedarkanthaId = Number(kedarkanthaRes.lastInsertRowid);

    const kedarDays = [
      {
        day: 1,
        title: 'Dehradun to Sankri Base Village',
        location: 'Dehradun · Mussoorie Ridge · Sankri (6,400 ft)',
        desc: 'Scenic mountain drive along the Yamuna and Tons rivers arriving at Sankri village by evening for briefing and acclimatization.',
        meals: 'Dinner (To be confirmed)',
        stay: 'Sankri Guesthouse',
        highlights: ['Tons river valley drive', 'Trek briefing'],
      },
      {
        day: 2,
        title: 'Trek from Sankri to Juda Ka Talab',
        location: 'Juda Ka Talab (9,100 ft)',
        desc: 'Gradual ascent through oak and pine trails to the iconic mountain lake meadow at Juda Ka Talab.',
        meals: 'Breakfast, Lunch & Dinner (To be confirmed)',
        stay: 'Alpine Camp',
        highlights: ['Pine forest trail', 'Juda Ka Talab campsite'],
      },
      {
        day: 3,
        title: 'Juda Ka Talab to Kedarkantha Base Camp',
        location: 'Kedarkantha Base (11,250 ft)',
        desc: 'Short, steep ridge climb opening out to dramatic views of Swargarohini and Bandarpoonch peaks.',
        meals: 'Breakfast, Lunch & Dinner (To be confirmed)',
        stay: 'Base Camp Tents',
        highlights: ['High-altitude meadow camp', 'Stargazing & early rest'],
      },
      {
        day: 4,
        title: 'Summit Push & Descent to Hargaon',
        location: 'Kedarkantha Summit (12,500 ft) -> Hargaon',
        desc: 'Pre-dawn summit climb for sunrise over the Garhwal Himalayas, followed by controlled descent to Hargaon camp.',
        meals: 'Breakfast, Lunch & Dinner (To be confirmed)',
        stay: 'Hargaon Camp',
        highlights: ['Himalayan sunrise summit', '360° mountain panorama'],
      },
      {
        day: 5,
        title: 'Descent to Sankri & Drive to Dehradun',
        location: 'Sankri -> Dehradun',
        desc: 'Final forest descent to Sankri village followed by return drive to Dehradun.',
        meals: 'Breakfast (To be confirmed)',
        stay: 'Tour Concludes',
        highlights: ['Return drive to Dehradun'],
      },
    ];
    for (const d of kedarDays) {
      insertDay.run(kedarkanthaId, d.day, d.title, d.location, d.desc, d.meals, d.stay, JSON.stringify(d.highlights));
    }
    insertImage.run(kedarkanthaId, 'Kedarkantha Ridge', '/src/assets/images/package_kedarkantha_trek_1795421892114.jpg', 'Snow ridge ascent above morning cloud inversion', 1);
    insertImage.run(kedarkanthaId, 'Himalayan Base Camp', '/src/assets/images/gallery_alpine_camp_1795421891394.jpg', 'Twilight campsite under Himalayan peaks', 2);
  }

  const igCount = db.prepare('SELECT COUNT(*) as count FROM instagram_posts').get() as { count: number };
  if (igCount.count === 0) {
    const insertIg = db.prepare(
      'INSERT INTO instagram_posts (image_url, caption, post_url, tag) VALUES (?, ?, ?, ?)'
    );
    insertIg.run(
      '/src/assets/images/package_manali_solang_1795421892503.jpg',
      'Manali – Solang Valley – Atal Tunnel – Kasol – Manikaran Sahib group departures. Enquiry open via @aai_ekveera_mauli_tours_0139.',
      'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
      'Manali Special'
    );
    insertIg.run(
      '/src/assets/images/package_kashmir_dal_1795421892103.jpg',
      'Kashmir Holiday Package — Dal Lake Shikara mornings & snow valley tours for families and couples.',
      'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
      'Kashmir Holiday'
    );
    insertIg.run(
      '/src/assets/images/package_kedarkantha_trek_1795421892114.jpg',
      'Kedarkantha Trek — Himalayan sunrise ridge expedition. Enquire for upcoming seasonal batches.',
      'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
      'Himalayan Trek'
    );
    insertIg.run(
      '/src/assets/images/gallery_alpine_camp_1795421891394.jpg',
      'Bonfire evenings & guided mountain stays — आपला विश्वास... आमची जबाबदारी...',
      'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
      'Group Moments'
    );
  }

  const testCount = db.prepare('SELECT COUNT(*) as count FROM testimonials').get() as { count: number };
  if (testCount.count === 0) {
    const insertTest = db.prepare(
      'INSERT INTO testimonials (customer_name, city, trip_name, quote, rating, is_demo, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertTest.run(
      'Sample Guest Review (Demo)',
      'Pune, Maharashtra',
      'Manali & Kasol Group Tour',
      'Demonstration layout: Verified customer feedback added from the Admin Dashboard appears here with city and trip attribution.',
      5,
      1,
      1
    );
    insertTest.run(
      'Sample Family Review (Demo)',
      'Thane, Maharashtra',
      'Kashmir Holiday Package',
      'Demonstration layout: Replace this demonstration quote in the Admin Dashboard with verified traveller stories from your completed tours.',
      5,
      1,
      1
    );
    insertTest.run(
      'Sample Trekker Review (Demo)',
      'Nashik, Maharashtra',
      'Kedarkantha Trek',
      'Demonstration layout: Manage and publish real trekker testimonials anytime from the secure owner panel.',
      5,
      1,
      1
    );
  }

  const faqCount = db.prepare('SELECT COUNT(*) as count FROM faqs').get() as { count: number };
  if (faqCount.count === 0) {
    const insertFaq = db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)');
    insertFaq.run(
      'Is submitting the enquiry form a confirmed ticket booking?',
      'No. Submitting the form registers a priority booking enquiry with a unique Enquiry ID. Our tour coordinator verifies live seat availability, final hotel/transport plan, and payment instructions with you directly before confirming your seat.',
      1
    );
    insertFaq.run(
      'Can we customize dates or request a private couple/family package?',
      'Yes. Select "Couple" or "Family / Group" in the enquiry form and mention your preferred departure window and pickup city under additional requirements.',
      2
    );
    insertFaq.run(
      'How do I receive tour pricing and poster itineraries on WhatsApp?',
      'After submitting your enquiry, click "Continue on WhatsApp" on the confirmation card to send your pre-filled Enquiry ID directly to our operator.',
      3
    );
    insertFaq.run(
      'What documents are required for Himalayan & Kashmir tours?',
      'All adult and child travellers must carry a valid original Government Photo ID (Aadhaar Card, Passport, or Driving Licence). For Kashmir tours, carry a postpaid SIM card as outstation prepaid SIMs do not work in J&K.',
      4
    );
  }

  const defaultSettings: Record<string, string> = {
    businessName: 'AAI EKVEERA MAULI TOURS & TRAVEL',
    tagline: 'आपला विश्वास... आमची जबाबदारी...',
    mobile: '+91 00000 00000 (Placeholder — Update in Admin)',
    whatsapp: '',
    email: 'contact@placeholder-update-in-admin.in',
    adminNotificationEmail: '',
    officeAddress: 'Office Address Pending Owner Verification, Maharashtra, India',
    officeLat: '19.0760',
    officeLng: '72.8777',
    instagramHandle: '@aai_ekveera_mauli_tours_0139',
    instagramUrl: 'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
    completedTours: '',
    happyTravellers: '',
    statsVerified: 'false',
    contactVerified: 'false',
    cancellationPolicy:
      'Booking cancellation, rescheduling, and refund terms depend on the confirmed hotel, Volvo/cab, and rail/flight partner policies shared at the time of booking confirmation. Please verify exact cancellation slabs with Aai Ekveera Mauli Tours & Travel before making advance payments.',
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [key, val] of Object.entries(defaultSettings)) {
    insertSetting.run(key, val);
  }
}

export function getSettings(): SiteSettings {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  const parseNumOrNull = (val: string | undefined): number | null => {
    if (!val || val.trim() === '') return null;
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    businessName: map.businessName || 'AAI EKVEERA MAULI TOURS & TRAVEL',
    tagline: map.tagline || 'आपला विश्वास... आमची जबाबदारी...',
    mobile: map.mobile || '+91 00000 00000 (Placeholder — Update in Admin)',
    whatsapp: map.whatsapp || '',
    email: map.email || 'contact@placeholder-update-in-admin.in',
    adminNotificationEmail: map.adminNotificationEmail || '',
    officeAddress: map.officeAddress || 'Office Address Pending Owner Verification, Maharashtra, India',
    officeLat: Number(map.officeLat) || 19.076,
    officeLng: Number(map.officeLng) || 72.8777,
    instagramHandle: map.instagramHandle || '@aai_ekveera_mauli_tours_0139',
    instagramUrl: map.instagramUrl || 'https://www.instagram.com/aai_ekveera_mauli_tours_0139/',
    completedTours: parseNumOrNull(map.completedTours),
    happyTravellers: parseNumOrNull(map.happyTravellers),
    statsVerified: map.statsVerified === 'true',
    contactVerified: map.contactVerified === 'true',
    cancellationPolicy: map.cancellationPolicy || '',
  };
}

export function getAllTrips(): TripPackage[] {
  const tripRows = db.prepare('SELECT * FROM trips ORDER BY is_featured DESC, created_at DESC, id ASC').all() as Array<Record<string, unknown>>;
  const dayRows = db.prepare('SELECT * FROM itineraries ORDER BY trip_id ASC, day_number ASC').all() as Array<Record<string, unknown>>;
  const imgRows = db.prepare('SELECT * FROM destination_images ORDER BY sort_order ASC, id ASC').all() as Array<Record<string, unknown>>;

  const daysByTrip: Record<number, ItineraryDay[]> = {};
  for (const d of dayRows) {
    const tid = Number(d.trip_id);
    if (!daysByTrip[tid]) daysByTrip[tid] = [];
    daysByTrip[tid].push({
      id: Number(d.id),
      trip_id: tid,
      day_number: Number(d.day_number),
      title: String(d.title),
      location: String(d.location || ''),
      description: String(d.description || ''),
      meals: String(d.meals || ''),
      stay: String(d.stay || ''),
      highlights: parseJsonArray(d.highlights),
    });
  }

  const imgsByTrip: Record<number, DestinationImage[]> = {};
  for (const img of imgRows) {
    if (img.trip_id === null || img.trip_id === undefined) continue;
    const tid = Number(img.trip_id);
    if (!imgsByTrip[tid]) imgsByTrip[tid] = [];
    imgsByTrip[tid].push({
      id: Number(img.id),
      trip_id: tid,
      destination_name: String(img.destination_name || ''),
      image_url: String(img.image_url),
      caption: String(img.caption || ''),
      sort_order: Number(img.sort_order || 0),
      created_at: String(img.created_at || ''),
    });
  }

  return tripRows.map((row) => {
    const id = Number(row.id);
    return {
      id,
      slug: String(row.slug),
      title: String(row.title),
      destination: String(row.destination),
      subtitle: String(row.subtitle || ''),
      summary: String(row.summary || ''),
      cover_image: String(row.cover_image || ''),
      start_date: String(row.start_date || ''),
      return_date: String(row.return_date || ''),
      days: Number(row.days || 1),
      nights: Number(row.nights || 0),
      price_per_person: row.price_per_person === null || row.price_per_person === undefined ? null : Number(row.price_per_person),
      couple_price: row.couple_price === null || row.couple_price === undefined ? null : Number(row.couple_price),
      available_seats: row.available_seats === null || row.available_seats === undefined ? null : Number(row.available_seats),
      departure_location: String(row.departure_location || ''),
      status: String(row.status || 'Upcoming') as PackageStatus,
      is_verified: Boolean(row.is_verified),
      price_note: String(row.price_note || ''),
      hotel_info: String(row.hotel_info || ''),
      food_info: String(row.food_info || ''),
      transport_info: String(row.transport_info || ''),
      inclusions: parseJsonArray(row.inclusions),
      exclusions: parseJsonArray(row.exclusions),
      instructions: parseJsonArray(row.instructions),
      latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
      longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
      is_featured: Boolean(row.is_featured),
      created_at: String(row.created_at || ''),
      updated_at: String(row.updated_at || ''),
      itinerary: daysByTrip[id] || [],
      gallery: imgsByTrip[id] || [],
    };
  });
}

export function getGalleryImages(): DestinationImage[] {
  const rows = db.prepare('SELECT * FROM destination_images ORDER BY sort_order ASC, id DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    trip_id: r.trip_id === null || r.trip_id === undefined ? null : Number(r.trip_id),
    destination_name: String(r.destination_name || ''),
    image_url: String(r.image_url),
    caption: String(r.caption || ''),
    sort_order: Number(r.sort_order || 0),
    created_at: String(r.created_at || ''),
  }));
}

export function getTestimonials(onlyPublished: boolean): Testimonial[] {
  const sql = onlyPublished
    ? 'SELECT * FROM testimonials WHERE is_published = 1 ORDER BY id DESC'
    : 'SELECT * FROM testimonials ORDER BY id DESC';
  const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    customer_name: String(r.customer_name),
    city: String(r.city || ''),
    trip_name: String(r.trip_name || ''),
    quote: String(r.quote),
    rating: Number(r.rating || 5),
    is_demo: Boolean(r.is_demo),
    is_published: Boolean(r.is_published),
    created_at: String(r.created_at || ''),
  }));
}

export function getInstagramPosts(): InstagramPost[] {
  const rows = db.prepare('SELECT * FROM instagram_posts ORDER BY id DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    image_url: String(r.image_url),
    caption: String(r.caption || ''),
    post_url: String(r.post_url || 'https://www.instagram.com/aai_ekveera_mauli_tours_0139/'),
    tag: String(r.tag || ''),
    created_at: String(r.created_at || ''),
  }));
}

export function getFaqs(): FaqItem[] {
  const rows = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    question: String(r.question),
    answer: String(r.answer),
    sort_order: Number(r.sort_order || 0),
  }));
}

export function getEnquiries(): CustomerEnquiry[] {
  const rows = db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    enquiry_code: String(r.enquiry_code),
    trip_id: r.trip_id === null || r.trip_id === undefined ? null : Number(r.trip_id),
    trip_title: String(r.trip_title),
    full_name: String(r.full_name),
    mobile: String(r.mobile),
    email: String(r.email || ''),
    departure_date: String(r.departure_date || ''),
    adults: Number(r.adults || 1),
    children: Number(r.children || 0),
    total_travellers: Number(r.total_travellers || 1),
    package_type: String(r.package_type || 'Individual') as PackageType,
    pickup_location: String(r.pickup_location || ''),
    requirements: String(r.requirements || ''),
    status: String(r.status || 'New') as EnquiryStatus,
    customer_confirmed: Boolean(r.customer_confirmed),
    admin_notes: String(r.admin_notes || ''),
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
  }));
}

export function getEmailNotifications(limit = 100): EmailNotificationLog[] {
  const rows = db
    .prepare('SELECT * FROM email_notifications ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    enquiry_id: r.enquiry_id === null || r.enquiry_id === undefined ? null : Number(r.enquiry_id),
    recipient_email: String(r.recipient_email || ''),
    notification_type: String(r.notification_type || 'admin_new_enquiry') as EmailNotificationLog['notification_type'],
    subject: String(r.subject || ''),
    body_text: String(r.body_text || ''),
    action_url: String(r.action_url || ''),
    delivery_status: String(r.delivery_status || 'smtp_unconfigured') as EmailNotificationLog['delivery_status'],
    error_message: String(r.error_message || ''),
    created_at: String(r.created_at || ''),
  }));
}

seedInitialData();
