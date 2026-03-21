# web.Branchess

Web port of the Branchess desktop app (python.Branchess). Static site — pure HTML/CSS/JS, no frameworks, no build tools.

## Run locally

```bash
python3 -m http.server 8083
# Open http://localhost:8083
```

## Architecture

- **Board**: CSS grid of 64 divs, Unicode chess pieces with text-shadow outlines
- **Engine**: Stockfish 18 WASM (single-threaded, nmrugg/stockfish.js) in Web Worker
- **Tree**: SVG-based game tree visualization with bezier edges
- **State**: Single GameState object with pub/sub EventEmitter
- **Persistence**: IndexedDB for save/load positions

## File structure

```
index.html          Entry point
css/main.css        Layout, dark theme, board
css/tree.css        Tree SVG styles
css/dialogs.css     Promotion, save/load, setup dialogs
js/main.js          Wires everything together
js/constants.js     Colors, Unicode map, layout defaults
js/state.js         GameState + EventEmitter
js/game-tree.js     GameNode class + tree layout algorithm
js/board.js         8x8 CSS grid board rendering
js/moves.js         Click-to-move, promotion, engine triggering
js/engine.js        StochasticEngine (wraps worker, softmax, cache)
js/stockfish-worker.js  Web Worker loading Stockfish WASM
js/tree-view.js     SVG tree visualization
js/animation.js     CSS transition piece slides
js/setup.js         Setup mode: piece palette, castling inference
js/persistence.js   IndexedDB save/load + dialogs
js/ui-panel.js      Side panel: buttons, slider, move list
lib/chess.js        Vendored chess.js v1.4.0 (ESM)
lib/stockfish/      Vendored Stockfish 18 lite WASM (single-threaded)
```

## Key algorithms (ported from python.Branchess)

- Softmax move selection: `s / (temperature * 100)`, standard softmax
- Tree layout: recursive, leaves get sequential x, parents centered
- Cache key: first 4 FEN fields (position, turn, castling, en passant)
- Back/forward: 2-ply steps (player + engine)
- Castling inference: check king/rook on starting squares
