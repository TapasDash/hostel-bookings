import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchBookingEmails } from "@/lib/gmail";
import { extractBookingsBatch } from "@/lib/extractor";

export const POST = async (request: Request) => {
  try {
    const session = await auth();

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Missing Google OAuth session or Gmail permissions. Please sign out and sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawDays = Number(body.days);
    const days = !isNaN(rawDays) && rawDays > 0 ? rawDays : 30;

    // Fetch matching emails from Gmail REST API
    const emails = await fetchBookingEmails(session.accessToken, days);

    if (emails.length === 0) {
      return NextResponse.json({
        bookings: [],
        scannedCount: 0,
        extractedCount: 0,
        message: `No booking emails found in the last ${days} days matching Hostelworld, Booking.com, Agoda, or reservation keywords.`,
      });
    }

    // Extract structured bookings using AI
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
