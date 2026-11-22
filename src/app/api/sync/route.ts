import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchBookingEmails } from "@/lib/gmail";
import { extractBookingsBatch } from "@/lib/extractor";

export const POST = async (request: Request) => {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing Google OAuth session or Gmail permissions." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawDays = body.days;
    const days: 1 | 3 | 7 = rawDays === 1 || rawDays === 7 ? rawDays : 3;

    // Fetch matching emails from Gmail REST API
    const emails = await fetchBookingEmails(session.accessToken, days);

    if (emails.length === 0) {
      return NextResponse.json({
        bookings: [],
        scannedCount: 0,
        extractedCount: 0,
      });
    }

    // Extract structured bookings using Groq LLM + Zod
    const bookings = await extractBookingsBatch(emails);

    return NextResponse.json({
      bookings,
      scannedCount: emails.length,
      extractedCount: bookings.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const isAuthError =
      message.includes("GMAIL_AUTH_EXPIRED") || message.includes("401");

    console.error("[Sync API Error]", message);

    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 401 : 500 }
    );
  }
};
