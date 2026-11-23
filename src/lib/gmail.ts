import { convert } from "html-to-text";

export interface CleanedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  timestamp: number;
  snippet: string;
  body: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    size?: number;
    data?: string;
  };
  parts?: GmailPart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  internalDate: string;
  snippet?: string;
  payload?: GmailPart;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
  nextPageToken?: string;
}

const decodeBase64Url = (base64url: string): string => {
  try {
    return Buffer.from(base64url, "base64url").toString("utf-8");
  } catch {
    return "";
  }
};

const extractPartsContent = (part?: GmailPart): { text: string; html: string } => {
  if (!part) return { text: "", html: "" };

  let text = "";
  let html = "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    text += decodeBase64Url(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data) {
    html += decodeBase64Url(part.body.data);
  }

  if (part.parts && Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      const extracted = extractPartsContent(subPart);
      if (extracted.text) text += (text ? "\n" : "") + extracted.text;
      if (extracted.html) html += (html ? "\n" : "") + extracted.html;
    }
  }

  return { text, html };
};

// Optimizes token consumption: skips footers/nav/links/images and truncates to 2000 characters
const cleanEmailBody = (text: string, html: string): string => {
  if (html) {
    const converted = convert(html, {
      wordwrap: false,
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
        { selector: "footer", format: "skip" },
        { selector: "nav", format: "skip" },
      ],
    });
    return converted.replace(/\n\s*\n\s*\n/g, "\n\n").trim().slice(0, 2000);
  }
  return text.replace(/\n\s*\n\s*\n/g, "\n\n").trim().slice(0, 2000);
};

const getHeader = (headers: GmailHeader[] | undefined, name: string): string => {
  if (!headers) return "";
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
};

// Pre-filter: identifies obvious promotional/marketing junk before calling AI, saving 100% of tokens for that email
const isMarketingEmail = (subject: string, snippet: string): boolean => {
  const combined = `${subject} ${snippet}`.toLowerCase();
  const marketingKeywords = [
    "review your stay",
    "how was your stay",
    "rate your stay",
    "rate your experience",
    "share your thoughts",
    "take our survey",
    "special offer",
    "exclusive offer",
    "deal of the day",
    "discount code",
    "travel inspiration",
    "explore destinations",
    "earn points",
    "newsletter",
  ];

  return marketingKeywords.some((keyword) => combined.includes(keyword));
};

export const fetchBookingEmails = async (
  accessToken: string,
  days: number = 30
): Promise<CleanedEmail[]> => {
  const dateFilter = days > 0 ? `newer_than:${days}d ` : "";
  const query = `${dateFilter}(from:hostelworld OR from:booking.com OR from:agoda OR from:airbnb OR from:expedia OR subject:(reservation OR booking OR confirmation OR "đặt phòng" OR "xác nhận" OR hostel OR hotel OR "check-in"))`;
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;

  const listRes = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!listRes.ok) {
    if (listRes.status === 401) {
      throw new Error("GMAIL_AUTH_EXPIRED: Gmail access token has expired. Please sign out and sign in again.");
    }
    const errorBody = await listRes.text().catch(() => "");
    throw new Error(`Gmail API error (${listRes.status}): ${listRes.statusText} ${errorBody}`);
  }

  const listData: GmailListResponse = await listRes.json();
  const messages = listData.messages ?? [];

  if (messages.length === 0) {
    return [];
  }

  // Fetch full message payloads in parallel with Promise.allSettled
  const messagePromises = messages.map(async (msg): Promise<CleanedEmail | null> => {
    try {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
      const detailRes = await fetch(detailUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!detailRes.ok) {
        return null;
      }

      const fullMsg: GmailMessageResponse = await detailRes.json();
      const headers = fullMsg.payload?.headers ?? [];
      const subject = getHeader(headers, "subject") || fullMsg.snippet || "No Subject";
      const snippet = fullMsg.snippet || "";

      // Skip obvious marketing emails to conserve AI tokens
      if (isMarketingEmail(subject, snippet)) {
        return null;
      }

      const { text, html } = extractPartsContent(fullMsg.payload);
      const cleanedBody = cleanEmailBody(text, html);
      const timestamp = parseInt(fullMsg.internalDate, 10) || Date.now();

      return {
        id: fullMsg.id,
        subject,
        from: getHeader(headers, "from") || "Unknown Sender",
        date: getHeader(headers, "date") || new Date(timestamp).toISOString(),
        timestamp,
        snippet,
        body: cleanedBody || snippet,
      };
    } catch {
      return null;
    }
  });

  const settledResults = await Promise.allSettled(messagePromises);

  return settledResults
    .filter(
      (result): result is PromiseFulfilledResult<CleanedEmail | null> =>
        result.status === "fulfilled" && result.value !== null
    )
    .map((result) => result.value as CleanedEmail);
};
