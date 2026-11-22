import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { bookingSchema, type Booking } from "@/lib/schema";
import type { CleanedEmail } from "@/lib/gmail";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Selects Gemini (gemini-1.5-flash) if GEMINI_API_KEY is present,
// or Groq (llama-3.3-70b-versatile) if GROQ_API_KEY is present.
const getExtractorModel = () => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return google("gemini-1.5-flash");
  }

  if (process.env.GROQ_API_KEY) {
    return groq("llama-3.3-70b-versatile");
  }

  throw new Error(
    "Missing AI API key: Please set GEMINI_API_KEY (or GROQ_API_KEY) in .env.local"
  );
};

const extractSingleBooking = async (
  email: CleanedEmail,
  maxRetries = 2
): Promise<Booking | null> => {
  const model = getExtractorModel();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: bookingSchema,
        prompt: `You are an expert AI parser for hostel and hotel booking confirmation emails.
Extract structured reservation details from this email.
If this email is NOT an actual reservation confirmation, modification, or cancellation (e.g. promotional newsletter, general inquiry, review request, payment invoice notification without booking details), set "isBookingEmail": false and provide placeholder values for required strings (e.g. "N/A" for bookingRef, guestName, checkIn, checkOut, 0 for guestsCount).

Important extraction instructions:
- action: "new" for new bookings, "modified" for amendments/updates, "cancelled" for cancellations.
- otaSource: Detect whether it is from Hostelworld, Booking.com, Agoda, Direct, or Other based on sender and email content.
- bookingRef: Clean reservation ID or confirmation number (e.g., "HW-12345678", "4028392102").
- guestName: Full name of primary lead guest.
- checkIn & checkOut: Dates in YYYY-MM-DD format strictly.
- guestsCount: Total number of guests.
- roomType: Bed or room type (e.g. "6-Bed Mixed Dorm", "Double Room with Private Bathroom").
- totalPrice: Numeric total amount (e.g. 150.00) or null if not stated.
- currency: 3-letter currency code or symbol (e.g. "USD", "EUR", "VND") or null.
- notes: Any key notes like late arrival, deposit amount, or special requests, or null.

Email Details:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

Email Body:
${email.body}`,
      });

      return object;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        errorMessage.includes("429") ||
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("resource_exhausted") ||
        errorMessage.toLowerCase().includes("too many requests");

      if (isRateLimit && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2500;
        console.warn(`[AI Rate Limit] Retrying email ${email.id} in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[Extractor] Failed to extract email ${email.id}:`, errorMessage);
      return null;
    }
  }

  return null;
};

export const extractBookingsBatch = async (
  emails: CleanedEmail[]
): Promise<Booking[]> => {
  if (emails.length === 0) return [];

  const chunks = chunkArray(emails, 5);
  const extractedWithTimestamp: Array<{ booking: Booking; timestamp: number }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const chunkResults = await Promise.allSettled(
      chunk.map(async (email) => {
        const booking = await extractSingleBooking(email);
        return { booking, timestamp: email.timestamp };
      })
    );

    for (const res of chunkResults) {
      if (res.status === "fulfilled" && res.value.booking && res.value.booking.isBookingEmail) {
        extractedWithTimestamp.push({
          booking: res.value.booking,
          timestamp: res.value.timestamp,
        });
      }
    }

    // Small delay between chunks to avoid exhausting rate limits
    if (i < chunks.length - 1) {
      await sleep(1000);
    }
  }

  // Deduplicate by bookingRef: keep the latest one based on email timestamp
  // so cancellations/modifications override older new-booking emails
  const deduplicatedMap = new Map<string, { booking: Booking; timestamp: number }>();

  for (const item of extractedWithTimestamp) {
    const ref = item.booking.bookingRef.trim().toUpperCase();
    const existing = deduplicatedMap.get(ref);

    if (!existing || item.timestamp >= existing.timestamp) {
      deduplicatedMap.set(ref, item);
    }
  }

  // Return clean list sorted by check-in date
  return Array.from(deduplicatedMap.values())
    .map((item) => item.booking)
    .sort((a, b) => {
      if (a.checkIn === "N/A") return 1;
      if (b.checkIn === "N/A") return -1;
      return a.checkIn.localeCompare(b.checkIn);
    });
};
