// Board rendering — CSS grid of 64 divs with Unicode pieces
import { COLOR_LIGHT_SQ, COLOR_DARK_SQ, COLOR_SELECTED, COLOR_LEGAL, COLOR_LEGAL_CAPTURE,
         COLOR_LAST_MOVE, COLOR_CHECK, UNICODE_PIECES, FILES, RANKS } from './constants.js';

export class BoardView {
  constructor(container, state) {
    this.state = state;
    this.container = container;
    this.squares = [];
    this._build();

    state.on('boardChanged', () => this.render());
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('chess-board');

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = document.createElement('div');
        sq.className = 'square';
        const isLight = (row + col) % 2 === 0;
        sq.style.background = isLight ? COLOR_LIGHT_SQ : COLOR_DARK_SQ;
        sq.dataset.square = FILES[col] + RANKS[row];
        sq.dataset.row = row;
        sq.dataset.col = col;

        // File labels (bottom row)
        if (row === 7) {
          const label = document.createElement('span');
          label.className = 'label label-file';
          label.textContent = FILES[col];
          label.style.color = isLight ? COLOR_DARK_SQ : COLOR_LIGHT_SQ;
          sq.appendChild(label);
        }
        // Rank labels (left column)
        if (col === 0) {
          const label = document.createElement('span');
          label.className = 'label label-rank';
          label.textContent = RANKS[row];
          label.style.color = isLight ? COLOR_DARK_SQ : COLOR_LIGHT_SQ;
          sq.appendChild(label);
        }

        this.squares.push(sq);
        this.container.appendChild(sq);
      }
    }
  }

  _sqIndex(algebraic) {
    const col = algebraic.charCodeAt(0) - 97; // a=0
    const row = 8 - parseInt(algebraic[1]);    // 8=0, 1=7
    return row * 8 + col;
  }

  render() {
    const chess = this.state.chess;
    const board = chess.board(); // 8x8 array of {type, color} or null

    // Clear all overlays and pieces
    for (const sq of this.squares) {
      // Remove piece spans and overlays
      const piece = sq.querySelector('.piece');
      if (piece) piece.remove();
      sq.classList.remove('highlight-selected', 'highlight-legal', 'highlight-last', 'highlight-check', 'highlight-legal-capture');
    }

    // Place pieces
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = board[row][col];
        if (!p) continue;
        const sq = this.squares[row * 8 + col];
        const span = document.createElement('span');
        span.className = 'piece';
        // Always use filled (black) glyphs — color via CSS
        const key = p.type;
        span.textContent = UNICODE_PIECES[key];
        span.classList.add(p.color === 'w' ? 'piece-white' : 'piece-black');
        sq.appendChild(span);
      }
    }

    // Highlights
    const { lastMove, selectedSq, legalDests } = this.state;

    if (lastMove) {
      const fromIdx = this._sqIndex(lastMove.from);
      const toIdx = this._sqIndex(lastMove.to);
      this.squares[fromIdx].classList.add('highlight-last');
      this.squares[toIdx].classList.add('highlight-last');
    }

    if (chess.isCheck()) {
      // Find the king
      const turn = chess.turn();
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const p = board[row][col];
          if (p && p.type === 'k' && p.color === turn) {
            this.squares[row * 8 + col].classList.add('highlight-check');
          }
        }
      }
    }

    if (selectedSq !== null) {
      const idx = this._sqIndex(selectedSq);
      this.squares[idx].classList.add('highlight-selected');
    }

    for (const dest of legalDests) {
      const idx = this._sqIndex(dest);
      const p = board[Math.floor(idx / 8)][idx % 8];
      if (p) {
        this.squares[idx].classList.add('highlight-legal-capture');
      } else {
        this.squares[idx].classList.add('highlight-legal');
      }
    }
  }

  getSquareElement(algebraic) {
    return this.squares[this._sqIndex(algebraic)];
  }

  getSquareRect(algebraic) {
    return this.getSquareElement(algebraic).getBoundingClientRect();
  }
}
