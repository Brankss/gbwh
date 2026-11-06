import "server-only";
import { Redis } from "@upstash/redis";

// Una sola connessione per tutto il sito. In locale, senza variabili, si lavora in memoria.
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn("[redis] non configurato: i dati stanno solo in memoria e si perdono al riavvio.");
}
