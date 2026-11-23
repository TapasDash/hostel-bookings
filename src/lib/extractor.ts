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

// Exclusively uses Groq (100% free, no prepayment credits needed)
const getExtractorModel = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY: Please ensure GROQ_API_KEY is defined in .env.local and restart your dev server (or add it to Vercel Environment Variables)."
    );
  }

  return groq("openai/gpt-oss-120b");
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

      if (
        errorMessage.includes("API_KEY_INVALID") ||
        errorMessage.includes("invalid api key") ||
        errorMessage.includes("401")
      ) {
        throw new Error(
          "Groq API Error: Invalid GROQ_API_KEY. Please verify your key at https://console.groq.com."
        );
      }

      const isRateLimit =
        errorMessage.includes("429") ||
        errorMessage.toLowerCase().includes("rate limit") ||
        errorMessage.toLowerCase().includes("too many requests");

      if (isRateLimit && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 2000;
        console.warn(`[Groq Rate Limit] Retrying email ${email.id} in ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`[Groq Extractor] Error on email ${email.id}:`, errorMessage);
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
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.booking.checkIn.localeCompare(a.booking.checkIn);
    })
    .map((item) => item.booking);
};
