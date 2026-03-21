// SVG-based game tree visualization
// Ported from Branchess.py lines 860-986
import { COLOR_TREE_EDGE, COLOR_TREE_PATH_EDGE, COLOR_TREE_NODE, COLOR_TREE_NODE_BORDER,
         COLOR_TREE_PATH_NODE, COLOR_TREE_PATH_BORDER, COLOR_TREE_CURRENT, COLOR_TREE_BRANCH,
         COLOR_TREE_LABEL, COLOR_TREE_LABEL_DIM, TREE_SPACING_X, TREE_SPACING_Y,
         TREE_NODE_R } from './constants.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class TreeView {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    this.svg = null;
    this._dragging = false;
    this._dragStart = null;
    this._dragScrollStart = null;
    this._lastClickTime = 0;

    this._build();
    state.on('treeChanged', () => this.render());
    state.on('boardChanged', () => this.render());
  }

  _build() {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('tree-svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    // Defs for glow filter
    const defs = document.createElementNS(SVG_NS, 'defs');
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = 'glow';
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '3');
    blur.setAttribute('result', 'blur');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const mn1 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn1.setAttribute('in', 'blur');
    const mn2 = document.createElementNS(SVG_NS, 'feMergeNode');
    mn2.setAttribute('in', 'SourceGraphic');
    merge.append(mn1, mn2);
    filter.append(blur, merge);
    defs.append(filter);
    this.svg.append(defs);

    this.edgesGroup = document.createElementNS(SVG_NS, 'g');
    this.nodesGroup = document.createElementNS(SVG_NS, 'g');
    this.labelsGroup = document.createElementNS(SVG_NS, 'g');
    this.svg.append(this.edgesGroup, this.nodesGroup, this.labelsGroup);

    this.container.appendChild(this.svg);

    // Mouse interactions
    this._bindEvents();
  }

  _bindEvents() {
    const el = this.container;

    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const now = Date.now();
      if (now - this._lastClickTime < 300) {
        // Double click: zoom
        const state = this.state;
        if (state.treeZoom >= 3.9) {
          state.treeZoom = 1;
          state.treeScrollX = 0;
          state.treeScrollY = 0;
        } else {
          state.treeZoom = Math.min(4, state.treeZoom * 1.5);
        }
        this._lastClickTime = 0;
        this.render();
        return;
      }
      this._lastClickTime = now;
      this._dragging = true;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._dragScrollStart = { x: this.state.treeScrollX, y: this.state.treeScrollY };
      el.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      this.state.treeScrollX = this._dragScrollStart.x - dx;
      this.state.treeScrollY = this._dragScrollStart.y - dy;
      this.render();
    });

    window.addEventListener('mouseup', (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      el.style.cursor = '';
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      // If barely moved, treat as node click
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        this._handleNodeClick(e);
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        this.state.treeZoom = Math.max(0.5, Math.min(4, this.state.treeZoom * factor));
      } else if (e.shiftKey) {
        this.state.treeScrollX += e.deltaY;
      } else {
        this.state.treeScrollY += e.deltaY;
      }
      this.render();
    }, { passive: false });
  }

  _handleNodeClick(e) {
    // Find clicked node
    const rect = this.svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodes = this.nodesGroup.querySelectorAll('[data-node-id]');
    for (const el of nodes) {
      const cx = parseFloat(el.getAttribute('cx') || el.getAttribute('x') || 0);
      const cy = parseFloat(el.getAttribute('cy') || el.getAttribute('y') || 0);
      const r = TREE_NODE_R * this.state.treeZoom + 5;

      // For polygons (diamonds), get center from points
      let centerX = cx, centerY = cy;
      if (el.tagName === 'polygon') {
        const pts = el.getAttribute('points').split(' ').map(p => p.split(',').map(Number));
        centerX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        centerY = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      }

      if (Math.abs(x - centerX) < r && Math.abs(y - centerY) < r) {
        const nodeId = parseInt(el.dataset.nodeId);
        const node = this._findNodeById(this.state.treeRoot, nodeId);
        if (node) this.state.navigateTo(node);
        return;
      }
    }
  }

  _findNodeById(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = this._findNodeById(child, id);
      if (found) return found;
    }
    return null;
  }

  render() {
    const layout = this.state.getTreeLayout();
    if (!layout.size) return;

    const state = this.state;
    const zoom = state.treeZoom;
    const r = Math.max(2, Math.round(TREE_NODE_R * zoom));
    const sx = TREE_SPACING_X * zoom;
    const sy = TREE_SPACING_Y * zoom;

    // Current path
    const pathIds = new Set();
    let node = state.currentNode;
    while (node) {
      pathIds.add(node.id);
      node = node.parent;
    }

    // Auto-center on current node
    const svgRect = this.svg.getBoundingClientRect();
    const areaW = svgRect.width || 280;
    const areaH = svgRect.height || 200;
    const curPos = layout.get(state.currentNode.id) || { x: 0, y: 0 };
    const vpX = curPos.x * sx - areaW / 2 + state.treeScrollX;
    const vpY = curPos.y * sy - areaH / 3 + state.treeScrollY;

    const toPx = (lx, ly) => [lx * sx - vpX, ly * sy - vpY];

    // Clear groups
    this.edgesGroup.innerHTML = '';
    this.nodesGroup.innerHTML = '';
    this.labelsGroup.innerHTML = '';

    // Collect all nodes
    const allNodes = [];
    const gather = (n) => { allNodes.push(n); n.children.forEach(gather); };
    gather(state.treeRoot);

    // Pass 1: dim edges
    for (const n of allNodes) {
      if (!n.children.length) continue;
      const nPos = layout.get(n.id);
      if (!nPos) continue;
      const [ppx, ppy] = toPx(nPos.x, nPos.y);
      for (const child of n.children) {
        const cPos = layout.get(child.id);
        if (!cPos) continue;
        if (pathIds.has(n.id) && pathIds.has(child.id)) continue;
        const [cpx, cpy] = toPx(cPos.x, cPos.y);
        this._drawEdge(ppx, ppy + r, cpx, cpy - r, COLOR_TREE_EDGE, 1);
      }
    }

    // Path edges
    const pathList = state.currentNode.pathFromRoot();
    for (let i = 0; i < pathList.length - 1; i++) {
      const pPos = layout.get(pathList[i].id);
      const cPos = layout.get(pathList[i + 1].id);
      if (!pPos || !cPos) continue;
      const [ppx, ppy] = toPx(pPos.x, pPos.y);
      const [cpx, cpy] = toPx(cPos.x, cPos.y);
      // Glow edge
      this._drawEdge(ppx, ppy + r, cpx, cpy - r, COLOR_TREE_PATH_EDGE, 4, 0.3);
      this._drawEdge(ppx, ppy + r, cpx, cpy - r, COLOR_TREE_PATH_EDGE, 2);
    }

    // Pass 2: nodes
    for (const n of allNodes) {
      const nPos = layout.get(n.id);
      if (!nPos) continue;
      const [npx, npy] = toPx(nPos.x, nPos.y);

      // Cull off-screen
      if (npx < -30 || npx > areaW + 30 || npy < -30 || npy > areaH + 30) continue;

      const isCurrent = n === state.currentNode;
      const onPath = pathIds.has(n.id);
      const isBranch = n.children.length > 1;

      if (isCurrent) {
        // Glow halo
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', npx);
        halo.setAttribute('cy', npy);
        halo.setAttribute('r', r * 3);
        halo.setAttribute('fill', COLOR_TREE_CURRENT);
        halo.setAttribute('opacity', '0.14');
        this.nodesGroup.append(halo);

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', r + 2);
        circle.setAttribute('fill', COLOR_TREE_CURRENT);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('filter', 'url(#glow)');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      } else if (onPath) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', COLOR_TREE_PATH_NODE);
        circle.setAttribute('stroke', COLOR_TREE_PATH_BORDER);
        circle.setAttribute('stroke-width', '1');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      } else if (isBranch) {
        const pts = [
          `${npx},${npy - r}`, `${npx + r},${npy}`,
          `${npx},${npy + r}`, `${npx - r},${npy}`
        ].join(' ');
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', COLOR_TREE_BRANCH);
        poly.setAttribute('stroke', '#c8aa64');
        poly.setAttribute('stroke-width', '1');
        poly.dataset.nodeId = n.id;
        this.nodesGroup.append(poly);
      } else {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', npx);
        circle.setAttribute('cy', npy);
        circle.setAttribute('r', r - 1);
        circle.setAttribute('fill', COLOR_TREE_NODE);
        circle.setAttribute('stroke', COLOR_TREE_NODE_BORDER);
        circle.setAttribute('stroke-width', '1');
        circle.dataset.nodeId = n.id;
        this.nodesGroup.append(circle);
      }

      // SAN label
      if (n.san) {
        const showLabel = onPath || (n.parent && n.parent.children.length > 1);
        if (showLabel) {
          const text = document.createElementNS(SVG_NS, 'text');
          text.setAttribute('x', npx + r + 3);
          text.setAttribute('y', npy + 3);
          text.setAttribute('fill', onPath ? COLOR_TREE_LABEL : COLOR_TREE_LABEL_DIM);
          text.setAttribute('font-size', Math.max(7, 10 * zoom) + 'px');
          text.setAttribute('font-family', 'system-ui, sans-serif');
          text.textContent = n.san;
          this.labelsGroup.append(text);
        }
      }
    }
  }

  _drawEdge(x1, y1, x2, y2, color, width, opacity = 1) {
    const midY = (y1 + y2) / 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1},${y1} C ${x1},${midY} ${x2},${midY} ${x2},${y2}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width);
    path.setAttribute('fill', 'none');
    if (opacity < 1) path.setAttribute('opacity', opacity);
    this.edgesGroup.append(path);
  }
}
