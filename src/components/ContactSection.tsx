import { useState, type FormEvent } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ExternalLink,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react';
import { buildWhatsAppUrl, submitContactMessage } from '../lib/api.ts';
import type { SiteSettings } from '../types/travel.ts';

interface ContactSectionProps {
  settings: SiteSettings;
  mapsApiKey: string;
}

function OfficeMarkerWithInfo({ settings }: { settings: SiteSettings }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const position = { lat: settings.officeLat, lng: settings.officeLng };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={() => setInfoOpen((v) => !v)}
        title={settings.businessName}
      >
        <Pin background="#0B1F3A" borderColor="#F59E0B" glyphColor="#FDE68A" />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={() => setInfoOpen(false)}>
          <div className="text-slate-900 p-1">
            <div className="font-semibold text-xs">{settings.businessName}</div>
            <div className="text-[11px] text-slate-600 mt-1">{settings.officeAddress}</div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function ContactSection({ settings, mapsApiKey }: ContactSectionProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const effectiveMapsKey = mapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const whatsappHref = buildWhatsAppUrl(
    settings.whatsapp,
    `Namaste ${settings.businessName}! I would like to enquire about upcoming tours.`
  );
  const googleMapsDirectUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${settings.officeLat},${settings.officeLng}`
  )}`;

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await submitContactMessage({ name, mobile, email, subject, message });
      setFeedback({ type: 'ok', text: res.message });
      setName('');
      setMobile('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to send message.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-16 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-sky-700 tracking-wide">Contact &amp; Office Location</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              Connect With {settings.businessName}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{settings.tagline}</p>
          </div>
          {!settings.contactVerified && (
            <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>Contact placeholders shown — Owner can verify details in Admin Settings</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Business Contact Details + Interactive Google Map */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">{settings.businessName}</h3>

              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-sky-700 shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-slate-500">Mobile Number</dt>
                    <dd className="font-medium text-slate-900 tabular-nums">{settings.mobile}</dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-slate-500">WhatsApp Desk</dt>
                    <dd className="font-medium text-slate-900 tabular-nums">
                      {whatsappHref ? (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:underline inline-flex items-center gap-1.5"
                        >
                          {settings.whatsapp}
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-slate-600">Pending Verification in Admin Settings</span>
                      )}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-sky-700 shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-slate-500">Email Address</dt>
                    <dd className="font-medium text-slate-900 break-all">{settings.email}</dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-sky-700 shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-slate-500">Office Address</dt>
                    <dd className="font-medium text-slate-900">{settings.officeAddress}</dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Instagram className="w-4 h-4 text-sky-700 shrink-0 mt-1" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-slate-500">Official Instagram</dt>
                    <dd>
                      <a
                        href={settings.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0B1F3A] hover:text-sky-700 inline-flex items-center gap-1.5"
                      >
                        {settings.instagramHandle}
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            {/* Interactive Google Map Container */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#0B1F3A]">Office Map Location</span>
                <a
                  href={googleMapsDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-sky-700 hover:underline inline-flex items-center gap-1"
                >
                  Open in Google Maps
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
              <div className="h-[320px] w-full relative">
                {effectiveMapsKey ? (
                  <APIProvider apiKey={effectiveMapsKey} language="en" region="IN">
                    <GoogleMap
                      mapId="DEMO_MAP_ID"
                      defaultCenter={{ lat: settings.officeLat, lng: settings.officeLng }}
                      defaultZoom={12}
                      gestureHandling="cooperative"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <OfficeMarkerWithInfo settings={settings} />
                    </GoogleMap>
                  </APIProvider>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
                    <MapPin className="w-8 h-8 text-sky-700 mb-2" aria-hidden="true" />
                    <p className="font-display text-sm font-semibold text-[#0B1F3A]">
                      {settings.officeAddress}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                      Pin Coordinates: {settings.officeLat.toFixed(4)}, {settings.officeLng.toFixed(4)}
                    </p>
                    <a
                      href={googleMapsDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B1F3A] rounded-lg"
                    >
                      View Pin on Google Maps
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Direct Contact Form */}
          <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-6 sm:p-8">
            <h3 className="font-display text-xl font-bold text-[#0B1F3A]">Send Us a Direct Message</h3>
            <p className="mt-1 text-sm text-slate-600">
              Questions about custom group bookings, corporate tours, or family departures? Write to our desk.
            </p>

            <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
              {feedback && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                  role="alert"
                >
                  {feedback.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Your Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="contact-mobile" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mobile Number *
                  </label>
                  <input
                    id="contact-mobile"
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email (Optional)
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Group Tour / Custom Quote"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-msg" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Message *
                </label>
                <textarea
                  id="contact-msg"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your destination interest, tentative travel month, and group size..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
