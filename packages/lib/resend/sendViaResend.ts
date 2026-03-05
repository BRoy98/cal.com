interface ResendAttachment {
  filename: string;
  content: string;
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string[];
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
}

function parseAddresses(value: unknown): string[] {
  if (!value) return [];
  const raw = String(value);
  return raw.split(",").map((addr) => addr.trim());
}

function extractHeadersObject(headers: unknown): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object") return undefined;

  const result: Record<string, string> = {};

  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && typeof h === "object" && "key" in h && "value" in h) {
        result[String(h.key)] = String(h.value);
      }
    }
  } else {
    for (const [key, val] of Object.entries(headers as Record<string, unknown>)) {
      result[key] = String(val);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function buildAttachments(payload: Record<string, unknown>): ResendAttachment[] {
  const attachments: ResendAttachment[] = [];

  // Handle nodemailer-style icalEvent: { content: string, method: string }
  const icalEvent = payload.icalEvent as { content?: string; method?: string } | undefined;
  if (icalEvent?.content) {
    attachments.push({
      filename: "invite.ics",
      content: Buffer.from(icalEvent.content).toString("base64"),
    });
  }

  // Handle nodemailer-style attachments array
  const rawAttachments = payload.attachments as
    | Array<{ filename?: string; content?: string | Buffer; encoding?: string }>
    | undefined;

  if (Array.isArray(rawAttachments)) {
    for (const att of rawAttachments) {
      if (!att.content) continue;
      const content = Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : att.encoding === "base64"
          ? att.content
          : Buffer.from(att.content).toString("base64");

      attachments.push({
        filename: att.filename || "attachment",
        content,
      });
    }
  }

  return attachments;
}

export async function sendViaResend(payload: Record<string, unknown>): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_TRANSPORT=resend");
  }

  const attachments = buildAttachments(payload);
  const headers = extractHeadersObject(payload.headers);

  const replyTo = payload.replyTo ? parseAddresses(payload.replyTo) : undefined;

  const body: ResendPayload = {
    from: String(payload.from || ""),
    to: parseAddresses(payload.to),
    subject: String(payload.subject || ""),
    ...(payload.html ? { html: String(payload.html) } : {}),
    ...(payload.text ? { text: String(payload.text) } : {}),
    ...(replyTo && replyTo.length > 0 && { reply_to: replyTo }),
    ...(headers && { headers }),
    ...(attachments.length > 0 && { attachments }),
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }
}
