(() => {
  'use strict';

  const STORAGE_KEY = 'thumbnail-counter-state-v1';
  const COORDINATE_SPACE = 'viewport-relative-v2';
  const PREVIOUS_VIEWPORT_SPACE = 'viewport-v1';
  const LEGACY_BOARD_WIDTH = 1120;
  const BOARD_PADDING = 10;
  const CARD_WIDTH = 140;
  const CARD_HEIGHT = 190;
  const CARD_GAP = 16;

  const starterCounters = [
    { name: 'SIXRING', goal: 10, value: 8, color: '#f5a900' },
    { name: 'RBT', goal: 10, value: 8, color: '#f5a900' },
    { name: 'BENGAL', goal: 20, value: 0, color: '#f5a900' },
    { name: 'KCLUKE', goal: 5, value: 0, color: '#f5a900' },
    { name: 'FRDI SHOW', goal: 16, value: 0, color: '#f5a900' },
    { name: 'JAYCANADA', goal: 5, value: 0, color: '#f5a900' },
    { name: 'PERRAM', goal: 5, value: 0, color: '#f5a900' },
    { name: 'SIXRING', goal: 10, value: 0, color: '#f5a900' },
    { name: 'RBT', goal: 10, value: 0, color: '#f5a900' }
  ];

  const elements = {
    appTitle: document.querySelector('#appTitle'),
    addCounterBtn: document.querySelector('#addCounterBtn'),
    emptyAddBtn: document.querySelector('#emptyAddBtn'),
    editModeBtn: document.querySelector('#editModeBtn'),
    resetAllBtn: document.querySelector('#resetAllBtn'),
    exportBtn: document.querySelector('#exportBtn'),
    importInput: document.querySelector('#importInput'),
    counterGrid: document.querySelector('#counterGrid'),
    emptyState: document.querySelector('#emptyState'),
    statusRow: document.querySelector('.status-row'),
    summaryText: document.querySelector('#summaryText'),
    saveStatus: document.querySelector('#saveStatus'),
    counterDialog: document.querySelector('#counterDialog'),
    counterForm: document.querySelector('#counterForm'),
    dialogTitle: document.querySelector('#dialogTitle'),
    counterId: document.querySelector('#counterId'),
    counterName: document.querySelector('#counterName'),
    counterGoal: document.querySelector('#counterGoal'),
    counterValue: document.querySelector('#counterValue'),
    counterColor: document.querySelector('#counterColor'),
    closeDialogBtn: document.querySelector('#closeDialogBtn'),
    cancelDialogBtn: document.querySelector('#cancelDialogBtn'),
    template: document.querySelector('#counterCardTemplate')
  };

  let needsMigrationSave = false;
  let state = loadState();
  let dragState = null;

  function createId() {
    return typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getViewportWidth() {
    return Math.max(document.documentElement.clientWidth, window.innerWidth || 0, CARD_WIDTH);
  }

  function getViewportHeight() {
    return Math.max(document.documentElement.clientHeight, window.innerHeight || 0, CARD_HEIGHT);
  }

  function getSafeTop() {
    const statusBottom = elements.statusRow?.getBoundingClientRect().bottom || 130;
    return Math.min(
      Math.max(BOARD_PADDING, Math.round(statusBottom + 12)),
      Math.max(BOARD_PADDING, getViewportHeight() - CARD_HEIGHT)
    );
  }

  function getInitialPosition(index) {
    const viewportWidth = getViewportWidth();
    const safeTop = getSafeTop();
    const usableWidth = Math.max(CARD_WIDTH, viewportWidth - (BOARD_PADDING * 2));
    const columns = Math.max(1, Math.floor((usableWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP)));

    return {
      x: BOARD_PADDING + (index % columns) * (CARD_WIDTH + CARD_GAP),
      y: safeTop + Math.floor(index / columns) * (CARD_HEIGHT + CARD_GAP)
    };
  }

  function cloneDefaultState() {
    return {
      title: 'THUMBNAIL COUNTER',
      editMode: false,
      coordinateSpace: COORDINATE_SPACE,
      counters: starterCounters.map((counter, index) => normalizeCounter({
        ...counter,
        ...getInitialPosition(index),
        id: createId(),
        z: index + 1
      }, index, COORDINATE_SPACE))
    };
  }

  function legacyOffsets() {
    return {
      x: Math.max(0, Math.round((getViewportWidth() - LEGACY_BOARD_WIDTH) / 2)),
      y: getSafeTop()
    };
  }

  function ratioFromPixels(value, maximum) {
    return maximum > 0 ? clamp(value / maximum, 0, 1) : 0;
  }

  function parseFiniteNumber(value) {
    if (value === null || value === '' || typeof value === 'boolean') return Number.NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function normalizeCounter(counter, index = 0, sourceCoordinateSpace = COORDINATE_SPACE) {
    const fallbackPosition = getInitialPosition(index);
    const usesLegacyBoard = ![COORDINATE_SPACE, PREVIOUS_VIEWPORT_SPACE].includes(sourceCoordinateSpace);
    const offsets = usesLegacyBoard ? legacyOffsets() : { x: 0, y: 0 };
    const parsedX = Number(counter.x);
    const parsedY = Number(counter.y);
    const parsedXRatio = parseFiniteNumber(counter.xRatio);
    const parsedYRatio = parseFiniteNumber(counter.yRatio);
    const parsedZ = Number(counter.z);
    const maxX = Math.max(0, getViewportWidth() - CARD_WIDTH);
    const maxY = Math.max(0, getViewportHeight() - CARD_HEIGHT);
    const fallbackX = Math.round(clamp(fallbackPosition.x, 0, maxX));
    const fallbackY = Math.round(clamp(fallbackPosition.y, 0, maxY));
    const pixelX = Number.isFinite(parsedX) && parsedX >= 0
      ? Math.round(clamp(parsedX + offsets.x, 0, maxX))
      : fallbackX;
    const pixelY = Number.isFinite(parsedY) && parsedY >= 0
      ? Math.round(clamp(parsedY + offsets.y, 0, maxY))
      : fallbackY;
    const hasSavedRatios = sourceCoordinateSpace === COORDINATE_SPACE
      && Number.isFinite(parsedXRatio)
      && Number.isFinite(parsedYRatio);
    const xRatio = hasSavedRatios
      ? clamp(parsedXRatio, 0, 1)
      : ratioFromPixels(pixelX, maxX);
    const yRatio = hasSavedRatios
      ? clamp(parsedYRatio, 0, 1)
      : ratioFromPixels(pixelY, maxY);

    return {
      id: typeof counter.id === 'string' && counter.id ? counter.id : createId(),
      name: String(counter.name || 'UNTITLED').trim().slice(0, 26),
      goal: Math.max(0, Number.parseInt(counter.goal, 10) || 0),
      value: Math.max(0, Number.parseInt(counter.value, 10) || 0),
      color: /^#[0-9a-f]{6}$/i.test(counter.color || '') ? counter.color : '#f5a900',
      x: Math.round(xRatio * maxX),
      y: Math.round(yRatio * maxY),
      xRatio,
      yRatio,
      z: Number.isFinite(parsedZ) && parsedZ > 0 ? Math.round(parsedZ) : index + 1
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return cloneDefaultState();

      const parsed = JSON.parse(saved);
      const sourceCoordinateSpace = typeof parsed.coordinateSpace === 'string'
        ? parsed.coordinateSpace
        : 'legacy-board';
      const counters = Array.isArray(parsed.counters) ? parsed.counters : null;
      needsMigrationSave = sourceCoordinateSpace !== COORDINATE_SPACE
        || Boolean(counters?.some((counter) => !Number.isFinite(parseFiniteNumber(counter.xRatio)) || !Number.isFinite(parseFiniteNumber(counter.yRatio))));

      return {
        title: typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim().slice(0, 36)
          : 'THUMBNAIL COUNTER',
        editMode: Boolean(parsed.editMode),
        coordinateSpace: COORDINATE_SPACE,
        counters: counters
          ? counters.map((counter, index) => normalizeCounter(counter, index, sourceCoordinateSpace))
          : cloneDefaultState().counters
      };
    } catch (error) {
      console.warn('Could not load saved counters:', error);
      return cloneDefaultState();
    }
  }

  function saveState(message = 'Saved automatically') {
    state.coordinateSpace = COORDINATE_SPACE;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    elements.saveStatus.textContent = message;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function getMovementBounds(card) {
    const cardWidth = card?.offsetWidth || CARD_WIDTH;
    const cardHeight = card?.offsetHeight || CARD_HEIGHT;

    return {
      maxX: Math.max(0, getViewportWidth() - cardWidth),
      maxY: Math.max(0, getViewportHeight() - cardHeight)
    };
  }

  function applyCardPixels(card, counter) {
    card.style.left = `${counter.x}px`;
    card.style.top = `${counter.y}px`;
    card.style.zIndex = String(counter.z);
  }

  function syncRatiosFromPixels(counter, card) {
    const { maxX, maxY } = getMovementBounds(card);
    counter.x = Math.round(clamp(counter.x, 0, maxX));
    counter.y = Math.round(clamp(counter.y, 0, maxY));
    counter.xRatio = ratioFromPixels(counter.x, maxX);
    counter.yRatio = ratioFromPixels(counter.y, maxY);
  }

  function setCounterPixels(counter, card, x, y) {
    counter.x = x;
    counter.y = y;
    syncRatiosFromPixels(counter, card);
    applyCardPixels(card, counter);
  }

  function restoreCardPosition(card, counter) {
    const { maxX, maxY } = getMovementBounds(card);
    const savedXRatio = parseFiniteNumber(counter.xRatio);
    const savedYRatio = parseFiniteNumber(counter.yRatio);
    const xRatio = Number.isFinite(savedXRatio)
      ? clamp(savedXRatio, 0, 1)
      : ratioFromPixels(Number(counter.x) || 0, maxX);
    const yRatio = Number.isFinite(savedYRatio)
      ? clamp(savedYRatio, 0, 1)
      : ratioFromPixels(Number(counter.y) || 0, maxY);

    counter.xRatio = xRatio;
    counter.yRatio = yRatio;
    counter.x = Math.round(xRatio * maxX);
    counter.y = Math.round(yRatio * maxY);
    applyCardPixels(card, counter);
  }

  function render() {
    elements.appTitle.textContent = state.title;
    elements.counterGrid.innerHTML = '';
    document.body.classList.toggle('edit-mode', state.editMode);
    elements.editModeBtn.setAttribute('aria-pressed', String(state.editMode));
    elements.editModeBtn.textContent = state.editMode ? 'Finish editing' : 'Edit mode';

    const isEmpty = state.counters.length === 0;
    elements.emptyState.hidden = !isEmpty;
    elements.counterGrid.hidden = isEmpty;

    for (const counter of state.counters) {
      const card = createCounterCard(counter);
      elements.counterGrid.appendChild(card);
      restoreCardPosition(card, counter);
    }

    const total = state.counters.reduce((sum, counter) => sum + counter.value, 0);
    elements.summaryText.textContent = `${state.counters.length} counter${state.counters.length === 1 ? '' : 's'} · ${total} total`;
    elements.saveStatus.textContent = state.editMode
      ? 'Edit mode: drag counters anywhere on the screen'
      : 'Saved automatically';

    if (needsMigrationSave) {
      needsMigrationSave = false;
      saveState('Positions upgraded and saved');
    }
  }

  function createCounterCard(counter) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector('.counter-card');
    const screen = fragment.querySelector('.counter-card__screen');
    const title = fragment.querySelector('.counter-card__title');
    const value = fragment.querySelector('.counter-card__value');
    const progressBar = fragment.querySelector('.progress-bar');
    const editBtn = fragment.querySelector('.card-edit-btn');
    const minusBtn = fragment.querySelector('.minus-btn');
    const plusBtn = fragment.querySelector('.plus-btn');
    const duplicateBtn = fragment.querySelector('.duplicate-btn');
    const deleteBtn = fragment.querySelector('.delete-btn');

    const percentage = counter.goal > 0 ? Math.min(100, (counter.value / counter.goal) * 100) : 0;

    card.dataset.id = counter.id;
    card.style.setProperty('--card-accent', counter.color);
    title.textContent = `${counter.name} (${counter.goal})`;
    value.textContent = counter.value;
    progressBar.style.width = `${percentage}%`;

    minusBtn.addEventListener('click', () => updateValue(counter.id, -1));
    plusBtn.addEventListener('click', () => updateValue(counter.id, 1));
    editBtn.addEventListener('click', () => openCounterDialog(counter));
    duplicateBtn.addEventListener('click', () => duplicateCounter(counter.id));
    deleteBtn.addEventListener('click', () => deleteCounter(counter.id));
    screen.addEventListener('pointerdown', (event) => beginDrag(event, counter.id, card));
    card.addEventListener('keydown', (event) => moveWithKeyboard(event, counter.id));

    return card;
  }

  function updateValue(id, delta) {
    const counter = state.counters.find((item) => item.id === id);
    if (!counter) return;

    counter.value = Math.max(0, counter.value + delta);
    saveState();
    render();
  }

  function openCounterDialog(counter = null) {
    elements.dialogTitle.textContent = counter ? 'Edit counter' : 'Add counter';
    elements.counterId.value = counter?.id || '';
    elements.counterName.value = counter?.name || '';
    elements.counterGoal.value = counter?.goal ?? 10;
    elements.counterValue.value = counter?.value ?? 0;
    elements.counterColor.value = counter?.color || '#f5a900';
    elements.counterDialog.showModal();
    requestAnimationFrame(() => elements.counterName.focus());
  }

  function closeCounterDialog() {
    elements.counterDialog.close();
    elements.counterForm.reset();
  }

  function boxesOverlap(a, b) {
    return !(
      a.x + a.width + CARD_GAP <= b.x ||
      b.x + b.width + CARD_GAP <= a.x ||
      a.y + a.height + CARD_GAP <= b.y ||
      b.y + b.height + CARD_GAP <= a.y
    );
  }

  function findAvailablePosition() {
    const viewportWidth = getViewportWidth();
    const viewportHeight = getViewportHeight();
    const safeTop = getSafeTop();
    const maxX = Math.max(0, viewportWidth - CARD_WIDTH);
    const maxY = Math.max(0, viewportHeight - CARD_HEIGHT);
    const columns = Math.max(
      1,
      Math.floor((viewportWidth - (BOARD_PADDING * 2) + CARD_GAP) / (CARD_WIDTH + CARD_GAP))
    );

    const occupied = state.counters.map((counter) => ({
      x: counter.x,
      y: counter.y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT
    }));

    for (let slot = 0; slot < 500; slot += 1) {
      const candidateX = BOARD_PADDING + (slot % columns) * (CARD_WIDTH + CARD_GAP);
      const candidateY = safeTop + Math.floor(slot / columns) * (CARD_HEIGHT + CARD_GAP);

      if (candidateY > maxY) break;

      const candidate = {
        x: clamp(candidateX, 0, maxX),
        y: clamp(candidateY, 0, maxY),
        width: CARD_WIDTH,
        height: CARD_HEIGHT
      };

      if (!occupied.some((box) => boxesOverlap(candidate, box))) {
        return { x: candidate.x, y: candidate.y };
      }
    }

    const cascadeOffset = (state.counters.length * 28) % Math.max(28, Math.min(280, maxX + 1));
    return {
      x: clamp(BOARD_PADDING + cascadeOffset, 0, maxX),
      y: clamp(safeTop + cascadeOffset, 0, maxY)
    };
  }

  function upsertCounter(event) {
    event.preventDefault();

    const id = elements.counterId.value;
    const existingIndex = state.counters.findIndex((counter) => counter.id === id);
    const existing = existingIndex >= 0 ? state.counters[existingIndex] : null;
    const nextPosition = existing || findAvailablePosition();
    const highestZ = state.counters.reduce((max, counter) => Math.max(max, counter.z), 0);

    const payload = normalizeCounter({
      id: id || createId(),
      name: elements.counterName.value,
      goal: elements.counterGoal.value,
      value: elements.counterValue.value,
      color: elements.counterColor.value,
      x: nextPosition.x,
      y: nextPosition.y,
      xRatio: existing?.xRatio,
      yRatio: existing?.yRatio,
      z: existing?.z ?? highestZ + 1
    }, existingIndex >= 0 ? existingIndex : state.counters.length, COORDINATE_SPACE);

    if (existingIndex >= 0) {
      state.counters[existingIndex] = payload;
    } else {
      state.counters.push(payload);
    }

    saveState();
    render();
    closeCounterDialog();
  }

  function duplicateCounter(id) {
    const source = state.counters.find((counter) => counter.id === id);
    if (!source) return;

    const nextPosition = findAvailablePosition();
    const copy = normalizeCounter({
      ...source,
      ...nextPosition,
      xRatio: undefined,
      yRatio: undefined,
      id: createId(),
      name: `${source.name} COPY`.slice(0, 26),
      z: state.counters.reduce((max, counter) => Math.max(max, counter.z), 0) + 1
    }, state.counters.length, COORDINATE_SPACE);

    state.counters.push(copy);
    saveState();
    render();
  }

  function deleteCounter(id) {
    const counter = state.counters.find((item) => item.id === id);
    if (!counter) return;

    const approved = window.confirm(`Delete “${counter.name}”?`);
    if (!approved) return;

    state.counters = state.counters.filter((item) => item.id !== id);
    saveState();
    render();
  }

  function resetAll() {
    if (state.counters.length === 0) return;

    const approved = window.confirm('Remove all counters from the screen? This cannot be undone.');
    if (!approved) return;

    state.counters = [];
    saveState('All counters removed');
    render();
  }

  function toggleEditMode() {
    state.editMode = !state.editMode;
    saveState();
    render();
  }

  function bringToFront(counter, card) {
    const highestZ = state.counters.reduce((max, item) => Math.max(max, item.z), 0);
    counter.z = highestZ + 1;
    card.style.zIndex = String(counter.z);
  }

  function beginDrag(event, id, card) {
    if (!state.editMode || event.target.closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const counter = state.counters.find((item) => item.id === id);
    if (!counter) return;

    event.preventDefault();
    bringToFront(counter, card);

    dragState = {
      id,
      pointerId: event.pointerId,
      card,
      counter,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startCardX: card.offsetLeft,
      startCardY: card.offsetTop
    };

    card.classList.add('is-dragging');
    document.body.classList.add('is-dragging');
    card.setPointerCapture(event.pointerId);
    card.addEventListener('pointermove', dragCounter);
    card.addEventListener('pointerup', finishDrag);
    card.addEventListener('pointercancel', finishDrag);
  }

  function dragCounter(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const deltaX = event.clientX - dragState.startPointerX;
    const deltaY = event.clientY - dragState.startPointerY;
    const nextX = dragState.startCardX + deltaX;
    const nextY = dragState.startCardY + deltaY;

    setCounterPixels(dragState.counter, dragState.card, nextX, nextY);
  }

  function finishDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const { card, pointerId } = dragState;
    if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId);

    card.removeEventListener('pointermove', dragCounter);
    card.removeEventListener('pointerup', finishDrag);
    card.removeEventListener('pointercancel', finishDrag);
    card.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging');
    syncRatiosFromPixels(dragState.counter, card);
    dragState = null;

    saveState('Position saved');
  }

  function moveWithKeyboard(event, id) {
    if (event.target.closest('button')) return;
    if (!state.editMode || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

    event.preventDefault();
    const counter = state.counters.find((item) => item.id === id);
    const card = event.currentTarget;
    if (!counter) return;

    const step = event.shiftKey ? 20 : 5;
    let nextX = counter.x;
    let nextY = counter.y;

    if (event.key === 'ArrowLeft') nextX -= step;
    if (event.key === 'ArrowRight') nextX += step;
    if (event.key === 'ArrowUp') nextY -= step;
    if (event.key === 'ArrowDown') nextY += step;

    bringToFront(counter, card);
    setCounterPixels(counter, card, nextX, nextY);
    saveState('Position saved');
  }

  function exportState() {
    const exportData = {
      app: 'Thumbnail Counter',
      version: 4,
      exportedAt: new Date().toISOString(),
      state: {
        title: state.title,
        coordinateSpace: COORDINATE_SPACE,
        counters: state.counters
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `thumbnail-counters-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importState(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const importedState = parsed.state || parsed;

      if (!Array.isArray(importedState.counters)) {
        throw new Error('The selected file does not contain a counters list.');
      }

      const sourceCoordinateSpace = typeof importedState.coordinateSpace === 'string'
        ? importedState.coordinateSpace
        : 'legacy-board';
      state = {
        title: typeof importedState.title === 'string' && importedState.title.trim()
          ? importedState.title.trim().slice(0, 36)
          : 'THUMBNAIL COUNTER',
        editMode: false,
        coordinateSpace: COORDINATE_SPACE,
        counters: importedState.counters.map((counter, index) => normalizeCounter(counter, index, sourceCoordinateSpace))
      };

      saveState();
      render();
    } catch (error) {
      window.alert(`Could not import file: ${error.message}`);
    }
  }

  function editTitle() {
    if (!state.editMode) return;

    const nextTitle = window.prompt('Dashboard title:', state.title);
    if (nextTitle === null) return;

    const cleaned = nextTitle.trim().slice(0, 36);
    if (!cleaned) return;

    state.title = cleaned;
    saveState();
    render();
  }

  elements.addCounterBtn.addEventListener('click', () => openCounterDialog());
  elements.emptyAddBtn.addEventListener('click', () => openCounterDialog());
  elements.editModeBtn.addEventListener('click', toggleEditMode);
  elements.resetAllBtn.addEventListener('click', resetAll);
  elements.exportBtn.addEventListener('click', exportState);
  elements.importInput.addEventListener('change', importState);
  elements.counterForm.addEventListener('submit', upsertCounter);
  elements.closeDialogBtn.addEventListener('click', closeCounterDialog);
  elements.cancelDialogBtn.addEventListener('click', closeCounterDialog);
  elements.appTitle.addEventListener('click', editTitle);

  elements.counterDialog.addEventListener('click', (event) => {
    if (event.target === elements.counterDialog) closeCounterDialog();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.counterDialog.open) closeCounterDialog();
  });

  window.addEventListener('resize', () => {
    for (const card of elements.counterGrid.querySelectorAll('.counter-card')) {
      const counter = state.counters.find((item) => item.id === card.dataset.id);
      if (counter) restoreCardPosition(card, counter);
    }
  });

  render();
})();
