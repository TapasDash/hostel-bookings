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

// Selects Gemini if GEMINI_API_KEY is present, or Groq if GROQ_API_KEY is present
const getExtractorModel = () => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return { model: google("gemini-2.5-flash"), provider: "gemini" as const };
  }

  if (process.env.GROQ_API_KEY) {
    return { model: groq("llama-3.3-70b-versatile"), provider: "groq" as const };
  }

  throw new Error(
    "Missing AI API key: Please set GEMINI_API_KEY or GROQ_API_KEY in .env.local"
  );
};

const extractSingleBooking = async (
  email: CleanedEmail,
  maxRetries = 2
): Promise<Booking | null> => {
  const { model } = getExtractorModel();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model,
        schema: bookingSchema,
        prompt: `Extract structured hostel/hotel booking reservation details from this email.
If this is not an actual booking confirmation, modification, or cancellation (e.g. newsletter, review request, promo), set "isBookingEmail": false.

From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

${email.body}`,
      });

      return object;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // If billing/credit issue on Gemini, fail fast with a clear message so the user knows immediately
      if (
        errorMessage.includes("prepayment credits are depleted") ||
        errorMessage.includes("402") ||
        errorMessage.includes("RESOURCE_EXHAUSTED")
      ) {
        throw new Error(
          "AI Error (Gemini): Your prepayment credits are depleted. Please update your key in Google AI Studio (use a free tier project) or switch to a free GROQ_API_KEY from console.groq.com."
        );
      }

      if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("invalid api key")) {
        throw new Error("AI Error: Invalid API key provided for the AI provider.");
      }

      const isRateLimit =
        errorMessage.includes("429") ||
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("too many requests");

      if (isRateLimit && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2500;
        console.warn(`[AI Rate Limit] Retrying email ${email.id} in ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[Extractor] Error on email ${email.id}:`, errorMessage);
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

    const chunkResults = await Promise.all(
      chunk.map(async (email) => {
        const booking = await extractSingleBooking(email);
        return { booking, timestamp: email.timestamp };
      })
    );

    for (const res of chunkResults) {
      if (res.booking && res.booking.isBookingEmail) {
        extractedWithTimestamp.push({
          booking: res.booking,
          timestamp: res.timestamp,
        });
      }
    }

    if (i < chunks.length - 1) {
      await sleep(1000);
    }
  }

  // Deduplicate by bookingRef: keep the latest one based on email timestamp
  const deduplicatedMap = new Map<string, { booking: Booking; timestamp: number }>();

  for (const item of extractedWithTimestamp) {
    const ref = item.booking.bookingRef.trim().toUpperCase();
    const existing = deduplicatedMap.get(ref);

    if (!existing || item.timestamp >= existing.timestamp) {
      deduplicatedMap.set(ref, item);
    }
  }

  // Return clean list sorted with the latest/newest booking email first
  return Array.from(deduplicatedMap.values())
    .sort((a, b) => {
      // Primary sort: newest email received timestamp first
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      // Secondary fallback: newest check-in date
      return b.booking.checkIn.localeCompare(a.booking.checkIn);
    })
    .map((item) => item.booking);
};
