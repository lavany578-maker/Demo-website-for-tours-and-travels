import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Instagram,
  Mail,
  Quote,
  Share2,
  Star,
} from 'lucide-react';
import { subscribeNewsletter } from '../lib/api.ts';
import type { FaqItem, InstagramPost, SiteSettings, Testimonial } from '../types/travel.ts';
import { SafeImage } from './SafeImage.tsx';

interface CommunityAndInfoSectionProps {
  instagramPosts: InstagramPost[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  settings: SiteSettings;
}

export function CommunityAndInfoSection({
  instagramPosts,
  testimonials,
  faqs,
  settings,
}: CommunityAndInfoSectionProps) {
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [openFaqId, setOpenFaqId] = useState<number | null>(faqs[0]?.id ?? null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);

  const activeTestimonial =
    testimonials.length > 0 ? testimonials[testimonialIdx % testimonials.length] : null;

  const handleShare = async () => {
    const shareData = {
      title: settings.businessName,
      text: `${settings.businessName} — ${settings.tagline}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to copy
      }
    }
    await navigator.clipboard?.writeText(window.location.href);
    setShareFeedback(true);
    window.setTimeout(() => setShareFeedback(false), 2500);
  };

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNewsletterStatus(null);
    setSubscribing(true);
    try {
      const res = await subscribeNewsletter(newsletterEmail);
      setNewsletterStatus({ type: 'ok', text: res.message });
      setNewsletterEmail('');
    } catch (err) {
      setNewsletterStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to subscribe.',
      });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div>
      {/* Instagram Integration & Photo Gallery */}
      <section id="instagram" className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-semibold text-sky-700 tracking-wide">
                Instagram {settings.instagramHandle}
              </p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0B1F3A]">
                Travel Moments &amp; Official Tour Posters
              </h2>
              <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                Curated trip posters and mountain moments uploaded directly by our team. Follow us on Instagram for departure reels and seasonal announcements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0B1F3A] bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                {shareFeedback ? 'Link Copied' : 'Share Website'}
              </button>

              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] rounded-xl transition-colors"
              >
                <Instagram className="w-4 h-4 text-amber-300" aria-hidden="true" />
                Follow {settings.instagramHandle}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {instagramPosts.map((post) => (
              <article
                key={post.id}
                className="group rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col"
              >
                <div className="aspect-[3/4] bg-slate-900 overflow-hidden">
                  <SafeImage
                    src={post.image_url}
                    alt={post.caption}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    fallbackTitle={post.tag || 'Instagram Gallery'}
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    {post.tag && <div className="text-xs font-semibold text-sky-700 mb-1">{post.tag}</div>}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{post.caption}</p>
                  </div>
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A] hover:text-sky-700"
                  >
                    View on Instagram
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Testimonial Carousel & FAQ Accordion */}
      <section id="faq" className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left: Testimonial Carousel */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold text-sky-700 tracking-wide">Traveller Stories</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">
                  Guest Experiences
                </h2>
              </div>
              {testimonials.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous testimonial"
                    onClick={() =>
                      setTestimonialIdx((i) => (i - 1 + testimonials.length) % testimonials.length)
                    }
                    className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next testimonial"
                    onClick={() => setTestimonialIdx((i) => (i + 1) % testimonials.length)}
                    className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {activeTestimonial ? (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-7">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTestimonial.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <Quote className="w-6 h-6 text-amber-500" aria-hidden="true" />
                      <div className="flex items-center gap-0.5 text-amber-500" aria-label={`${activeTestimonial.rating} out of 5 stars`}>
                        {Array.from({ length: activeTestimonial.rating }).map((_, idx) => (
                          <Star key={idx} className="w-4 h-4 fill-current" aria-hidden="true" />
                        ))}
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                      &ldquo;{activeTestimonial.quote}&rdquo;
                    </p>

                    <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-display text-sm font-bold text-[#0B1F3A]">
                          {activeTestimonial.customer_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {activeTestimonial.city} · {activeTestimonial.trip_name}
                        </div>
                      </div>
                      {activeTestimonial.is_demo && (
                        <span className="text-[11px] font-medium text-amber-700">Demo Placeholder</span>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No testimonials published yet.</p>
            )}
          </div>

          {/* Right: Frequently Asked Questions Accordion */}
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold text-sky-700 tracking-wide">Common Questions</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A] mb-5">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((item) => {
                const isOpen = openFaqId === item.id;
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="font-display text-sm font-semibold text-[#0B1F3A]">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Subscription Banner */}
      <section className="py-12 bg-sky-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              Receive Upcoming Group Departure Alerts
            </h2>
            <p className="mt-1 text-sm text-sky-200">
              Get notified when new Manali, Kashmir, and Himalayan batch dates open for booking.
            </p>
          </div>

          <form onSubmit={handleNewsletterSubmit} className="w-full lg:w-auto flex flex-col sm:flex-row gap-2.5">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <div className="relative flex-1 sm:w-72">
              <Mail
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="newsletter-email"
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full pl-10 pr-4 py-3 text-sm text-slate-900 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              type="submit"
              disabled={subscribing}
              className="px-5 py-3 text-sm font-semibold text-[#0B1F3A] bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        </div>
        {newsletterStatus && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
            <p className={`text-xs ${newsletterStatus.type === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {newsletterStatus.text}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
