import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Calendar, Compass, PhoneCall } from 'lucide-react';
import type { SiteSettings, TripPackage } from '../types/travel.ts';
import { SafeImage } from './SafeImage.tsx';

interface HeroSectionProps {
  trips: TripPackage[];
  settings: SiteSettings;
  onExploreTrips: () => void;
  onBookTrip: () => void;
  onContactUs: () => void;
  onViewTripDetails: (trip: TripPackage) => void;
}

function useAnimatedCount(target: number | null): number | null {
  const [count, setCount] = useState<number | null>(target);

  useEffect(() => {
    if (target === null) {
      setCount(null);
      return;
    }
    let frame = 0;
    const totalFrames = 28;
    const startVal = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startVal + (target - startVal) * eased));
      if (frame >= totalFrames) {
        window.clearInterval(timer);
      }
    }, 24);
    return () => window.clearInterval(timer);
  }, [target]);

  return count;
}

export function HeroSection({
  trips,
  settings,
  onExploreTrips,
  onBookTrip,
  onContactUs,
  onViewTripDetails,
}: HeroSectionProps) {
  const nextScheduledTrip = useMemo(() => {
    const now = Date.now();
    const valid = trips
      .filter((t) => {
        if (!t.start_date) return false;
        const ts = Date.parse(t.start_date);
        return Number.isFinite(ts) && ts > now && t.status !== 'Fully Booked';
      })
      .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
    return valid[0] || null;
  }, [trips]);

  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!nextScheduledTrip) return;
    const interval = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [nextScheduledTrip]);

  const countdown = useMemo(() => {
    if (!nextScheduledTrip) return null;
    const diff = Math.max(0, Date.parse(nextScheduledTrip.start_date) - nowTs);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    return { days, hours, mins, secs };
  }, [nextScheduledTrip, nowTs]);

  const uniqueDestinations = useMemo(() => {
    const set = new Set(trips.map((t) => t.destination.trim()).filter(Boolean));
    return set.size;
  }, [trips]);

  const animatedDestinations = useAnimatedCount(uniqueDestinations);
  const animatedTours = useAnimatedCount(settings.statsVerified ? settings.completedTours : null);
  const animatedTravellers = useAnimatedCount(settings.statsVerified ? settings.happyTravellers : null);

  return (
    <section className="relative overflow-hidden bg-[#0B1F3A] text-white">
      {/* Cinematic Himalayan Backdrop */}
      <div className="absolute inset-0">
        <SafeImage
          src="/src/assets/images/hero_himalayas_cinematic_1795421891116.jpg"
          alt="Snow-capped Himalayan peaks at golden sunrise"
          className="w-full h-full object-cover object-center"
          fallbackTitle="Himalayan Tours"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#07162B]/80 via-[#0B1F3A]/65 to-[#07162B]/95"
          aria-hidden="true"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-16 lg:pt-24 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Hero Narrative */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 flex flex-col justify-center"
          >
            <p className="text-sm sm:text-base font-medium text-amber-300 tracking-wide mb-3">
              {settings.businessName} <span aria-hidden="true" className="mx-2 text-sky-300/60">·</span>{' '}
              <span className="text-sky-100">{settings.tagline}</span>
            </p>

            <h1
              className="font-display font-bold tracking-tight text-white leading-[1.12] text-balance max-w-3xl"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
            >
              Explore The World With Aai Ekveera Mauli Tours &amp; Travel
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
              Your journey, our responsibility. Travel together, explore more and create unforgettable memories across curated group departures, family holidays, and couple mountain getaways.
            </p>

            {/* Three Prominent CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onExploreTrips}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#0B1F3A] bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Explore Upcoming Trips
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onBookTrip}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors whitespace-nowrap shrink-0 shadow-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Book Your Trip
              </button>

              <button
                type="button"
                onClick={onContactUs}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <PhoneCall className="w-4 h-4 text-amber-300" aria-hidden="true" />
                Contact Us
              </button>
            </div>
          </motion.div>

          {/* Right Glassmorphic Next Departure Countdown Widget */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col justify-end"
          >
            <div className="rounded-2xl bg-slate-950/55 backdrop-blur-xl border border-white/15 p-6 sm:p-7 shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5 text-sky-200 text-xs font-medium tracking-wide">
                  <Calendar className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span>Next Upcoming Departure</span>
                </div>
                <span className="text-xs text-slate-300">
                  {nextScheduledTrip ? nextScheduledTrip.status : 'Schedule Pending'}
                </span>
              </div>

              {nextScheduledTrip && countdown ? (
                <div className="mt-5">
                  <h2 className="font-display text-lg font-semibold text-white leading-snug">
                    {nextScheduledTrip.title}
                  </h2>
                  <p className="mt-1 text-xs text-sky-200/90">
                    {nextScheduledTrip.destination} · Departure{' '}
                    <span className="font-mono tabular-nums">{nextScheduledTrip.start_date}</span>
                  </p>

                  <div className="mt-5 grid grid-cols-4 gap-2.5 text-center">
                    {[
                      { label: 'Days', value: countdown.days },
                      { label: 'Hours', value: countdown.hours },
                      { label: 'Mins', value: countdown.mins },
                      { label: 'Secs', value: countdown.secs },
                    ].map((unit) => (
                      <div
                        key={unit.label}
                        className="rounded-xl bg-white/10 border border-white/10 py-3 px-2"
                      >
                        <div className="font-mono text-2xl font-semibold text-amber-300 tabular-nums">
                          {String(unit.value).padStart(2, '0')}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-300">{unit.label}</div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewTripDetails(nextScheduledTrip)}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 rounded-lg transition-colors cursor-pointer"
                  >
                    Inspect Departure Itinerary
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Compass className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h2 className="font-display text-base font-semibold text-white">
                        Upcoming Batch Dates Being Finalised
                      </h2>
                      <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                        Confirmed departure countdowns appear here automatically once batch dates are published in the Admin Dashboard. Enquiries are open now for Manali and Kedarkantha.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onBookTrip}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0B1F3A] bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Register Priority Enquiry
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Full-Width Verified Statistics Strip */}
        <div className="mt-12 pt-8 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-sky-200/80">Total Destinations</span>
            <span className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
              {animatedDestinations ?? 0}
            </span>
            <span className="mt-0.5 text-xs text-slate-300">
              Active mountain &amp; holiday corridors listed
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-sky-200/80">Completed Tours</span>
            {settings.statsVerified && animatedTours !== null ? (
              <>
                <span className="mt-1 font-display text-3xl font-bold text-amber-300 tabular-nums">
                  {animatedTours.toLocaleString('en-IN')}+
                </span>
                <span className="mt-0.5 text-xs text-slate-300">Verified agency departures completed</span>
              </>
            ) : (
              <>
                <span className="mt-1 font-display text-xl font-semibold text-slate-200">
                  Pending Verification
                </span>
                <span className="mt-0.5 text-xs text-slate-400">
                  Owner updates verified tour count in Admin
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-sky-200/80">Happy Travellers</span>
            {settings.statsVerified && animatedTravellers !== null ? (
              <>
                <span className="mt-1 font-display text-3xl font-bold text-amber-300 tabular-nums">
                  {animatedTravellers.toLocaleString('en-IN')}+
                </span>
                <span className="mt-0.5 text-xs text-slate-300">Verified guests travelled with us</span>
              </>
            ) : (
              <>
                <span className="mt-1 font-display text-xl font-semibold text-slate-200">
                  Pending Verification
                </span>
                <span className="mt-0.5 text-xs text-slate-400">
                  Owner updates verified guest count in Admin
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
