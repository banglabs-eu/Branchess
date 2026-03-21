// Click-to-move handling, promotion, player/engine move execution
import { ANIM_DURATION } from './constants.js';

export class MoveHandler {
  constructor(state, boardView, animationManager, engine) {
    this.state = state;
    this.boardView = boardView;
    this.animation = animationManager;
    this.engine = engine;

    this._bindBoardClicks();
  }

  _bindBoardClicks() {
    this.boardView.container.addEventListener('click', (e) => {
      const sqEl = e.target.closest('.square');
      if (!sqEl) return;
      const sq = sqEl.dataset.square;
      this._handleBoardClick(sq);
    });

    this.boardView.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.state.setupMode) return;
      const sqEl = e.target.closest('.square');
      if (!sqEl) return;
      this._handleSetupRightClick(sqEl.dataset.square);
    });
  }

  _handleBoardClick(sq) {
    const state = this.state;
    if (state.engineThinking) return;
    if (state.promotingFrom !== null) return;

    if (state.setupMode) {
      this._handleSetupClick(sq);
      return;
    }
    if (state.gameOver) return;

    // If a piece is selected and this is a legal destination
    if (state.selectedSq !== null && state.legalDests.has(sq)) {
      this._tryMove(state.selectedSq, sq);
      return;
    }

    // Select a piece
    const chess = state.chess;
    const piece = chess.get(sq);
    if (piece && piece.color === chess.turn()) {
      state.selectedSq = sq;
      state.legalDests = new Set(
        chess.moves({ square: sq, verbose: true }).map(m => m.to)
      );
    } else {
      state.selectedSq = null;
      state.legalDests = new Set();
    }
    state.emit('boardChanged');
  }

  _tryMove(from, to) {
    const chess = this.state.chess;
    const piece = chess.get(from);

    // Check promotion
    if (piece && piece.type === 'p') {
      const rank = parseInt(to[1]);
      if ((piece.color === 'w' && rank === 8) || (piece.color === 'b' && rank === 1)) {
        this.state.promotingFrom = from;
        this.state.promotingTo = to;
        this.state.emit('promotionNeeded');
        return;
      }
    }

    this._executeMove({ from, to });
  }

  handlePromotion(pieceType) {
    const from = this.state.promotingFrom;
    const to = this.state.promotingTo;
    this.state.promotingFrom = null;
    this.state.promotingTo = null;
    this.state.emit('promotionDone');
    this._executeMove({ from, to, promotion: pieceType });
  }

  _executeMove(move) {
    const state = this.state;
    const chess = state.chess;
    const movedColor = chess.turn();

    // Check if move exists in tree already
    const existing = state.currentNode.findChild(move);
    if (existing) {
      // Animate then navigate
      this.animation.animate(move, () => {
        state.navigateTo(existing);
        this._afterPlayerMove(movedColor);
      });
      return;
    }

    // Execute the move — chess.js throws on illegal moves
    let result;
    try {
      result = chess.move(move);
    } catch { return; }
    const san = result.san;

    const child = state.currentNode.addChild(
      { from: move.from, to: move.to, promotion: move.promotion },
      chess.fen(),
      san
    );
    state.currentNode = child;
    state.lastMove = { from: move.from, to: move.to };
    state.invalidateTreeLayout();

    // Animate
    state.selectedSq = null;
    state.legalDests = new Set();

    this.animation.animate(move, () => {
      state.emit('boardChanged');
      this._afterPlayerMove(movedColor);
    });
  }

  _afterPlayerMove(movedColor) {
    const state = this.state;
    if (state.checkGameOver()) {
      state.emit('boardChanged');
      return;
    }

    // Auto engine response after white moves
    if (movedColor === 'w') {
      if (state.currentNode.children.length) {
        // Cached response exists — animate to it
        const target = state.currentNode.children[0];
        const move = target.move;
        this.animation.animate(move, () => {
          state.navigateTo(target);
          if (!state.gameOver) state.status = 'Your turn';
          state.emit('boardChanged');
        });
      } else {
        this._requestEngineMove();
      }
    } else {
      state.status = 'Your turn';
      state.emit('boardChanged');
    }
  }

  _requestEngineMove() {
    const state = this.state;
    state.status = 'Engine thinking...';
    state.engineThinking = true;
    state.emit('boardChanged');

    this.engine.getMove(state.chess.fen(), state.strengthParams()).then(move => {
      if (!move) {
        state.status = 'Engine error';
        state.engineThinking = false;
        state.emit('boardChanged');
        return;
      }

      const chess = state.chess;
      let result;
      try {
        result = chess.move(move);
      } catch {
        state.status = 'Engine error: invalid move';
        state.engineThinking = false;
        state.emit('boardChanged');
        return;
      }
      const san = result.san;

      const child = state.currentNode.addChild(
        { from: move.from, to: move.to, promotion: move.promotion },
        chess.fen(),
        san
      );
      state.currentNode = child;
      state.lastMove = { from: move.from, to: move.to };
      state.invalidateTreeLayout();

      this.animation.animate(move, () => {
        state.engineThinking = false;
        state.checkGameOver();
        if (!state.gameOver) state.status = 'Your turn';
        state.emit('boardChanged');
      });
    }).catch(err => {
      state.status = `Engine error: ${err.message}`;
      state.engineThinking = false;
      state.emit('boardChanged');
    });
  }

  requestEngineCalculation() {
    if (this.state.gameOver) return;
    const moves = this.state.chess.moves();
    if (!moves.length) return;
    // Force — cancel any in-flight animation and request immediately
    this.animation.cancel();
    this.state.engineThinking = false;
    this._requestEngineMove();
  }

  _handleSetupClick(sq) {
    const state = this.state;
    if (state.setupPiece === null) {
      // Eraser — remove piece
      state.chess.remove(sq);
    } else {
      state.chess.put(state.setupPiece, sq);
    }
    state.emit('boardChanged');
  }

  _handleSetupRightClick(sq) {
    this.state.chess.remove(sq);
    this.state.emit('boardChanged');
  }
}
