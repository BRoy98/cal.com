import type SendmailTransport from "nodemailer/lib/sendmail-transport";
import type SMTPConnection from "nodemailer/lib/smtp-connection";

import { isENVDev } from "@calcom/lib/env";

import { getAdditionalEmailHeaders } from "./getAdditionalEmailHeaders";

type EmailTransportType = "smtp" | "ses" | "resend";

function getTransportType(): EmailTransportType {
  const value = process.env.EMAIL_TRANSPORT?.toLowerCase();
  if (value === "ses") return "ses";
  if (value === "resend") return "resend";
  // Auto-detect resend when RESEND_API_KEY is set without explicit SMTP host config
  if (process.env.RESEND_API_KEY && !process.env.EMAIL_SERVER_HOST && !process.env.EMAIL_SERVER) {
    return "resend";
  }
  return "smtp";
}

function detectTransport(
  transportType: EmailTransportType
): SendmailTransport.Options | SMTPConnection.Options | string | undefined {
  // Non-SMTP transports handle their own delivery; no nodemailer transport needed
  if (transportType !== "smtp") return undefined;

  if (process.env.RESEND_API_KEY) {
    const transport = {
      host: "smtp.resend.com",
      secure: true,
      port: 465,
      auth: {
        user: "resend",
        pass: process.env.RESEND_API_KEY,
      },
    };

    return transport;
  }

  if (process.env.EMAIL_SERVER) {
    return process.env.EMAIL_SERVER;
  }

  if (process.env.EMAIL_SERVER_HOST) {
    const port = parseInt(process.env.EMAIL_SERVER_PORT || "");
    const auth =
      process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
        ? {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          }
        : undefined;

    const transport = {
      host: process.env.EMAIL_SERVER_HOST,
      port,
      auth,
      secure: port === 465,
      tls: {
        rejectUnauthorized: !isENVDev,
      },
    };

    return transport;
  }

  return {
    sendmail: true,
    newline: "unix",
    path: "/usr/sbin/sendmail",
  };
}

const transportType = getTransportType();

export const serverConfig = {
  transport: detectTransport(transportType),
  transportType,
  from: process.env.EMAIL_FROM,
  headers: getAdditionalEmailHeaders()[process.env.EMAIL_SERVER_HOST || ""] || undefined,
};
