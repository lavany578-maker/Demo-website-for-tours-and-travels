import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, Info, MessageCircle, Send } from 'lucide-react';
import { buildWhatsAppUrl, submitEnquiry } from '../lib/api.ts';
import type { PackageType, SiteSettings, TripPackage } from '../types/travel.ts';

interface EnquirySectionProps {
  trips: TripPackage[];
  settings: SiteSettings;
  preselectedTripId?: number | null;
  prefillConfig?: { adults: number; children: number; packageType: PackageType } | null;
}

export function EnquirySection({
  trips,
  settings,
  preselectedTripId,
  prefillConfig,
}: EnquirySectionProps) {
  const openTrips = useMemo(
    () => trips.filter((t) => t.status === 'Booking Open' || t.status === 'Filling Fast'),
    [trips]
  );

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [tripId, setTripId] = useState<number>(0);
  const [departureDate, setDepartureDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [packageType, setPackageType] = useState<PackageType>('Individual');
  const [pickupLocation, setPickupLocation] = useState('');
  const [requirements, setRequirements] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    enquiry_code: string;
    trip_title: string;
    full_name: string;
    mobile: string;
    departure_date: string;
    total_travellers: number;
    package_type: string;
    pickup_location: string;
    emailSummary?: {
      adminEmailConfigured: boolean;
      adminEmailStatus: string;
      customerEmailProvided: boolean;
      customerEmailStatus: string;
    };
  } | null>(null);

  useEffect(() => {
    if (preselectedTripId && openTrips.some((t) => t.id === preselectedTripId)) {
      setTripId(preselectedTripId);
      const found = openTrips.find((t) => t.id === preselectedTripId);
      if (found?.start_date) setDepartureDate(found.start_date);
    } else if (openTrips.length > 0 && !openTrips.some((t) => t.id === tripId)) {
      setTripId(openTrips[0].id);
      if (openTrips[0].start_date) setDepartureDate(openTrips[0].start_date);
    }
  }, [openTrips, preselectedTripId, tripId]);

  useEffect(() => {
    if (prefillConfig) {
      setAdults(prefillConfig.adults);
      setChildren(prefillConfig.children);
      setPackageType(prefillConfig.packageType);
    }
  }, [prefillConfig]);

  const totalTravellers = adults + children;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tripId) {
      setError('No tours are currently marked open for booking. Please check back soon or contact us.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitEnquiry({
        fullName,
        mobile,
        email,
        tripId,
        departureDate,
        adults,
        children,
        totalTravellers,
        packageType,
        pickupLocation,
        requirements,
      });
      setConfirmation({ ...res.enquiry, emailSummary: res.emailSummary });
      setFullName('');
      setMobile('');
      setEmail('');
      setPickupLocation('');
      setRequirements('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit enquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappSummary = confirmation
    ? `Namaste ${settings.businessName}! My Enquiry ID is ${confirmation.enquiry_code}.\nTour: ${confirmation.trip_title}\nName: ${confirmation.full_name}\nTravellers: ${confirmation.total_travellers} (${confirmation.package_type})\nPreferred Date: ${confirmation.departure_date || 'Flexible'}\nPickup: ${confirmation.pickup_location}`
    : '';

  const whatsappUrl = confirmation ? buildWhatsAppUrl(settings.whatsapp, whatsappSummary) : null;

  return (
    <section id="enquiry" className="py-16 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Explanation & Booking Policy */}
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-semibold text-sky-700 tracking-wide">Booking Enquiry Desk</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] text-balance">
              Reserve Your Priority Tour Enquiry
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Submit your traveller preferences for tours currently marked as open by our team. Every submission creates a tracked Enquiry ID for priority confirmation.
            </p>

            <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 space-y-2 text-xs text-sky-950">
              <div className="flex items-center gap-2 font-semibold">
                <Info className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
                Enquiry vs. Confirmed Booking Notice
              </div>
              <p className="leading-relaxed text-sky-900">
                This form submits a booking enquiry, not an instant confirmed ticket. Our tour coordinator confirms live seat availability, exact itinerary pricing, and payment steps directly with you.
              </p>
            </div>

            <div className="pt-2 space-y-2 text-xs text-slate-600">
              <div className="font-semibold text-[#0B1F3A]">Currently Open for Enquiries ({openTrips.length})</div>
              {openTrips.length === 0 ? (
                <p className="text-slate-500">All listed packages are currently closed or upcoming.</p>
              ) : (
                <ul className="space-y-1.5">
                  {openTrips.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                      <span className="truncate font-medium text-slate-800">{t.title}</span>
                      <span className="text-emerald-700 font-semibold shrink-0">{t.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Form / Confirmation Card */}
          <div className="lg:col-span-7">
            {confirmation ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#0B1F3A]">
                      Enquiry Registered Successfully
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Keep your Enquiry ID handy. Our coordinator will review seat availability and reach out to confirm dates and payment.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-emerald-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Unique Enquiry ID</div>
                    <div className="font-mono text-base font-bold text-[#0B1F3A] tabular-nums">
                      {confirmation.enquiry_code}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Selected Tour</div>
                    <div className="font-semibold text-slate-800 truncate">{confirmation.trip_title}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Travellers &amp; Plan</div>
                    <div className="font-medium text-slate-800 tabular-nums">
                      {confirmation.total_travellers} Traveller(s) · {confirmation.package_type}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Pickup City</div>
                    <div className="font-medium text-slate-800">{confirmation.pickup_location}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      Continue on WhatsApp
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(whatsappSummary);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 2500);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      {copied ? 'Enquiry Summary Copied' : 'Copy Enquiry Summary for WhatsApp'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmation(null)}
                    className="px-4 py-3 text-sm font-semibold text-[#0B1F3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    Submit Another Enquiry
                  </button>
                </div>

                {confirmation.emailSummary && (
                  <div className="rounded-lg bg-white/80 border border-emerald-200 px-3.5 py-2.5 text-xs text-slate-700 space-y-1.5">
                    {confirmation.emailSummary.adminEmailConfigured && (
                      <p className="font-medium text-emerald-900">
                        {confirmation.emailSummary.adminEmailStatus === 'sent'
                          ? 'Our tour administrator has been notified automatically via email.'
                          : 'Our tour administrator notification has been logged for review in the booking desk.'}
                      </p>
                    )}
                    {confirmation.emailSummary.customerEmailProvided ? (
                      confirmation.emailSummary.customerEmailStatus === 'sent' ? (
                        <p>
                          A confirmation email has been sent to your inbox. Please click the link inside to confirm your enquiry request so our team can prioritize your booking.
                        </p>
                      ) : (
                        <p>
                          Your enquiry confirmation request has been logged in our system (SMTP email delivery is pending server configuration; our team will still review it in the Admin Dashboard).
                        </p>
                      )
                    ) : (
                      <p>
                        Tip: Add your email address next time to receive one-click email request confirmation and booking updates.
                      </p>
                    )}
                  </div>
                )}

                {!whatsappUrl && (
                  <p className="text-xs text-slate-500">
                    Note: Operator WhatsApp number is currently pending verification in Admin Settings. Copy your enquiry summary above or check the Contact section.
                  </p>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8 space-y-4"
              >
                {error && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800" role="alert">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="enq-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      id="enq-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rajesh Kulkarni"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="enq-mobile" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Mobile / WhatsApp Number *
                    </label>
                    <input
                      id="enq-mobile"
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="enq-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address (Optional)
                    </label>
                    <input
                      id="enq-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="enq-trip" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Available Trip *
                    </label>
                    <select
                      id="enq-trip"
                      required
                      value={tripId}
                      onChange={(e) => {
                        const nextId = Number(e.target.value);
                        setTripId(nextId);
                        const chosen = openTrips.find((t) => t.id === nextId);
                        if (chosen?.start_date) setDepartureDate(chosen.start_date);
                      }}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {openTrips.length === 0 ? (
                        <option value={0}>No trips open for booking</option>
                      ) : (
                        openTrips.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.status})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="enq-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Preferred Departure Date
                    </label>
                    <input
                      id="enq-date"
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="enq-type" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Package Type *
                    </label>
                    <select
                      id="enq-type"
                      value={packageType}
                      onChange={(e) => setPackageType(e.target.value as PackageType)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Individual">Individual</option>
                      <option value="Couple">Couple Package</option>
                      <option value="Family / Group">Family / Group</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="enq-adults" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Adults *
                      </label>
                      <input
                        id="enq-adults"
                        type="number"
                        min={1}
                        max={50}
                        required
                        value={adults}
                        onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="enq-children" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Children
                      </label>
                      <input
                        id="enq-children"
                        type="number"
                        min={0}
                        max={30}
                        value={children}
                        onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="enq-total" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Total
                      </label>
                      <input
                        id="enq-total"
                        type="text"
                        readOnly
                        value={totalTravellers}
                        className="w-full px-3 py-2.5 text-sm font-mono tabular-nums bg-slate-100 border border-slate-200 rounded-lg text-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="enq-pickup" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Pickup Location / City *
                    </label>
                    <input
                      id="enq-pickup"
                      type="text"
                      required
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      placeholder="e.g. Pune / Mumbai / Thane / Delhi"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="enq-req" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Additional Requirements
                  </label>
                  <textarea
                    id="enq-req"
                    rows={3}
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="Mention preferred room sharing, meal preferences, train/flight help, or custom dates..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || openTrips.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] disabled:bg-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  {submitting ? 'Submitting Enquiry...' : 'Submit Enquiry'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
