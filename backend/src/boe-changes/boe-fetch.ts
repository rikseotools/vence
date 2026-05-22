/**
 * Helpers puros de red y extracción para el monitoreo BOE.
 * Portado verbatim de `lib/api/boe-changes/queries.ts` — sin cambios de lógica;
 * solo funciones puras (sin DI, sin estado), fáciles de testear.
 */
import {
  FETCH_TIMEOUT_MS,
  SIZE_TOLERANCE_BYTES,
  type FullCheckResult,
  type HeadCheckResult,
  type PartialCheckResult,
} from './boe-changes.types';

const USER_AGENT = 'Mozilla/5.0 (compatible; VenceBot/1.0)';

/** `fetch()` con timeout: aborta la petición tras `timeoutMs`. */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Extrae la fecha de "Última actualización" del HTML consolidado del BOE. */
export function extractLastUpdateFromBOE(htmlContent: string): string | null {
  try {
    const cleanContent = htmlContent
      .replace(/&oacute;/g, 'ó')
      .replace(/&aacute;/g, 'á')
      .replace(/&eacute;/g, 'é')
      .replace(/&iacute;/g, 'í')
      .replace(/&uacute;/g, 'ú')
      .replace(/&ntilde;/g, 'ñ');

    const patterns = [
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /actualización, publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /Texto consolidado.*?(\d{2}\/\d{2}\/\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = cleanContent.match(pattern);
      if (match?.[1] && /^\d{2}\/\d{2}\/\d{4}$/.test(match[1])) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** FASE 0 — HTTP HEAD: compara Content-Length con tolerancia de tamaño. */
export async function checkWithContentLength(
  url: string,
  cachedContentLength: number | null,
): Promise<HeadCheckResult> {
  try {
    const response = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      return { success: false, reason: 'http_error', contentLength: null };
    }

    const header = response.headers.get('content-length');
    const contentLength = header ? parseInt(header, 10) : null;

    if (!contentLength || isNaN(contentLength)) {
      return { success: false, reason: 'no_content_length', contentLength: null };
    }

    if (!cachedContentLength) {
      return { success: false, reason: 'no_cache', contentLength, previousLength: null };
    }

    const sizeChange = Math.abs(contentLength - cachedContentLength);

    if (sizeChange > SIZE_TOLERANCE_BYTES) {
      return {
        success: false,
        reason: 'size_changed',
        contentLength,
        previousLength: cachedContentLength,
        sizeChange,
        bytesDownloaded: 0,
      };
    }

    return {
      success: true,
      method: 'head_unchanged',
      unchanged: true,
      contentLength,
      sizeChange: 0,
      bytesDownloaded: 0,
    };
  } catch {
    return { success: false, reason: 'fetch_error', contentLength: null };
  }
}

/** FASE 1 — descarga parcial: offset cacheado y, si falla, rangos progresivos. */
export async function checkWithPartialDownload(
  url: string,
  cachedOffset: number | null,
): Promise<PartialCheckResult> {
  if (cachedOffset && cachedOffset > 0) {
    const start = Math.max(0, cachedOffset - 1000);
    const end = cachedOffset + 5000;
    try {
      const response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': USER_AGENT, Range: `bytes=${start}-${end}` },
      });
      if (response.ok || response.status === 206) {
        const content = await response.text();
        const dateFound = extractLastUpdateFromBOE(content);
        if (dateFound) {
          return {
            success: true,
            method: 'cached_offset',
            lastUpdateBOE: dateFound,
            bytesDownloaded: content.length,
          };
        }
      }
    } catch {
      // continuar con rangos progresivos
    }
  }

  const ranges = [50000, 150000, 300000];
  let totalDownloaded = 0;

  for (const rangeEnd of ranges) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': USER_AGENT, Range: `bytes=0-${rangeEnd}` },
      });
      if (!response.ok && response.status !== 206) continue;

      const content = await response.text();
      totalDownloaded = content.length;
      const dateFound = extractLastUpdateFromBOE(content);

      if (dateFound) {
        const match = content.match(/actualización publicada el \d{2}\/\d{2}\/\d{4}/i);
        const offset = match ? content.indexOf(match[0]) : null;
        const method =
          rangeEnd <= 50000
            ? 'partial_50k'
            : rangeEnd <= 150000
              ? 'partial_150k'
              : 'partial_300k';
        return {
          success: true,
          method,
          lastUpdateBOE: dateFound,
          bytesDownloaded: totalDownloaded,
          dateOffset: offset,
        };
      }
    } catch {
      continue;
    }
  }

  return { success: false, reason: 'date_not_in_partial', bytesDownloaded: totalDownloaded };
}

/** FASE 2 — descarga completa (fallback). */
export async function checkWithFullDownload(url: string): Promise<FullCheckResult> {
  try {
    const response = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': USER_AGENT } },
      20_000,
    );

    if (!response.ok) {
      return { success: false, reason: 'http_error', bytesDownloaded: 0 };
    }

    const content = await response.text();
    const dateFound = extractLastUpdateFromBOE(content);

    if (!dateFound) {
      return {
        success: false,
        reason: 'date_not_found',
        method: 'full',
        bytesDownloaded: content.length,
      };
    }

    let dateOffset: number | null = null;
    const match = content.match(/actualización publicada el \d{2}\/\d{2}\/\d{4}/i);
    if (match) dateOffset = content.indexOf(match[0]);

    return {
      success: true,
      method: 'full',
      lastUpdateBOE: dateFound,
      bytesDownloaded: content.length,
      dateOffset,
    };
  } catch {
    return { success: false, reason: 'fetch_error', bytesDownloaded: 0 };
  }
}
