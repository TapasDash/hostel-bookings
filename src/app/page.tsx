"use client";

import { useState, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Download,
  RefreshCw,
  Search,
  LogIn,
  LogOut,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Building2,
  ShieldCheck,
  Mail,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { Booking } from "@/lib/schema";
import { downloadBookingsExcel } from "@/lib/excel";
import { translations, type Language } from "@/lib/i18n";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [lang, setLang] = useState<Language>("en");
  const [days, setDays] = useState<number>(30);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOta, setSelectedOta] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const t = translations[lang];

  const handleSync = async () => {
    if (!session) {
      setErrorMessage(t.unauthenticatedDescription);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSyncNotice(null);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync reservations.");
      }

      setBookings(data.bookings || []);
      setSyncNotice(t.syncSummary(data.scannedCount || 0, data.extractedCount || 0));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (filteredBookings.length === 0) return;
    downloadBookingsExcel(filteredBookings, lang);
  };

  // Filter pipeline
  const filteredBookings = useMemo(() => {
    return bookings.filter((item) => {
      // Search query filter (guest name or booking ref)
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.bookingRef.toLowerCase().includes(searchQuery.toLowerCase());

      // OTA Source filter
      const matchesOta =
        selectedOta === "ALL" || item.otaSource.toLowerCase() === selectedOta.toLowerCase();

      // Status action filter
      const matchesStatus =
        selectedStatus === "ALL" || item.action.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesOta && matchesStatus;
    });
  }, [bookings, searchQuery, selectedOta, selectedStatus]);

  // Derived stats
  const totalCount = bookings.length;
  const newCount = bookings.filter((b) => b.action === "new").length;
  const cancelledCount = bookings.filter((b) => b.action === "cancelled").length;
  const totalGuests = bookings.reduce((acc, curr) => acc + (curr.guestsCount || 0), 0);

  const getStatusBadge = (action: Booking["action"]) => {
    if (action === "new") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {t.statusNew}
        </span>
      );
    }
    if (action === "modified") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {t.statusModified}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
        {t.statusCancelled}
      </span>
    );
  };

  const getOtaBadge = (source: Booking["otaSource"]) => {
    const styleMap: Record<Booking["otaSource"], string> = {
      Hostelworld: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      "Booking.com": "bg-blue-500/10 text-blue-400 border-blue-500/20",
      Agoda: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      Direct: "bg-teal-500/10 text-teal-400 border-teal-500/20",
      Other: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styleMap[source] || styleMap.Other}`}
      >
        {source}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F8FAFC] pb-16">
      {/* Top Bar */}
      <header className="border-b border-[#1E293B] bg-[#111114]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4F46E5]/15 border border-[#4F46E5]/30 flex items-center justify-center text-[#4F46E5]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-base sm:text-lg tracking-tight text-[#F8FAFC] flex items-center gap-2">
                {t.appTitle}
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  <Sparkles className="w-3 h-3" /> Stateless
                </span>
              </h1>
              <p className="text-xs text-[#94A3B8] hidden md:block">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* EN / VI Language Switcher */}
            <div className="flex items-center bg-[#16161A] p-0.5 rounded-lg border border-[#1E293B]">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  lang === "en"
                    ? "bg-[#4F46E5] text-white shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("vi")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  lang === "vi"
                    ? "bg-[#4F46E5] text-white shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                VI
              </button>
            </div>

            {/* Google OAuth Login / Logout */}
            {status === "loading" ? (
              <div className="h-9 w-24 bg-[#16161A] animate-pulse rounded-lg border border-[#1E293B]" />
            ) : session?.user ? (
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-medium text-[#F8FAFC]">{session.user.name}</span>
                  <span className="text-[11px] text-[#94A3B8] truncate max-w-[140px]">
                    {session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#16161A] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E293B] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.signOut}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google")}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#F8FAFC] text-[#09090B] hover:bg-white/90 shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t.signInWithGoogle}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Unauthenticated Alert Banner */}
        {!session && status !== "loading" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-300">{t.unauthenticatedTitle}</h3>
                <p className="text-xs text-amber-400/80 mt-0.5">{t.unauthenticatedDescription}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-400 text-[#09090B] hover:bg-amber-300 transition-colors shadow-sm shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              {t.signInWithGoogle}
            </button>
          </div>
        )}

        {/* Sync Success / Error Notification */}
        {syncNotice && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {t.errorPrefix} {errorMessage}
            </span>
          </div>
        )}

        {/* Bento Control Bar */}
        <section className="rounded-2xl border border-[#1E293B] bg-[#111114] p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#94A3B8] flex items-center gap-1.5 mr-1">
                <Calendar className="w-3.5 h-3.5" />
                {t.dateRange}:
              </span>
              <div className="inline-flex p-1 bg-[#16161A] rounded-xl border border-[#1E293B] flex-wrap gap-1">
                {([1, 3, 7, 14, 30, 90] as const).map((dayOption) => (
                  <button
                    key={dayOption}
                    type="button"
                    onClick={() => setDays(dayOption)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                      days === dayOption
                        ? "bg-[#4F46E5] text-white shadow"
                        : "text-[#94A3B8] hover:text-[#F8FAFC]"
                    }`}
                  >
                    {dayOption === 1
                      ? t.today
                      : dayOption === 3
                      ? t.last3Days
                      : dayOption === 7
                      ? t.last7Days
                      : dayOption === 14
                      ? t.last14Days
                      : dayOption === 30
                      ? t.last30Days
                      : t.last90Days}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Sync & Export */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSync}
                disabled={isLoading || !session}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? t.syncing : t.syncBookings}
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={filteredBookings.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#16161A] hover:bg-[#1E293B] text-[#F8FAFC] border border-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                {t.downloadExcel}
              </button>
            </div>
          </div>
        </section>

        {/* Stats Strip Bento Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#1E293B] bg-[#111114] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8] font-medium">{t.totalBookings}</p>
              <p className="text-2xl font-bold font-mono text-[#F8FAFC] mt-1">{totalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E293B] bg-[#111114] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8] font-medium">{t.newBookings}</p>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{newCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E293B] bg-[#111114] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8] font-medium">{t.cancelledBookings}</p>
              <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{cancelledCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E293B] bg-[#111114] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#94A3B8] font-medium">{t.totalGuests}</p>
              <p className="text-2xl font-bold font-mono text-indigo-300 mt-1">{totalGuests}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* Filter Bar Bento Box */}
        <section className="rounded-2xl border border-[#1E293B] bg-[#111114] p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-[#16161A] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* OTA Source Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["ALL", "Hostelworld", "Booking.com", "Agoda", "Direct"] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setSelectedOta(source)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      selectedOta === source
                        ? "bg-[#4F46E5]/15 text-[#F8FAFC] border-[#4F46E5]"
                        : "bg-[#16161A] text-[#94A3B8] border-[#1E293B] hover:text-[#F8FAFC] hover:border-slate-700"
                    }`}
                  >
                    {source === "ALL" ? t.allSources : source}
                  </button>
                ))}
              </div>

              {/* Status Action Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap sm:border-l sm:border-[#1E293B] sm:pl-3">
                {(["ALL", "new", "modified", "cancelled"] as const).map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => setSelectedStatus(statusKey)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      selectedStatus === statusKey
                        ? "bg-slate-700 text-[#F8FAFC] border-slate-500"
                        : "bg-[#16161A] text-[#94A3B8] border-[#1E293B] hover:text-[#F8FAFC]"
                    }`}
                  >
                    {statusKey === "ALL"
                      ? t.allActions
                      : statusKey === "new"
                      ? t.statusNew
                      : statusKey === "modified"
                      ? t.statusModified
                      : t.statusCancelled}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bookings Data Table */}
        <section className="rounded-2xl border border-[#1E293B] bg-[#111114] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#16161A]/50 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  <th className="py-3.5 px-4">{t.statusCol}</th>
                  <th className="py-3.5 px-4">{t.channelCol}</th>
                  <th className="py-3.5 px-4">{t.refCol}</th>
                  <th className="py-3.5 px-4">{t.guestCol}</th>
                  <th className="py-3.5 px-4">{t.checkInCol}</th>
                  <th className="py-3.5 px-4">{t.checkOutCol}</th>
                  <th className="py-3.5 px-4 text-center">{t.guestsCol}</th>
                  <th className="py-3.5 px-4">{t.roomCol}</th>
                  <th className="py-3.5 px-4 text-right">{t.priceCol}</th>
                  <th className="py-3.5 px-4">{t.notesCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-xs">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((b, index) => (
                    <tr
                      key={`${b.bookingRef}-${index}`}
                      className="hover:bg-[#16161A]/50 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(b.action)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{getOtaBadge(b.otaSource)}</td>
                      <td className="py-3 px-4 font-mono font-medium text-indigo-300 whitespace-nowrap">
                        {b.bookingRef}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#F8FAFC] whitespace-nowrap">
                        {b.guestName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#94A3B8] whitespace-nowrap">
                        {b.checkIn}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#94A3B8] whitespace-nowrap">
                        {b.checkOut}
                      </td>
                      <td className="py-3 px-4 font-mono text-center font-medium text-[#F8FAFC]">
                        {b.guestsCount}
                      </td>
                      <td className="py-3 px-4 text-[#F8FAFC] max-w-xs truncate" title={b.roomType}>
                        {b.roomType}
                      </td>
                      <td className="py-3 px-4 font-mono text-right font-medium text-[#F8FAFC] whitespace-nowrap">
                        {b.totalPrice !== null ? (
                          <>
                            {b.totalPrice.toLocaleString()}{" "}
                            <span className="text-[11px] text-[#94A3B8]">{b.currency ?? ""}</span>
                          </>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-[#94A3B8] max-w-xs truncate text-[11px]"
                        title={b.notes ?? ""}
                      >
                        {b.notes || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#16161A] border border-[#1E293B] flex items-center justify-center text-[#94A3B8] mb-3">
                          <Building2 className="w-6 h-6 opacity-40" />
                        </div>
                        <h4 className="text-sm font-semibold text-[#F8FAFC] mb-1">{t.emptyTitle}</h4>
                        <p className="text-xs text-[#94A3B8] leading-relaxed mb-4">
                          {t.emptyDescription}
                        </p>
                        {session ? (
                          <button
                            type="button"
                            onClick={handleSync}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-all shadow-sm"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            {t.syncBookings}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => signIn("google")}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#F8FAFC] text-[#09090B] hover:bg-white/90 transition-all shadow-sm"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            {t.signInWithGoogle}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer info badge */}
        <footer className="text-center pt-4">
          <p className="text-[11px] text-[#94A3B8]/60 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4F46E5]" />
            {t.statelessNotice}
          </p>
        </footer>
      </main>
    </div>
  );
}
