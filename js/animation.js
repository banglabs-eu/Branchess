// Move animation — ghost piece slides from source to destination
import { ANIM_DURATION, UNICODE_PIECES } from './constants.js';

export class AnimationManager {
  constructor(boardView, state) {
    this.boardView = boardView;
    this.state = state;
    this._ghost = null;
  }

  cancel() {
    if (this._ghost) {
      this._ghost.remove();
      this._ghost = null;
    }
    if (this._cleanup) {
      this._cleanup();
    }
    this.state.animating = false;
  }

  animate(move, onComplete) {
    // If no boardView rendered yet, just complete immediately
    const fromEl = this.boardView.getSquareElement(move.from);
    const toEl = this.boardView.getSquareElement(move.to);
    if (!fromEl || !toEl) {
      if (onComplete) onComplete();
      return;
    }

    // Get the piece at from (before the chess state is updated)
    // The chess state might already be updated, so look at the board display
    const pieceEl = fromEl.querySelector('.piece');
    if (!pieceEl) {
      if (onComplete) onComplete();
      return;
    }

    // Get positions relative to the board container
    const boardRect = this.boardView.container.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Create ghost element
    const ghost = document.createElement('span');
    ghost.className = pieceEl.className + ' piece-ghost';
    ghost.textContent = pieceEl.textContent;
    ghost.style.position = 'absolute';
    ghost.style.left = (fromRect.left - boardRect.left) + 'px';
    ghost.style.top = (fromRect.top - boardRect.top) + 'px';
    ghost.style.width = fromRect.width + 'px';
    ghost.style.height = fromRect.height + 'px';
    ghost.style.fontSize = pieceEl.style.fontSize || getComputedStyle(pieceEl).fontSize;
    ghost.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.33,1,0.68,1)`;
    ghost.style.zIndex = '100';
    ghost.style.pointerEvents = 'none';

    // Hide original piece
    pieceEl.style.visibility = 'hidden';

    this.boardView.container.appendChild(ghost);
    this._ghost = ghost;
    this.state.animating = true;

    // Trigger animation
    requestAnimationFrame(() => {
      const dx = toRect.left - fromRect.left;
      const dy = toRect.top - fromRect.top;
      ghost.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      if (this._ghost) { this._ghost.remove(); this._ghost = null; }
      this._cleanup = null;
      this.state.animating = false;
      if (onComplete) onComplete();
    };
    this._cleanup = cleanup;

    ghost.addEventListener('transitionend', cleanup, { once: true });
    // Fallback timeout in case transitionend doesn't fire
    setTimeout(cleanup, ANIM_DURATION + 50);
  }
}
