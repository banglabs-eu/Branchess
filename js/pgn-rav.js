// PGN RAV (Recursive Annotation Variation) export/import
// Converts between GameNode trees and PGN strings with full variation support

import { GameNode } from './game-tree.js';
import { Chess, parsePgn } from '../lib/chess.js';
import { STARTING_FEN } from './constants.js';

// ── Export: GameNode tree → PGN string with RAV ──

export function treeToRAV(root) {
  const parts = [];
  const startFen = root.fen;
  const isCustomStart = startFen !== STARTING_FEN;

  // PGN headers
  if (isCustomStart) {
    parts.push(`[SetUp "1"]\n[FEN "${startFen}"]\n\n`);
  }

  // Root comment
  if (root.note) {
    parts.push(`{${escapeComment(root.note)}} `);
  }

  walkExport(root, parts, true);

  // Trim trailing space and add termination marker
  let pgn = parts.join('').trim();
  if (!pgn.endsWith('*') && !pgn.endsWith('1-0') && !pgn.endsWith('0-1') && !pgn.endsWith('1/2-1/2')) {
    pgn += ' *';
  }

  return pgn;
}

function walkExport(node, parts, needsMoveNum) {
  if (!node.children.length) return;

  // Parent's FEN tells us whose turn it was before this move
  const fenParts = node.fen.split(' ');
  const turn = fenParts[1];  // 'w' or 'b'
  const moveNum = fenParts[5]; // fullmove number

  // 1. Write main line move (children[0])
  const main = node.children[0];
  if (turn === 'w' || needsMoveNum) {
    parts.push(turn === 'w' ? `${moveNum}. ` : `${moveNum}... `);
  }
  writeMove(main, parts);

  // 2. Write alternatives in parentheses — these appear RIGHT HERE,
  //    not after the entire main line
  for (let i = 1; i < node.children.length; i++) {
    const alt = node.children[i];
    parts.push(`(${turn === 'w' ? moveNum + '. ' : moveNum + '... '}`);
    writeMove(alt, parts);
    walkExport(alt, parts, false);
    trimTrailing(parts);
    parts.push(') ');
  }

  // 3. Continue main line (show move number after variations)
  walkExport(main, parts, node.children.length > 1);
}

function writeMove(child, parts) {
  parts.push(child.san);
  if (child.annotation) parts.push(child.annotation);
  parts.push(' ');
  if (child.note) parts.push(`{${escapeComment(child.note)}} `);
}

function trimTrailing(parts) {
  const last = parts[parts.length - 1];
  if (typeof last === 'string' && last.endsWith(' ')) {
    parts[parts.length - 1] = last.trimEnd();
  }
}

function escapeComment(text) {
  return text.replace(/\}/g, '\\}');
}

// ── Import: PGN string → GameNode tree with all variations ──

export function ravToTree(pgnText) {
  let parsed;
  try {
    parsed = parsePgn(pgnText);
  } catch (e) {
    throw new Error(`Invalid PGN: ${e.message}`);
  }

  // Determine starting position from FEN header
  let startFen = STARTING_FEN;
  if (parsed.headers) {
    for (const key in parsed.headers) {
      if (key.toLowerCase() === 'fen') {
        startFen = parsed.headers[key];
      }
    }
  }

  const chess = new Chess(startFen);
  const root = new GameNode(chess.fen());

  // Set root comment
  if (parsed.root && parsed.root.comment) {
    root.note = parsed.root.comment;
  }

  // Recursively walk parsed tree
  if (parsed.root) {
    walkImport(parsed.root, chess, root);
  }

  return root;
}

function walkImport(parsedNode, chess, gameNode) {
  for (const variation of parsedNode.variations) {
    // Variation roots (from RAV parentheses) have no move — recurse through them
    if (!variation.move) {
      walkImport(variation, chess, gameNode);
      continue;
    }

    let result;
    try {
      result = chess.move(variation.move);
    } catch {
      continue; // Skip invalid moves
    }
    if (!result) continue;

    const child = gameNode.addChild(
      { from: result.from, to: result.to, promotion: result.promotion || undefined },
      chess.fen(),
      result.san
    );

    // Preserve annotation and comment
    if (variation.suffix) {
      child.annotation = Array.isArray(variation.suffix) ? variation.suffix.join('') : variation.suffix;
    }
    if (variation.comment) child.note = variation.comment;

    // Recurse into this move's continuations
    walkImport(variation, chess, child);

    // Backtrack to parent position for next sibling variation
    chess.undo();
  }
}
