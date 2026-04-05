import { ParseResult } from "../types";

const amountRegex = /(?:Ksh|KES)?\s?([\d,]+(?:\.\d{1,2})?)/i;
const codeRegex = /\b([A-Z0-9]{8,12})\b/;
const senderRegex = /from\s+([A-Za-z .'-]{3,})/i;
const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s?(?:AM|PM)?)/i;

export function parseTransactionText(rawText: string): ParseResult {
  const amountMatch = rawText.match(amountRegex);
  const codeMatch = rawText.match(codeRegex);
  const senderMatch = rawText.match(senderRegex);
  const dateMatch = rawText.match(dateRegex);

  if (!amountMatch || !codeMatch || !senderMatch) {
    throw new Error("Could not parse one or more required fields from message");
  }

  return {
    amount: Number(amountMatch[1].replace(/,/g, "")),
    transactionCode: codeMatch[1],
    senderName: senderMatch[1].trim(),
    timestamp: dateMatch?.[1] ?? new Date().toISOString(),
    source: /bank/i.test(rawText) ? "bank" : "mpesa",
  };
}
