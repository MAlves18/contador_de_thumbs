import { acceptInvite, getUser, handleAuthCallback, login, logout, oauthLogin, requestPasswordRecovery, signup, updateUser } from 'https://cdn.jsdelivr.net/npm/@netlify/identity@1.2.0/+esm';

(() => {
  'use strict';

  const LEGACY_STORAGE_KEY = 'thumbnail-counter-state-v1';
  const USER_STORAGE_PREFIX = 'thumbnail-counter-user-v2';
  const LEGACY_MIGRATION_MARKER = 'thumbnail-counter-legacy-migrated-v2';
  let storageKey = '';
  let cloudRevisionStorage = '';
  let cloudPendingStorage = '';
  const CLOUD_ENDPOINT = '/api/board-state';
  const CLOUD_SAVE_DELAY_MS = 450;
  const CLOUD_POLL_INTERVAL_MS = 15000;
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
    authGate: document.querySelector('#authGate'),
    authIntro: document.querySelector('#authIntro'),
    authMessage: document.querySelector('#authMessage'),
    loginForm: document.querySelector('#loginForm'),
    loginEmail: document.querySelector('#loginEmail'),
    loginPassword: document.querySelector('#loginPassword'),
    forgotPasswordBtn: document.querySelector('#forgotPasswordBtn'),
    externalAuth: document.querySelector('#externalAuth'),
    googleLoginBtn: document.querySelector('#googleLoginBtn'),
    signupForm: document.querySelector('#signupForm'),
    signupName: document.querySelector('#signupName'),
    signupEmail: document.querySelector('#signupEmail'),
    signupPassword: document.querySelector('#signupPassword'),
    recoveryForm: document.querySelector('#recoveryForm'),
    recoveryEmail: document.querySelector('#recoveryEmail'),
    resetPasswordForm: document.querySelector('#resetPasswordForm'),
    resetPassword: document.querySelector('#resetPassword'),
    resetPasswordConfirm: document.querySelector('#resetPasswordConfirm'),
    inviteForm: document.querySelector('#inviteForm'),
    invitePassword: document.querySelector('#invitePassword'),
    invitePasswordConfirm: document.querySelector('#invitePasswordConfirm'),
    toggleAuthModeBtn: document.querySelector('#toggleAuthModeBtn'),
    appShell: document.querySelector('#appShell'),
    currentUserName: document.querySelector('#currentUserName'),
    logoutBtn: document.querySelector('#logoutBtn'),
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

  let currentUser = null;
  let authMode = 'login';
  let pendingInviteToken = '';
  let needsMigrationSave = false;
  let state = cloneDefaultState();
  let dragState = null;
  let cloudRevision = 0;
  let cloudReady = false;
  let cloudSaveTimer = null;
  let cloudPollTimer = null;
  let cloudRequestInFlight = false;
  let cloudPending = false;
  let localChangeVersion = 0;

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

  function configureUserStorage(user) {
    const userId = String(user?.id || '').trim();
    storageKey = `${USER_STORAGE_PREFIX}:state:${userId}`;
    cloudRevisionStorage = `${USER_STORAGE_PREFIX}:revision:${userId}`;
    cloudPendingStorage = `${USER_STORAGE_PREFIX}:pending:${userId}`;

    if (!localStorage.getItem(storageKey) && !localStorage.getItem(LEGACY_MIGRATION_MARKER)) {
      const legacyState = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyState) {
        localStorage.setItem(storageKey, legacyState);
      }
      localStorage.setItem(LEGACY_MIGRATION_MARKER, '1');
    }
  }

  function loadState() {
    try {
      const saved = storageKey ? localStorage.getItem(storageKey) : null;
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

  function setCloudPending(value) {
    cloudPending = Boolean(value);
    if (!cloudPendingStorage) return;

    if (cloudPending) {
      localStorage.setItem(cloudPendingStorage, '1');
    } else {
      localStorage.removeItem(cloudPendingStorage);
    }
  }

  function saveState(message = 'Saved automatically', options = {}) {
    const { skipCloud = false } = options;
    if (!currentUser || !storageKey) return;

    state.coordinateSpace = COORDINATE_SPACE;
    localStorage.setItem(storageKey, JSON.stringify(state));
    elements.saveStatus.textContent = message;

    if (!skipCloud) {
      localChangeVersion += 1;
      setCloudPending(true);
      if (cloudReady) scheduleCloudSave();
    }
  }

  function normalizeExternalState(importedState) {
    const sourceCoordinateSpace = typeof importedState?.coordinateSpace === 'string'
      ? importedState.coordinateSpace
      : 'legacy-board';
    const counters = Array.isArray(importedState?.counters) ? importedState.counters : [];

    return {
      title: typeof importedState?.title === 'string' && importedState.title.trim()
        ? importedState.title.trim().slice(0, 36)
        : 'THUMBNAIL COUNTER',
      editMode: false,
      coordinateSpace: COORDINATE_SPACE,
      counters: counters.map((counter, index) => normalizeCounter(counter, index, sourceCoordinateSpace))
    };
  }

  async function cloudRequest(method, body = null) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(CLOUD_ENDPOINT, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : null,
        cache: 'no-store',
        signal: controller.signal
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || `Cloud request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }

      return result;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function scheduleCloudSave() {
    if (!currentUser || !cloudReady) return;
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = window.setTimeout(() => pushCloudState(), CLOUD_SAVE_DELAY_MS);
    elements.saveStatus.textContent = 'Saving to cloud…';
  }

  async function pushCloudState() {
    if (!currentUser || !cloudReady || !cloudPending) return;
    if (cloudRequestInFlight) {
      scheduleCloudSave();
      return;
    }

    cloudRequestInFlight = true;
    window.clearTimeout(cloudSaveTimer);
    const versionBeingSaved = localChangeVersion;

    try {
      const result = await cloudRequest('PUT', {
        state: {
          title: state.title,
          editMode: false,
          coordinateSpace: COORDINATE_SPACE,
          counters: state.counters
        }
      });

      cloudRevision = Number(result.revision) || cloudRevision;
      localStorage.setItem(cloudRevisionStorage, String(cloudRevision));

      if (localChangeVersion === versionBeingSaved) {
        setCloudPending(false);
        elements.saveStatus.textContent = 'Synced across devices';
      } else {
        setCloudPending(true);
        scheduleCloudSave();
      }
    } catch (error) {
      console.warn('Cloud save failed:', error);
      if (error.status === 401) {
        showSignedOutState('Your session expired. Sign in again.');
      } else {
        elements.saveStatus.textContent = 'Saved here · retrying cloud sync';
        if (currentUser && cloudReady) {
          window.clearTimeout(cloudSaveTimer);
          cloudSaveTimer = window.setTimeout(pushCloudState, 5000);
        }
      }
    } finally {
      cloudRequestInFlight = false;
    }
  }

  async function pullCloudState() {
    if (!currentUser || !cloudReady || cloudRequestInFlight || cloudPending) return;
    if (dragState || elements.counterDialog.open || document.hidden) return;

    cloudRequestInFlight = true;
    try {
      const result = await cloudRequest('GET');
      const remoteRevision = Number(result.revision) || 0;

      if (result.found && result.state && remoteRevision > cloudRevision) {
        state = normalizeExternalState(result.state);
        cloudRevision = remoteRevision;
        localStorage.setItem(cloudRevisionStorage, String(cloudRevision));
        saveState('Updated from cloud', { skipCloud: true });
        render();
        elements.saveStatus.textContent = 'Updated from another device';
      }
    } catch (error) {
      console.warn('Cloud refresh failed:', error);
      if (error.status === 401) {
        showSignedOutState('Your session expired. Sign in again.');
      } else {
        elements.saveStatus.textContent = 'Cloud temporarily unavailable';
      }
    } finally {
      cloudRequestInFlight = false;
    }
  }

  function startCloudPolling() {
    window.clearInterval(cloudPollTimer);
    cloudPollTimer = window.setInterval(pullCloudState, CLOUD_POLL_INTERVAL_MS);
  }

  async function initializeCloudSync() {
    if (!currentUser || cloudRequestInFlight) return;

    cloudReady = false;
    cloudRequestInFlight = true;
    elements.saveStatus.textContent = 'Connecting to your private cloud…';

    try {
      const result = await cloudRequest('GET');
      cloudRequestInFlight = false;
      cloudReady = true;

      if (result.found && result.state) {
        if (cloudPending) {
          await pushCloudState();
        } else {
          state = normalizeExternalState(result.state);
          cloudRevision = Number(result.revision) || 0;
          localStorage.setItem(cloudRevisionStorage, String(cloudRevision));
          saveState('Loaded from cloud', { skipCloud: true });
          render();
          elements.saveStatus.textContent = 'Private dashboard loaded';
        }
      } else {
        setCloudPending(true);
        await pushCloudState();
      }

      startCloudPolling();
    } catch (error) {
      cloudRequestInFlight = false;
      cloudReady = false;
      console.warn('Cloud connection failed:', error);

      if (error.status === 401) {
        showSignedOutState('Your session expired. Sign in again.');
      } else {
        elements.saveStatus.textContent = 'Saved on this device · cloud unavailable';
      }
    }
  }

  function stopCloudSync() {
    cloudReady = false;
    cloudRequestInFlight = false;
    window.clearTimeout(cloudSaveTimer);
    window.clearInterval(cloudPollTimer);
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
    if (state.editMode) {
      elements.saveStatus.textContent = 'Edit mode: edit, duplicate or delete counters';
    } else if (cloudReady) {
      elements.saveStatus.textContent = cloudPending ? 'Saving to cloud…' : 'Synced across devices';
    } else {
      elements.saveStatus.textContent = 'Connecting to your private cloud…';
    }

    if (needsMigrationSave) {
      needsMigrationSave = false;
      saveState('Positions upgraded and saved', { skipCloud: true });
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
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${counter.name} counter. Drag to reposition.`);
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
    if (event.target.closest('button')) return;
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
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

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
      version: 5,
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

  function setAuthMessage(message = '', type = '') {
    elements.authMessage.textContent = message;
    elements.authMessage.classList.toggle('is-error', type === 'error');
    elements.authMessage.classList.toggle('is-success', type === 'success');
  }

  function setAuthMode(mode) {
    const allowedModes = new Set(['login', 'signup', 'recovery', 'reset', 'invite']);
    authMode = allowedModes.has(mode) ? mode : 'login';

    elements.loginForm.hidden = authMode !== 'login';
    elements.signupForm.hidden = authMode !== 'signup';
    elements.recoveryForm.hidden = authMode !== 'recovery';
    elements.resetPasswordForm.hidden = authMode !== 'reset';
    elements.inviteForm.hidden = authMode !== 'invite';
    elements.externalAuth.hidden = !['login', 'signup'].includes(authMode);

    const content = {
      login: {
        intro: 'Sign in to access your counters on any device.',
        link: 'Create a new account'
      },
      signup: {
        intro: 'Create an account to keep a private dashboard synchronized across devices.',
        link: 'I already have an account'
      },
      recovery: {
        intro: 'Enter your email and Netlify will send a password recovery link.',
        link: 'Back to sign in'
      },
      reset: {
        intro: 'Choose a new password for your account.',
        link: ''
      },
      invite: {
        intro: 'Your invitation is valid. Create a password to activate the account.',
        link: 'Back to sign in'
      }
    }[authMode];

    elements.authIntro.textContent = content.intro;
    elements.toggleAuthModeBtn.textContent = content.link;
    elements.toggleAuthModeBtn.hidden = !content.link;
    setAuthMessage();
  }

  function showSignedOutState(message = '') {
    stopCloudSync();
    currentUser = null;
    elements.appShell.hidden = true;
    elements.authGate.hidden = false;
    setAuthMode('login');
    if (message) setAuthMessage(message, 'error');
  }

  function userDisplayName(user) {
    return user?.name
      || user?.userMetadata?.full_name
      || user?.userMetadata?.name
      || user?.email
      || 'User';
  }

  async function enterUserSession(user) {
    currentUser = user;
    configureUserStorage(user);
    state = loadState();
    cloudRevision = Number(localStorage.getItem(cloudRevisionStorage)) || 0;
    cloudPending = localStorage.getItem(cloudPendingStorage) === '1';
    cloudReady = false;
    cloudRequestInFlight = false;
    localChangeVersion = 0;

    elements.currentUserName.textContent = `${userDisplayName(user)} · ${user.email || ''}`.replace(/ · $/, '');
    elements.authGate.hidden = true;
    elements.appShell.hidden = false;
    render();
    await initializeCloudSync();
  }

  async function submitLogin(event) {
    event.preventDefault();
    const button = elements.loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setAuthMessage('Signing in…');

    try {
      await login(elements.loginEmail.value.trim(), elements.loginPassword.value);
      window.location.reload();
    } catch (error) {
      console.warn('Login failed:', error);
      setAuthMessage(error?.message || 'Could not sign in. Check your email and password.', 'error');
      button.disabled = false;
    }
  }

  function signInWithGoogle() {
    elements.googleLoginBtn.disabled = true;
    setAuthMessage('Redirecting to Google…');

    try {
      oauthLogin('google');
    } catch (error) {
      console.warn('Google login failed:', error);
      setAuthMessage(error?.message || 'Could not start Google sign-in. Check the Google provider configuration in Netlify.', 'error');
      elements.googleLoginBtn.disabled = false;
    }
  }

  async function submitSignup(event) {
    event.preventDefault();
    const button = elements.signupForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setAuthMessage('Creating account…');

    try {
      await signup(
        elements.signupEmail.value.trim(),
        elements.signupPassword.value,
        { full_name: elements.signupName.value.trim() }
      );

      const signedInUser = await getUser();
      if (signedInUser) {
        window.location.reload();
        return;
      }

      elements.signupForm.reset();
      setAuthMessage('Account created. Check your email to confirm the registration, then sign in.', 'success');
    } catch (error) {
      console.warn('Signup failed:', error);
      setAuthMessage(error?.message || 'Could not create the account.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function submitRecoveryRequest(event) {
    event.preventDefault();
    const button = elements.recoveryForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setAuthMessage('Sending recovery email…');

    try {
      await requestPasswordRecovery(elements.recoveryEmail.value.trim());
      elements.recoveryForm.reset();
      setAuthMessage('Recovery email sent. Open the link in that message to create a new password.', 'success');
    } catch (error) {
      console.warn('Recovery request failed:', error);
      setAuthMessage(error?.message || 'Could not send the recovery email.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    const password = elements.resetPassword.value;
    const confirmation = elements.resetPasswordConfirm.value;
    const button = elements.resetPasswordForm.querySelector('button[type="submit"]');

    if (password !== confirmation) {
      setAuthMessage('The passwords do not match.', 'error');
      return;
    }

    button.disabled = true;
    setAuthMessage('Updating password…');

    try {
      await updateUser({ password });
      setAuthMessage('Password updated. Loading your dashboard…', 'success');
      window.location.reload();
    } catch (error) {
      console.warn('Password reset failed:', error);
      setAuthMessage(error?.message || 'Could not update the password.', 'error');
      button.disabled = false;
    }
  }

  async function submitInvite(event) {
    event.preventDefault();
    const password = elements.invitePassword.value;
    const confirmation = elements.invitePasswordConfirm.value;
    const button = elements.inviteForm.querySelector('button[type="submit"]');

    if (!pendingInviteToken) {
      setAuthMessage('This invitation token is missing or expired.', 'error');
      return;
    }

    if (password !== confirmation) {
      setAuthMessage('The passwords do not match.', 'error');
      return;
    }

    button.disabled = true;
    setAuthMessage('Activating account…');

    try {
      await acceptInvite(pendingInviteToken, password);
      pendingInviteToken = '';
      setAuthMessage('Invitation accepted. Loading your dashboard…', 'success');
      window.location.reload();
    } catch (error) {
      console.warn('Invite acceptance failed:', error);
      setAuthMessage(error?.message || 'Could not accept the invitation.', 'error');
      button.disabled = false;
    }
  }

  async function signOutCurrentUser() {
    const approved = window.confirm('Log out of this account?');
    if (!approved) return;

    elements.logoutBtn.disabled = true;
    elements.saveStatus.textContent = 'Logging out…';
    try {
      await logout();
    } finally {
      window.location.reload();
    }
  }

  async function initializeApplication() {
    elements.appShell.hidden = true;
    elements.authGate.hidden = false;
    setAuthMessage('Checking session…');

    try {
      const callbackResult = await handleAuthCallback();
      if (callbackResult && window.location.hash) {
        history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
      }

      if (callbackResult?.type === 'invite') {
        pendingInviteToken = callbackResult.token || '';
        elements.appShell.hidden = true;
        elements.authGate.hidden = false;
        setAuthMode('invite');
        return;
      }

      if (callbackResult?.type === 'recovery') {
        currentUser = callbackResult.user;
        elements.appShell.hidden = true;
        elements.authGate.hidden = false;
        setAuthMode('reset');
        return;
      }

      const user = callbackResult?.user || await getUser();
      if (!user) {
        showSignedOutState();
        return;
      }

      await enterUserSession(user);
    } catch (error) {
      console.warn('Could not initialize authentication:', error);
      showSignedOutState(error?.message || 'Authentication is not available. Enable Netlify Identity for this project.');
    }
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
  elements.loginForm.addEventListener('submit', submitLogin);
  elements.signupForm.addEventListener('submit', submitSignup);
  elements.recoveryForm.addEventListener('submit', submitRecoveryRequest);
  elements.resetPasswordForm.addEventListener('submit', submitPasswordReset);
  elements.inviteForm.addEventListener('submit', submitInvite);
  elements.forgotPasswordBtn.addEventListener('click', () => setAuthMode('recovery'));
  elements.googleLoginBtn.addEventListener('click', signInWithGoogle);
  elements.toggleAuthModeBtn.addEventListener('click', () => {
    if (authMode === 'login') {
      setAuthMode('signup');
    } else {
      setAuthMode('login');
    }
  });
  elements.logoutBtn.addEventListener('click', signOutCurrentUser);

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

  window.addEventListener('focus', pullCloudState);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pullCloudState();
  });

  initializeApplication();
})();
