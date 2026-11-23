import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  Bus,
  Calendar,
  Check,
  CloudSun,
  MapPin,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { fetchWeather, formatINR } from '../lib/api.ts';
import type { TripPackage, WeatherResponse } from '../types/travel.ts';
import { SafeImage } from './SafeImage.tsx';

interface TripDetailsModalProps {
  trip: TripPackage;
  onClose: () => void;
  onBookTrip: (trip: TripPackage) => void;
}

export function TripDetailsModal({ trip, onClose, onBookTrip }: TripDetailsModalProps) {
  const photos = useMemo(() => {
    const urls = [
      { url: trip.cover_image, caption: trip.title },
      ...trip.gallery.map((g) => ({ url: g.image_url, caption: g.caption || g.destination_name })),
    ].filter((item) => item.url);
    const seen = new Set<string>();
    return urls.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }, [trip]);

  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    setSelectedPhotoIdx(0);
    setExpandedDay(1);
    if (trip.latitude !== null && trip.longitude !== null) {
      setWeatherLoading(true);
      fetchWeather(trip.latitude, trip.longitude)
        .then((res) => setWeather(res))
        .catch(() => setWeather({ configured: false, available: false, reason: 'Weather unavailable.' }))
        .finally(() => setWeatherLoading(false));
    } else {
      setWeather(null);
    }
  }, [trip]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isBookable = trip.status === 'Booking Open' || trip.status === 'Filling Fast';
  const currentPhoto = photos[selectedPhotoIdx] || { url: trip.cover_image, caption: trip.title };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden my-4"
      >
        {/* Modal Top Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-8 py-4 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="min-w-0">
            <div className="text-xs font-medium text-sky-700 truncate">
              {trip.destination} · {trip.days} Days / {trip.nights} Nights · {trip.status}
            </div>
            <h2 id="trip-modal-title" className="font-display text-lg sm:text-xl font-bold text-[#0B1F3A] truncate">
              {trip.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip details"
            className="w-10 h-10 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-8 space-y-8">
          {/* Gallery & Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-3">
              <div className="aspect-[16/10] rounded-xl overflow-hidden bg-slate-900">
                <SafeImage
                  src={currentPhoto.url}
                  alt={currentPhoto.caption}
                  className="w-full h-full object-cover"
                  fallbackTitle={trip.destination}
                />
              </div>
              {photos.length > 1 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {photos.map((p, idx) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className={`w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        idx === selectedPhotoIdx ? 'border-amber-500' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <SafeImage src={p.url} alt={p.caption} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              {!trip.is_verified && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{trip.price_note || 'Details shown are sample guidelines and require final confirmation.'}</span>
                </div>
              )}

              <p className="text-sm text-slate-600 leading-relaxed">{trip.summary}</p>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Price Per Person</span>
                  <span className="font-bold text-[#0B1F3A] tabular-nums">{formatINR(trip.price_per_person)}</span>
                </div>
                {trip.couple_price !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Couple Package</span>
                    <span className="font-bold text-[#0B1F3A] tabular-nums">{formatINR(trip.couple_price)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" aria-hidden="true" /> Schedule
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-800">
                    {trip.start_date && trip.return_date
                      ? `${trip.start_date} to ${trip.return_date}`
                      : 'Dates to be confirmed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4" aria-hidden="true" /> Seats
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-800">
                    {trip.available_seats !== null ? `${trip.available_seats} seats open` : 'Confirm on enquiry'}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                    <MapPin className="w-4 h-4" aria-hidden="true" /> Departure
                  </span>
                  <span className="text-xs text-slate-800 text-right">{trip.departure_location || 'Pending'}</span>
                </div>
              </div>

              {/* Honest Live Weather Widget */}
              <div className="rounded-xl bg-sky-50/70 border border-sky-200/80 p-4">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-sky-900">
                  <span className="flex items-center gap-1.5">
                    <CloudSun className="w-4 h-4 text-sky-600" aria-hidden="true" />
                    Destination Weather ({trip.destination.split(',')[0]})
                  </span>
                </div>
                {weatherLoading ? (
                  <p className="mt-2 text-xs text-sky-800">Checking live weather conditions...</p>
                ) : weather?.available ? (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Temp</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {weather.temperatureCelsius?.toFixed(1)}°C
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Condition</span>
                      <span className="font-medium text-slate-900">{weather.conditionText}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Humidity</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {weather.humidity ?? '—'}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-600">
                    {weather?.reason || 'Live weather is shown only when a live weather API key is active.'}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={!isBookable}
                onClick={() => onBookTrip(trip)}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold rounded-xl transition-colors ${
                  isBookable
                    ? 'text-white bg-[#0B1F3A] hover:bg-[#13315C] cursor-pointer'
                    : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                }`}
              >
                {isBookable ? 'Send Booking Enquiry' : `Currently ${trip.status}`}
                {isBookable && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Hotel, Food & Transport Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
                <BedDouble className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Hotel &amp; Stay
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {trip.hotel_info || 'Confirmed at quotation'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
                <Utensils className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Food &amp; Meals
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {trip.food_info || 'Confirmed at quotation'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
                <Bus className="w-4 h-4 text-sky-600" aria-hidden="true" />
                Transport
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                {trip.transport_info || 'Confirmed at quotation'}
              </p>
            </div>
          </div>

          {/* Interactive Day-Wise Itinerary Timeline */}
          <div>
            <h3 className="font-display text-lg font-bold text-[#0B1F3A] mb-4">
              Interactive Day-Wise Itinerary Timeline
            </h3>
            {trip.itinerary.length === 0 ? (
              <p className="text-sm text-slate-500">Day-wise itinerary will be added by the tour operator soon.</p>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-4 before:content-[''] before:absolute before:left-2.5 sm:before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {trip.itinerary.map((day) => {
                  const isOpen = expandedDay === day.day_number;
                  return (
                    <div key={day.day_number} className="relative">
                      <span
                        className={`absolute -left-6 sm:-left-8 top-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                          isOpen ? 'bg-[#0B1F3A] text-amber-300' : 'bg-sky-100 text-sky-800 border border-sky-300'
                        }`}
                      >
                        {day.day_number}
                      </span>
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedDay(isOpen ? 0 : day.day_number)}
                          className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="text-xs font-medium text-sky-700">
                              Day {day.day_number} · {day.location || trip.destination}
                            </div>
                            <div className="font-display text-sm sm:text-base font-semibold text-[#0B1F3A]">
                              {day.title}
                            </div>
                          </div>
                          <span className="text-xs font-medium text-slate-500 shrink-0">
                            {isOpen ? 'Hide' : 'Details'}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 text-xs sm:text-sm text-slate-600">
                            <p className="leading-relaxed">{day.description}</p>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                              <span>
                                <strong className="text-slate-700">Meals:</strong> {day.meals || 'To be confirmed'}
                              </span>
                              <span>
                                <strong className="text-slate-700">Stay:</strong> {day.stay || 'To be confirmed'}
                              </span>
                            </div>
                            {day.highlights.length > 0 && (
                              <div className="text-xs text-slate-600">
                                <strong className="text-slate-700">Highlights:</strong>{' '}
                                {day.highlights.join(' · ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inclusions, Exclusions & Travel Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 p-5">
              <h4 className="font-display text-sm font-bold text-[#0B1F3A] mb-3">Included Facilities</h4>
              <ul className="space-y-2 text-xs text-slate-600">
                {trip.inclusions.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h4 className="font-display text-sm font-bold text-[#0B1F3A] mb-3">Excluded Facilities</h4>
              <ul className="space-y-2 text-xs text-slate-600">
                {trip.exclusions.map((exc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{exc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {trip.instructions.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
              <h4 className="font-display text-sm font-bold text-[#0B1F3A] mb-2">Important Travel Instructions</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                {trip.instructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
