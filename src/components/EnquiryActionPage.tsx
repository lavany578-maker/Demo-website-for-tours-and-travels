import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, MailCheck, ShieldCheck } from 'lucide-react';
import { executeEnquiryAction, fetchEnquiryActionDetails } from '../lib/api.ts';

interface EnquiryActionPageProps {
  onGoHome: () => void;
}

export function EnquiryActionPage({ onGoHome }: EnquiryActionPageProps) {
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState<{
    action_type: 'customer_confirm' | 'admin_confirm';
    already_used: boolean;
    expired: boolean;
    enquiry: {
      enquiry_code: string;
      trip_title: string;
      full_name: string;
      departure_date: string;
      adults: number;
      children: number;
      total_travellers: number;
      package_type: string;
      pickup_location: string;
      status: string;
      customer_confirmed: boolean;
    };
  } | null>(null);

  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Confirmation link token is missing.');
      setLoading(false);
      return;
    }
    let active = true;
    fetchEnquiryActionDetails(token)
      .then((res) => {
        if (!active) return;
        setPreview(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load confirmation request.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await executeEnquiryAction(token);
      if (res.action_type === 'customer_confirm') {
        setCompletedMessage(
          res.adminNotified
            ? 'Thank you! Your enquiry request has been confirmed and our tour administrator has been notified via email.'
            : 'Thank you! Your enquiry request has been marked as confirmed by customer.'
        );
      } else {
        setCompletedMessage(
          res.customerEmailed
            ? `Enquiry ${res.enquiry_code} is now Confirmed, and a confirmation email has been queued for the customer.`
            : `Enquiry ${res.enquiry_code} has been marked as Confirmed.`
        );
      }
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              already_used: true,
              enquiry: {
                ...prev.enquiry,
                status: res.status,
                customer_confirmed: res.customer_confirmed,
              },
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete confirmation.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdminAction = preview?.action_type === 'admin_confirm';

  return (
    <main className="flex-1 bg-slate-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-7 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B1F3A] text-amber-300 flex items-center justify-center shrink-0">
            {isAdminAction ? <ShieldCheck className="w-6 h-6" /> : <MailCheck className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#0B1F3A]">
              {isAdminAction ? 'Administrator Request Confirmation' : 'Confirm Your Tour Enquiry Request'}
            </h1>
            <p className="text-xs text-slate-500">Aai Ekveera Mauli Tours &amp; Travel</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Verifying confirmation link...</p>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-sm text-rose-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div>{error}</div>
          </div>
        ) : preview ? (
          <div className="space-y-5">
            {completedMessage && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 text-sm text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>{completedMessage}</div>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Enquiry ID</div>
                <div className="font-mono font-bold text-[#0B1F3A] tabular-nums">
                  {preview.enquiry.enquiry_code}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Tour Package</div>
                <div className="font-semibold text-slate-800">{preview.enquiry.trip_title}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Traveller Name</div>
                <div className="font-medium text-slate-800">{preview.enquiry.full_name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Travellers &amp; Plan</div>
                <div className="font-mono text-slate-800 tabular-nums">
                  {preview.enquiry.total_travellers} ({preview.enquiry.adults}A / {preview.enquiry.children}C) ·{' '}
                  {preview.enquiry.package_type}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pickup &amp; Preferred Date</div>
                <div className="text-slate-800">
                  {preview.enquiry.pickup_location} · {preview.enquiry.departure_date || 'Flexible'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Current Status</div>
                <div className="font-semibold text-[#0B1F3A]">
                  {preview.enquiry.status}
                  {preview.enquiry.customer_confirmed ? ' · Customer Confirmed' : ''}
                </div>
              </div>
            </div>

            {preview.expired ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
                This confirmation link has expired. Please contact Aai Ekveera Mauli Tours &amp; Travel or manage the enquiry from the Admin Dashboard.
              </div>
            ) : preview.already_used ? (
              !completedMessage && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-xs text-sky-900">
                  This confirmation action has already been completed.
                </div>
              )
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isAdminAction
                    ? 'Clicking confirm below updates this customer enquiry to Confirmed and sends a confirmation email to the customer (if they provided an email address).'
                    : 'Clicking confirm below lets our tour team know you are ready to proceed with this enquiry so we can confirm availability and payment steps.'}
                </p>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="w-full py-3.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#13315C] disabled:bg-slate-400 rounded-xl transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Confirming...'
                    : isAdminAction
                      ? 'Confirm Customer Booking Request'
                      : 'Confirm My Enquiry Request'}
                </button>
              </div>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0B1F3A] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Return to Homepage
        </button>
      </div>
    </main>
  );
}
