import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Lock,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import { formatINR } from '../lib/api.ts';
import type { PackageStatus, PackageType, TripPackage } from '../types/travel.ts';
import { SafeImage } from './SafeImage.tsx';

interface TripPackagesSectionProps {
  trips: TripPackage[];
  loading: boolean;
  onViewDetails: (trip: TripPackage) => void;
  onBookNow: (trip: TripPackage, prefill?: { adults: number; children: number; packageType: PackageType }) => void;
}

function StatusLabel({ status }: { status: PackageStatus }) {
  if (status === 'Booking Open') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Booking Open
      </span>
    );
  }
  if (status === 'Filling Fast') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Filling Fast
      </span>
    );
  }
  if (status === 'Fully Booked') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Fully Booked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700">
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      Upcoming
    </span>
  );
}

export function TripPackagesSection({
  trips,
  loading,
  onViewDetails,
  onBookNow,
}: TripPackagesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PackageStatus>('All');
  const [sortMode, setSortMode] = useState<'featured' | 'recent'>('featured');
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Cost Calculator state
  const [calcTripId, setCalcTripId] = useState<number>(0);
  const [calcType, setCalcType] = useState<PackageType>('Individual');
  const [calcAdults, setCalcAdults] = useState(2);
  const [calcChildren, setCalcChildren] = useState(0);
  const [customEstimatePerPerson, setCustomEstimatePerPerson] = useState<string>('');

  useEffect(() => {
    if (trips.length > 0 && !trips.some((t) => t.id === calcTripId)) {
      setCalcTripId(trips[0].id);
    }
  }, [trips, calcTripId]);

  const featuredTrips = useMemo(() => {
    const f = trips.filter((t) => t.is_featured);
    return f.length > 0 ? f : trips;
  }, [trips]);

  useEffect(() => {
    if (featuredTrips.length <= 1) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % featuredTrips.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [featuredTrips.length]);

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = trips.filter((t) => {
      const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
      const matchesQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.destination.toLowerCase().includes(q) ||
        t.departure_location.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
    if (sortMode === 'recent') {
      return [...list].sort((a, b) => b.id - a.id);
    }
    return list;
  }, [trips, searchQuery, statusFilter, sortMode]);

  const recentlyAdded = useMemo(() => {
    return [...trips].sort((a, b) => b.id - a.id).slice(0, 3);
  }, [trips]);

  const activeCalcTrip = useMemo(
    () => trips.find((t) => t.id === calcTripId) || trips[0] || null,
    [trips, calcTripId]
  );

  const costSummary = useMemo(() => {
    if (!activeCalcTrip) return null;
    const manualRate = customEstimatePerPerson.trim() ? Number(customEstimatePerPerson) : null;
    const hasVerifiedPerson = activeCalcTrip.price_per_person !== null && activeCalcTrip.price_per_person > 0;
    const hasVerifiedCouple = activeCalcTrip.couple_price !== null && activeCalcTrip.couple_price > 0;

    if (calcType === 'Couple' && hasVerifiedCouple && activeCalcTrip.couple_price) {
      const couples = Math.max(1, Math.floor(calcAdults / 2));
      const extraAdults = calcAdults % 2;
      const personRate = activeCalcTrip.price_per_person || Math.round(activeCalcTrip.couple_price / 2);
      const childRate = Math.round(personRate * 0.7);
      const total = couples * activeCalcTrip.couple_price + extraAdults * personRate + calcChildren * childRate;
      return {
        isVerifiedTariff: activeCalcTrip.is_verified,
        total,
        breakdown: `${couples} Couple package(s)${extraAdults ? ` + ${extraAdults} adult` : ''}${
          calcChildren ? ` + ${calcChildren} child(ren)` : ''
        }`,
      };
    }

    if (hasVerifiedPerson && activeCalcTrip.price_per_person) {
      const childRate = Math.round(activeCalcTrip.price_per_person * 0.7);
      const total = calcAdults * activeCalcTrip.price_per_person + calcChildren * childRate;
      return {
        isVerifiedTariff: activeCalcTrip.is_verified,
        total,
        breakdown: `${calcAdults} adult(s) at ${formatINR(activeCalcTrip.price_per_person)}${
          calcChildren ? ` + ${calcChildren} child(ren) (est. 70% tariff)` : ''
        }`,
      };
    }

    if (manualRate && Number.isFinite(manualRate) && manualRate > 0) {
      const total = Math.round(calcAdults * manualRate + calcChildren * manualRate * 0.7);
      return {
        isVerifiedTariff: false,
        total,
        breakdown: `Custom budget estimate for ${calcAdults} adult(s)${
          calcChildren ? ` & ${calcChildren} child(ren)` : ''
        }`,
      };
    }

    return null;
  }, [activeCalcTrip, calcType, calcAdults, calcChildren, customEstimatePerPerson]);

  const activeSlide = featuredTrips[carouselIndex % Math.max(1, featuredTrips.length)];

  return (
    <div className="bg-slate-50">
      {/* Animated Destination Carousel */}
      {activeSlide && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-sky-700 tracking-wide">Featured Himalayan &amp; Holiday Circuits</p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A] text-balance">
                Curated Group, Family &amp; Couple Departures
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label="Previous destination"
                onClick={() =>
                  setCarouselIndex((i) => (i - 1 + featuredTrips.length) % featuredTrips.length)
                }
                className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-500 px-2">
                {String((carouselIndex % featuredTrips.length) + 1).padStart(2, '0')} /{' '}
                {String(featuredTrips.length).padStart(2, '0')}
              </span>
              <button
                type="button"
                aria-label="Next destination"
                onClick={() => setCarouselIndex((i) => (i + 1) % featuredTrips.length)}
                className="w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-1 lg:grid-cols-12 items-stretch"
              >
                <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[340px]">
                  <SafeImage
                    src={activeSlide.cover_image}
                    alt={activeSlide.title}
                    className="w-full h-full object-cover lg:absolute lg:inset-0"
                    fallbackTitle={activeSlide.destination}
                  />
                </div>
                <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <StatusLabel status={activeSlide.status} />
                      <span aria-hidden="true">·</span>
                      <span>{activeSlide.destination}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {activeSlide.days}D / {activeSlide.nights}N
                      </span>
                    </div>

                    <h3 className="mt-3 font-display text-xl sm:text-2xl font-bold text-[#0B1F3A] text-balance">
                      {activeSlide.title}
                    </h3>
                    <p className="mt-2.5 text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {activeSlide.summary}
                    </p>

                    <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Per Person</div>
                        <div className="mt-0.5 font-semibold text-[#0B1F3A] tabular-nums">
                          {formatINR(activeSlide.price_per_person)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Departure Hub</div>
                        <div className="mt-0.5 font-medium text-slate-800 truncate">
                          {activeSlide.departure_location || 'To be confirmed'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onViewDetails(activeSlide)}
                      className="px-4 py-2.5 text-sm font-semibold text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      View Itinerary Details
                    </button>
                    {(activeSlide.status === 'Booking Open' || activeSlide.status === 'Filling Fast') && (
                      <button
                        type="button"
                        onClick={() => onBookNow(activeSlide)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Enquire Now
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Main Upcoming Tour Packages Section */}
      <section id="packages" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold text-sky-700 tracking-wide">Tour Packages</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
              Upcoming Tour Packages
            </h2>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              Explore our active Himalayan and holiday itineraries. Packages marked as sample schedules require final date and tariff confirmation from our tour desk.
            </p>
          </div>

          {/* Search & Filter Widget */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative min-w-[230px]">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Manali, Kashmir, Trek..."
                aria-label="Search tour packages"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
              {(['All', 'Booking Open', 'Filling Fast', 'Upcoming', 'Fully Booked'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === status
                      ? 'bg-white text-[#0B1F3A] shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSortMode((m) => (m === 'featured' ? 'recent' : 'featured'))}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sort: {sortMode === 'featured' ? 'Featured' : 'Recently Added'}
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="rounded-2xl bg-white border border-slate-200 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  <div className="h-5 w-4/5 bg-slate-200 rounded" />
                  <div className="h-4 w-full bg-slate-100 rounded" />
                  <div className="h-10 w-full bg-slate-200 rounded-lg mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
            <p className="font-display text-lg font-semibold text-[#0B1F3A]">No matching tour packages</p>
            <p className="mt-1 text-sm text-slate-600">
              Try clearing your search filter or submit a custom destination enquiry below.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
              }}
              className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => {
              const isBookable = trip.status === 'Booking Open' || trip.status === 'Filling Fast';
              return (
                <article
                  key={trip.id}
                  className="group rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col hover:border-sky-300 transition-colors"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                    <SafeImage
                      src={trip.cover_image}
                      alt={trip.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      fallbackTitle={trip.destination}
                    />
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Unboxed Metadata Line (Zero-Pill Rule) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <StatusLabel status={trip.status} />
                      <span className="font-mono tabular-nums text-slate-500">
                        {trip.days} Days / {trip.nights} Nights
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-display text-lg font-bold text-[#0B1F3A] leading-snug text-balance">
                      {trip.title}
                    </h3>

                    <p className="mt-1 text-xs font-medium text-sky-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{trip.destination}</span>
                    </p>

                    {!trip.is_verified && (
                      <p className="mt-2 text-xs text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                        Sample schedule — Dates, pricing &amp; seats pending operator confirmation
                      </p>
                    )}

                    <dl className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          Dates
                        </dt>
                        <dd className="font-mono tabular-nums text-slate-800 text-right">
                          {trip.start_date && trip.return_date
                            ? `${trip.start_date} -> ${trip.return_date}`
                            : trip.start_date || 'To be confirmed'}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">Price / Person</dt>
                        <dd className="font-semibold text-[#0B1F3A] tabular-nums">
                          {formatINR(trip.price_per_person)}
                        </dd>
                      </div>

                      {trip.couple_price !== null && (
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-slate-500">Couple Package</dt>
                          <dd className="font-semibold text-[#0B1F3A] tabular-nums">
                            {formatINR(trip.couple_price)}
                          </dd>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-1.5 text-slate-500">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          Available Seats
                        </dt>
                        <dd className="font-mono tabular-nums text-slate-800">
                          {trip.available_seats !== null ? `${trip.available_seats} seats` : 'Confirm with operator'}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">Departure</dt>
                        <dd className="text-slate-800 text-right truncate max-w-[180px]" title={trip.departure_location}>
                          {trip.departure_location || 'To be confirmed'}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto pt-5 flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onViewDetails(trip)}
                        className="flex-1 px-3.5 py-2.5 text-xs font-semibold text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        disabled={!isBookable}
                        onClick={() => onBookNow(trip)}
                        className={`flex-1 px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                          isBookable
                            ? 'text-white bg-[#0B1F3A] hover:bg-[#13315C] cursor-pointer'
                            : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                        }`}
                      >
                        {trip.status === 'Fully Booked'
                          ? 'Fully Booked'
                          : isBookable
                          ? 'Book Now'
                          : 'Opens Soon'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Recently Added Tours Strip */}
        {recentlyAdded.length > 0 && (
          <div className="mt-14 pt-10 border-t border-slate-200">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">Recently Added Tours</h3>
              <span className="text-xs text-slate-500">Synced live from Tour Management</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recentlyAdded.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewDetails(item)}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-200 hover:border-sky-300 text-left transition-colors cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                    <SafeImage
                      src={item.cover_image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      fallbackTitle={item.destination}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-sky-700 font-medium truncate">{item.destination}</div>
                    <div className="font-display text-sm font-semibold text-[#0B1F3A] truncate">
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                      {item.days}D / {item.nights}N · {item.status}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Interactive Travel Cost Calculator */}
      <section id="calculator" className="bg-[#0B1F3A] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Calculator className="w-4 h-4" aria-hidden="true" />
                <span>Travel Cost Calculator</span>
              </div>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white text-balance">
                Estimate Your Group or Couple Tour Budget
              </h2>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                Select a tour package and traveller count to calculate an indicative estimate. When a package tariff is pending owner verification, you may enter a tentative per-person budget to plan ahead.
              </p>
            </div>

            <div className="lg:col-span-7 rounded-2xl bg-white text-slate-900 p-6 sm:p-8 shadow-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="calc-trip" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Tour Package
                  </label>
                  <select
                    id="calc-trip"
                    value={calcTripId}
                    onChange={(e) => setCalcTripId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.days}D/{t.nights}N)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Package Category</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                    {(['Individual', 'Couple', 'Family / Group'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setCalcType(type);
                          if (type === 'Couple' && calcAdults < 2) setCalcAdults(2);
                        }}
                        className={`px-2 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                          calcType === type
                            ? 'bg-white text-[#0B1F3A] shadow-sm font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {type === 'Family / Group' ? 'Family' : type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="calc-adults" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Adults
                    </label>
                    <input
                      id="calc-adults"
                      type="number"
                      min={1}
                      max={50}
                      value={calcAdults}
                      onChange={(e) => setCalcAdults(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="calc-children" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Children
                    </label>
                    <input
                      id="calc-children"
                      type="number"
                      min={0}
                      max={30}
                      value={calcChildren}
                      onChange={(e) => setCalcChildren(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {activeCalcTrip && activeCalcTrip.price_per_person === null && (
                  <div className="sm:col-span-2">
                    <label htmlFor="calc-custom-rate" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Optional Planning Budget Per Person (₹) — Current package tariff awaits confirmation
                    </label>
                    <input
                      id="calc-custom-rate"
                      type="number"
                      min={0}
                      placeholder="e.g. 12000"
                      value={customEstimatePerPerson}
                      onChange={(e) => setCustomEstimatePerPerson(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {costSummary
                      ? costSummary.isVerifiedTariff
                        ? 'Estimated Total (Based on Published Tariff)'
                        : 'Indicative Planning Total (Confirm Final Quote)'
                      : 'Tariff Pending Operator Confirmation'}
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] tabular-nums">
                    {costSummary ? formatINR(costSummary.total) : 'Request Official Quote'}
                  </div>
                  {costSummary && <div className="text-xs text-slate-500 mt-0.5">{costSummary.breakdown}</div>}
                </div>

                {activeCalcTrip && (
                  <button
                    type="button"
                    onClick={() =>
                      onBookNow(activeCalcTrip, {
                        adults: calcAdults,
                        children: calcChildren,
                        packageType: calcType,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Enquire With These Details
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
