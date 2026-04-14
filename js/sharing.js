// URL sharing and study loading for Branchess
// Handles #g=<compressed PGN> for user-shared games
// and #s=<slug> for pre-saved studies

import LZString from '../lib/lz-string.min.js';
import { treeToRAV, ravToTree } from './pgn-rav.js';

const MAX_URL_LENGTH = 4096; // Safe limit for most platforms

// ── Encode game tree to shareable URL ──

export function encodeGameURL(root) {
  const pgn = treeToRAV(root);
  const compressed = LZString.compressToEncodedURIComponent(pgn);
  const base = window.location.href.split('#')[0].split('?')[0];
  const url = `${base}#g=${compressed}`;

  if (url.length > MAX_URL_LENGTH) {
    return { url, pgn, tooLong: true };
  }
  return { url, pgn, tooLong: false };
}

// ── Decode game from URL hash ──

export function decodeGameFromHash() {
  const hash = window.location.hash;
  if (!hash || hash.length < 3) return null;

  // #g=<compressed PGN>
  if (hash.startsWith('#g=')) {
    const compressed = hash.slice(3);
    try {
      const pgn = LZString.decompressFromEncodedURIComponent(compressed);
      if (!pgn) return null;
      const root = ravToTree(pgn);
      return { type: 'game', root, pgn };
    } catch {
      return null;
    }
  }

  // #s=<study-slug>
  if (hash.startsWith('#s=')) {
    const slug = hash.slice(3);
    return { type: 'study', slug };
  }

  return null;
}

// ── Load study PGN by slug ──

export async function loadStudy(slug) {
  const resp = await fetch(`studies/${slug}.pgn`);
  if (!resp.ok) throw new Error(`Study not found: ${slug}`);
  const pgn = await resp.text();
  const root = ravToTree(pgn);
  return root;
}

// ── Load study index ──

export async function loadStudyIndex() {
  const resp = await fetch('studies/index.json');
  if (!resp.ok) throw new Error('Could not load study library');
  return resp.json();
}

// ── Export PGN as downloadable file ──

export function downloadPGN(root, filename) {
  const pgn = treeToRAV(root);
  const name = filename.endsWith('.pgn') ? filename : filename + '.pgn';
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  return name;
}
