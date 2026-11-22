import { z } from "zod";

export const bookingSchema = z.object({
  isBookingEmail: z
    .boolean()
    .describe("Whether this email contains a hostel or hotel booking confirmation, modification, or cancellation."),
  action: z
    .enum(["new", "modified", "cancelled"])
    .describe("Booking status/action: 'new' for new booking, 'modified' for date/guest/room change, or 'cancelled' for cancellation."),
  otaSource: z
    .enum(["Hostelworld", "Booking.com", "Agoda", "Direct", "Other"])
    .describe("OTA platform or channel (Hostelworld, Booking.com, Agoda, Direct email, or Other)."),
  bookingRef: z
    .string()
    .describe("Booking reference number or reservation identifier (e.g. 'HW-12345678', '4028392102'). Return 'N/A' if missing."),
  guestName: z
    .string()
    .describe("Full name of the primary lead guest. Return 'N/A' if missing."),
  checkIn: z
    .string()
    .describe("Check-in date formatted strictly as YYYY-MM-DD. Return 'N/A' if missing."),
  checkOut: z
    .string()
    .describe("Check-out date formatted strictly as YYYY-MM-DD. Return 'N/A' if missing."),
  guestsCount: z
    .number()
    .describe("Total count of guests for this booking. Return 0 if not a booking email."),
  roomType: z
    .string()
    .describe("Room or bed category description (e.g. '8-Bed Mixed Dorm', 'Standard Double Private Room')."),
  totalPrice: z
    .number()
    .nullable()
    .describe("Total price amount as a numeric value (e.g. 150.00). Return null if not provided."),
  currency: z
    .string()
    .nullable()
    .describe("3-letter ISO currency code or currency symbol (e.g. 'USD', 'VND', 'EUR'). Return null if not provided."),
  notes: z
    .string()
    .nullable()
    .describe("Special requests, breakfast inclusions, deposit info, arrival time, or remarks. Return null if none."),
});

export type Booking = z.infer<typeof bookingSchema>;
