// Entry point — wires everything together
import { Chess } from '../lib/chess.js';
import { GameState } from './state.js';
import { BoardView } from './board.js';
import { MoveHandler } from './moves.js';
import { AnimationManager } from './animation.js';
import { StochasticEngine } from './engine.js';
import { TreeView } from './tree-view.js';
import { UIPanel } from './ui-panel.js';
import { SetupPanel } from './setup.js';
import { DialogManager } from './persistence.js';

// Initialize
const chess = new Chess();
const state = new GameState(chess);

// Board
const boardContainer = document.getElementById('board');
const boardView = new BoardView(boardContainer, state);

// Animation
const animation = new AnimationManager(boardView, state);

// Engine
const engine = new StochasticEngine();

// Move handler
const moveHandler = new MoveHandler(state, boardView, animation, engine);

// Panel
const panelContainer = document.getElementById('panel');
const uiPanel = new UIPanel(panelContainer, state, moveHandler);

// Tree view (inside panel's tree container)
const treeView = new TreeView(uiPanel.treeContainer, state);

// Setup panel (replaces main panel when in setup mode)
const setupContainer = document.getElementById('setup-panel');
const setupPanel = new SetupPanel(setupContainer, state);

// Dialogs (promotion, save, load)
const overlayEl = document.getElementById('overlay');
const dialogs = new DialogManager(overlayEl, state);

// Wire promotion choice back to move handler
state.on('promotionChoice', (pieceType) => {
  moveHandler.handlePromotion(pieceType);
});

// Toggle panel visibility in setup mode
state.on('setupModeChanged', () => {
  panelContainer.style.display = state.setupMode ? 'none' : '';
  setupContainer.style.display = state.setupMode ? '' : 'none';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Let dialogs handle their own keys
  dialogs.handleKeydown(e);

  if (state.showSaveDialog || state.showLoadDialog) return;
  if (state.promotingFrom !== null) return;

  if (e.key === 'ArrowLeft') { state.goBack(); }
  else if (e.key === 'ArrowRight') { state.goForward(); }
  else if (e.key === 'ArrowUp') { state.switchBranch(-1); }
  else if (e.key === 'ArrowDown') { state.switchBranch(1); }
  else if (e.key === 'u' || e.key === 'U') { state.undo(); }
  else if (e.key === 'n' || e.key === 'N') { state.newGame(); }
  else if (e.key === ' ') { e.preventDefault(); moveHandler.requestEngineCalculation(); }
  else if (e.key === 'h' || e.key === 'H') {
    // Toggle legal move hints
    boardContainer.classList.toggle('hide-hints');
  }
  else if (e.key === 'e' || e.key === 'E') {
    if (state.setupMode) {
      // Exit setup
      setupPanel._exitSetup();
    } else {
      uiPanel._enterSetupMode();
    }
  }
  else if (e.key === 's' && e.ctrlKey) {
    e.preventDefault();
    state.emit('openSaveDialog');
  }
  else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    state.emit('openLoadDialog');
  }
  else if (e.key === 'v' && e.ctrlKey) {
    // Let Paste PGN handle it
    uiPanel._pastePGN();
  }
});

// Initial render
boardView.render();
treeView.render();

// Page unload
window.addEventListener('beforeunload', () => engine.terminate());
