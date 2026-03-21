// Setup mode — piece palette, castling inference
// Ported from Branchess.py lines 988-1573
import { UNICODE_PIECES, COLOR_BTN_ACTIVE } from './constants.js';
import { GameNode } from './game-tree.js';

const PALETTE = [
  null, // eraser
  { type: 'k', color: 'w' }, { type: 'q', color: 'w' }, { type: 'r', color: 'w' },
  { type: 'b', color: 'w' }, { type: 'n', color: 'w' }, { type: 'p', color: 'w' },
  { type: 'k', color: 'b' }, { type: 'q', color: 'b' }, { type: 'r', color: 'b' },
  { type: 'b', color: 'b' }, { type: 'n', color: 'b' }, { type: 'p', color: 'b' },
];

export class SetupPanel {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this._built = false;

    state.on('setupModeChanged', () => this._toggle());
  }

  _toggle() {
    if (this.state.setupMode) {
      this._build();
      this.container.style.display = '';
    } else {
      this.container.style.display = 'none';
    }
  }

  _build() {
    this.container.innerHTML = '';
    this._built = true;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Setup Board';
    title.style.color = '#b4dc8c';
    this.container.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'setup-desc';
    desc.innerHTML = 'Click piece, then board.<br>Right-click to remove.';
    this.container.appendChild(desc);

    // Palette
    const grid = document.createElement('div');
    grid.className = 'palette-grid';

    for (const piece of PALETTE) {
      const cell = document.createElement('div');
      cell.className = 'palette-cell';
      if (piece === null) {
        cell.textContent = 'X';
        cell.style.color = '#dc5050';
      } else {
        const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
        cell.textContent = UNICODE_PIECES[key];
        cell.classList.add(piece.color === 'w' ? 'piece-white' : 'piece-black');
      }

      cell.addEventListener('click', () => {
        this.state.setupPiece = piece;
        this._highlightSelected(cell);
      });
      grid.appendChild(cell);
    }
    this.container.appendChild(grid);
    this._paletteGrid = grid;

    // Turn toggle
    this.turnBtn = document.createElement('button');
    this.turnBtn.className = 'panel-btn btn-full';
    this._updateTurnBtn();
    this.turnBtn.addEventListener('click', () => {
      this.state.setupTurn = this.state.setupTurn === 'w' ? 'b' : 'w';
      this._updateTurnBtn();
    });
    this.container.appendChild(this.turnBtn);

    // FEN display
    this.fenDisplay = document.createElement('div');
    this.fenDisplay.className = 'fen-display';
    this._updateFen();
    this.container.appendChild(this.fenDisplay);
    this.state.on('boardChanged', () => this._updateFen());

    // Bottom buttons
    const btnArea = document.createElement('div');
    btnArea.className = 'setup-btns';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'panel-btn btn-full';
    clearBtn.textContent = 'Clear Board';
    clearBtn.addEventListener('click', () => {
      this.state.chess.clear();
      this.state.emit('boardChanged');
    });
    btnArea.appendChild(clearBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'panel-btn btn-full';
    resetBtn.textContent = 'Starting Position';
    resetBtn.addEventListener('click', () => {
      this.state.chess.reset();
      this.state.emit('boardChanged');
    });
    btnArea.appendChild(resetBtn);

    const doneBtn = document.createElement('button');
    doneBtn.className = 'panel-btn btn-full btn-active';
    doneBtn.textContent = 'Done \u2014 Play!';
    doneBtn.addEventListener('click', () => this._exitSetup());
    btnArea.appendChild(doneBtn);

    this.container.appendChild(btnArea);

    // Highlight eraser by default
    this._highlightSelected(grid.children[0]);
  }

  _highlightSelected(cell) {
    const cells = this._paletteGrid.querySelectorAll('.palette-cell');
    cells.forEach(c => c.classList.remove('palette-selected'));
    cell.classList.add('palette-selected');
  }

  _updateTurnBtn() {
    const isWhite = this.state.setupTurn === 'w';
    this.turnBtn.textContent = `Turn: ${isWhite ? 'White' : 'Black'}`;
    this.turnBtn.style.color = isWhite ? '#fff' : '#b4b4b4';
  }

  _updateFen() {
    if (this.fenDisplay) {
      this.fenDisplay.textContent = 'FEN: ' + this.state.chess.fen();
    }
  }

  _exitSetup() {
    const state = this.state;
    const chess = state.chess;

    // Set turn
    const fen = chess.fen();
    const parts = fen.split(' ');
    parts[1] = state.setupTurn;

    // Infer castling
    parts[2] = this._inferCastling(parts[0]);
    // Clear en passant, reset clocks
    parts[3] = '-';
    parts[4] = '0';
    parts[5] = '1';

    const newFen = parts.join(' ');

    try {
      chess.load(newFen);
    } catch {
      state.status = 'Invalid position!';
      state.emit('boardChanged');
      return;
    }

    // Validate
    if (chess.isGameOver() && !chess.isCheckmate() && !chess.isStalemate()) {
      // Position might still be playable (draw conditions are fine)
    }

    state.setupMode = false;
    state.resetTree(newFen);
    state.emit('setupModeChanged');
  }

  _inferCastling(position) {
    // Parse board position to check king/rook squares
    const rows = position.split('/');
    let rights = '';

    // Helper to check if piece is at a specific file in a rank string
    const pieceAt = (rank, file) => {
      let col = 0;
      for (const ch of rank) {
        if (col === file) return ch;
        if (ch >= '1' && ch <= '8') col += parseInt(ch);
        else col++;
        if (col > file) return null;
      }
      return null;
    };

    const rank1 = rows[7]; // white's back rank
    const rank8 = rows[0]; // black's back rank

    // White king on e1, rooks on a1/h1
    if (pieceAt(rank1, 4) === 'K') {
      if (pieceAt(rank1, 7) === 'R') rights += 'K';
      if (pieceAt(rank1, 0) === 'R') rights += 'Q';
    }
    // Black king on e8, rooks on a8/h8
    if (pieceAt(rank8, 4) === 'k') {
      if (pieceAt(rank8, 7) === 'r') rights += 'k';
      if (pieceAt(rank8, 0) === 'r') rights += 'q';
    }

    return rights || '-';
  }
}
