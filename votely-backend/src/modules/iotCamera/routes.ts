import { Router } from "express";
import net from "node:net";
import { asyncHandler, HttpError } from "../../shared/http.js";

const CAPTURE_TIMEOUT_MS = 5000;
const MAX_IMAGE_BYTES = 700_000;

export const iotCameraRouter = Router();

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;

  const ipVersion = net.isIP(host);
  if (!ipVersion) return false;
  if (host === "127.0.0.1" || host === "::1") return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;

  const parts = host.split(".").map((part) => Number(part));
  return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function normalizeCameraUrl(value: unknown) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) throw new HttpError(400, "IP atau URL ESP32-CAM wajib diisi.");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    url = new URL(`http://${raw}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError(400, "URL ESP32-CAM harus memakai http:// atau https://.");
  }

  if (!isPrivateHost(url.hostname)) {
    throw new HttpError(400, "URL ESP32-CAM harus mengarah ke alamat lokal/private network.");
  }

  return url;
}

function buildCameraUrls(value: unknown) {
  const url = normalizeCameraUrl(value);
  const isBaseUrl = url.pathname === "/" && !url.search;
  return {
    healthUrl: new URL("/health", url.origin).toString(),
    captureUrl: isBaseUrl ? new URL("/capture", url.origin).toString() : url.toString(),
    displayUrl: isBaseUrl ? url.origin : url.toString(),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAPTURE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "Votely-IoT-Camera/1.0",
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "ESP32-CAM tidak merespons dalam 5 detik.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJpeg(captureUrl: string) {
  const url = new URL(captureUrl);
  url.searchParams.set("ts", String(Date.now()));

  const response = await fetchWithTimeout(url.toString(), { method: "GET" });
  if (!response.ok) {
    if (response.status === 404) {
      throw new HttpError(404, "Endpoint gambar ESP32-CAM tidak ditemukan. Periksa path URL, misalnya /capture atau /cam-hi.jpg.");
    }
    throw new HttpError(response.status, `Capture ESP32-CAM gagal (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) throw new HttpError(502, "ESP32-CAM mengirim gambar kosong.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Gambar ESP32-CAM terlalu besar.");
  if (!contentType.toLowerCase().includes("image")) {
    throw new HttpError(502, "ESP32-CAM tidak mengirim response gambar.");
  }

  return {
    contentType,
    image: `data:${contentType};base64,${buffer.toString("base64")}`,
    size: buffer.length,
  };
}

iotCameraRouter.post("/health", asyncHandler(async (req, res) => {
  const urls = buildCameraUrls(req.body.cameraUrl);

  try {
    const response = await fetchWithTimeout(urls.healthUrl, { method: "GET" });
    if (response.ok) {
      const data = await response.json().catch(() => ({})) as { device?: string; ip?: string };
      res.json({
        ok: true,
        device: data?.device || "Votely-CAM",
        ip: data?.ip || new URL(urls.displayUrl).host,
        captureUrl: urls.captureUrl,
      });
      return;
    }
  } catch {
    // Some ESP32-CAM firmwares only expose a JPEG endpoint such as /cam-hi.jpg.
  }

  const jpeg = await fetchJpeg(urls.captureUrl);
  res.json({
    ok: true,
    device: "ESP32-CAM",
    ip: new URL(urls.displayUrl).host,
    captureUrl: urls.captureUrl,
    size: jpeg.size,
  });
}));

iotCameraRouter.post("/capture", asyncHandler(async (req, res) => {
  const urls = buildCameraUrls(req.body.cameraUrl);
  const jpeg = await fetchJpeg(urls.captureUrl);
  res.json({
    ok: true,
    image: jpeg.image,
    captureUrl: urls.captureUrl,
    size: jpeg.size,
  });
}));

iotCameraRouter.post("/preview", asyncHandler(async (req, res) => {
  const urls = buildCameraUrls(req.body.cameraUrl);
  const jpeg = await fetchJpeg(urls.captureUrl);
  res.json({
    ok: true,
    image: jpeg.image,
    captureUrl: urls.captureUrl,
    size: jpeg.size,
  });
}));
