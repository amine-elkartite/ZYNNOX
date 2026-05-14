import dns from "node:dns/promises";
import net from "node:net";
import { AppError } from "../utils/AppError.js";
import { cleanText } from "../utils/validation.js";

const PRIVATE_IPV4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^192\.168\./];

function privateIp(address) {
  if (net.isIP(address) === 4) return PRIVATE_IPV4.some((pattern) => pattern.test(address));
  return address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80");
}

async function assertPublicUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new AppError("Only HTTP/HTTPS URLs are allowed.", 400, "URL_PROTOCOL_BLOCKED");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || privateIp(url.hostname)) {
    throw new AppError("Private network URLs are blocked.", 400, "URL_HOST_BLOCKED");
  }
  const records = await dns.lookup(url.hostname, { all: true });
  if (records.some((record) => privateIp(record.address))) throw new AppError("Private resolved addresses are blocked.", 400, "URL_HOST_BLOCKED");
}

function stripHtml(html) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&"),
    20000
  );
}

export const extractUrlContentTool = {
  id: "url-extractor",
  name: "URL Content Extractor",
  description: "Fetch cleaned text from public URLs with SSRF protection.",
  creditCost: 0,
  async execute({ url }) {
    await assertPublicUrl(url);
    const response = await fetch(url, { headers: { "User-Agent": "ZYNNOX-Agent-Platform/1.0" } });
    if (!response.ok) throw new AppError("URL fetch failed.", response.status, "URL_FETCH_FAILED");
    return { url, content: stripHtml(await response.text()) };
  }
};
