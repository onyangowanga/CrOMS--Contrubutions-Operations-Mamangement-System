import { ParseResult } from "../types";
import { normalizePersonName } from "./names";

const transactionCodePatterns = [
  /^\s*([A-Z0-9]{8,14})\b/i,
  /\b([A-Z0-9]{8,14})\s+confirmed\b/i,
  /\b(?:reference|ref)[:\s]+([A-Z0-9]{8,14})\b/i,
];

const amountPatterns = [
  /(?:ksh|kes)\s*([\d,]+(?:\.\d{1,2})?)\s+received\s+from/i,
  /(?:have\s+received|received)\s+(?:ksh|kes)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:ksh|kes)\s*([\d,]+(?:\.\d{1,2})?)/i,
];

const senderPatterns = [
  /received\s+from\s+(?:\+?\d{10,15})\s+([A-Za-z][A-Za-z .,'-]{2,}?)(?=\.|\s+new\b|\s+transaction\s+cost\b|$)/i,
  /from\s+([A-Za-z][A-Za-z .,'-]{2,}?)(?:\s+\d{3,4}\*{2,4}\d{2,4})?(?=\s+on\b|\s+at\b|\.|\s+new\b|$)/i,
  /(?:sender|sent\s+by|credited\s+by|deposited\s+by|paid\s+by)\s+([A-Za-z][A-Za-z .,'-]{2,}?)(?=\.|\s+on\b|\s+at\b|$)/i,
];

const accountPatterns = [
  /for\s+account\s+([A-Za-z0-9&][A-Za-z0-9& .,'\/-]{1,}?)(?=\s+on\b|\s+at\b|\.|\s+new\b|$)/i,
  /account[:\s]+([A-Za-z0-9&][A-Za-z0-9& .,'\/-]{1,}?)(?=\s+on\b|\s+at\b|\.|\s+new\b|$)/i,
];

const datePatterns = [
  /on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s?(?:AM|PM)?)/i,
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})(?:\s+(\d{1,2}:\d{2}\s?(?:AM|PM)?))?/i,
];

function extractFirstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match;
    }
  }

  return null;
}

function normalizeSenderName(value: string): string {
  const compact = value
    .replace(/\b\d{3,4}\*{2,4}\d{2,4}\b/g, "")
    .replace(/\b\+?\d{10,15}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[.,]+$/g, "")
    .trim();

  return normalizePersonName(compact) || compact;
}

function extractTimestamp(text: string): string {
  const match = extractFirstMatch(text, datePatterns);
  if (!match) {
    return new Date().toISOString();
  }

  const datePart = match[1] || "";
  const timePart = match[2] || "";
  return `${datePart} ${timePart}`.trim();
}

function detectSource(text: string): "mpesa" | "bank" {
  if (/m-?pesa|transaction cost|full number|confirmed\./i.test(text)) {
    return "mpesa";
  }

  if (/\bbank\b/i.test(text)) {
    return "bank";
  }

  return "mpesa";
}

function isLikelyTransactionCode(value: string): boolean {
  return /[A-Z]/i.test(value) && /\d/.test(value);
}

function extractTransactionCode(text: string): string | null {
  for (const pattern of transactionCodePatterns) {
    const match = text.match(pattern);
    if (match?.[1] && isLikelyTransactionCode(match[1])) {
      return match[1].toUpperCase();
    }
  }

  const tokens = text.match(/\b[A-Z0-9]{8,14}\b/gi) || [];
  const fallback = tokens.find(isLikelyTransactionCode);
  return fallback ? fallback.toUpperCase() : null;
}

export function parseTransactionText(rawText: string, fallbackSenderName?: string): ParseResult {
  const normalizedText = rawText.replace(/\s+/g, " ").trim();

  const amountMatch = extractFirstMatch(normalizedText, amountPatterns);
  const transactionCode = extractTransactionCode(normalizedText);
  const senderMatch = extractFirstMatch(normalizedText, senderPatterns);
  const accountMatch = extractFirstMatch(normalizedText, accountPatterns);
  const manualSenderName = normalizePersonName(fallbackSenderName?.trim()) || fallbackSenderName?.trim();
  const parsedSenderName = senderMatch?.[1]
    ? normalizeSenderName(senderMatch[1])
    : accountMatch?.[1]
      ? normalizeSenderName(accountMatch[1])
      : null;
  const senderName = manualSenderName || parsedSenderName;

  if (!amountMatch || !transactionCode || !senderName) {
    throw new Error("Could not parse one or more required fields from message");
  }

  return {
    amount: Number(amountMatch[1].replace(/,/g, "")),
    transactionCode,
    senderName,
    timestamp: extractTimestamp(normalizedText),
    source: detectSource(normalizedText),
  };
}
