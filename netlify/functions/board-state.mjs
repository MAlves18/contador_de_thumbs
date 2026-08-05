import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

const STORE_NAME = 'thumbnail-counter';
const STATE_KEY = 'shared-dashboard';
const MAX_BODY_BYTES = 300_000;
const MAX_COUNTERS = 500;

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders
  });
}

function secureEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sanitizeCounter(counter, index) {
  const color = typeof counter?.color === 'string' && /^#[0-9a-f]{6}$/i.test(counter.color)
    ? counter.color
    : '#f5a900';

  return {
    id: typeof counter?.id === 'string' && counter.id
      ? counter.id.slice(0, 100)
      : `counter-${index + 1}`,
    name: String(counter?.name || 'UNTITLED').trim().slice(0, 26),
    goal: clamp(Math.trunc(finiteNumber(counter?.goal)), 0, 1_000_000_000),
    value: clamp(Math.trunc(finiteNumber(counter?.value)), 0, 1_000_000_000),
    color,
    x: clamp(Math.round(finiteNumber(counter?.x)), 0, 100_000),
    y: clamp(Math.round(finiteNumber(counter?.y)), 0, 100_000),
    xRatio: clamp(finiteNumber(counter?.xRatio), 0, 1),
    yRatio: clamp(finiteNumber(counter?.yRatio), 0, 1),
    z: clamp(Math.round(finiteNumber(counter?.z, index + 1)), 1, 1_000_000)
  };
}

function sanitizeState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.counters)) {
    throw new Error('Invalid dashboard state.');
  }

  if (state.counters.length > MAX_COUNTERS) {
    throw new Error(`A maximum of ${MAX_COUNTERS} counters is allowed.`);
  }

  return {
    title: typeof state.title === 'string' && state.title.trim()
      ? state.title.trim().slice(0, 36)
      : 'THUMBNAIL COUNTER',
    editMode: false,
    coordinateSpace: 'viewport-relative-v2',
    counters: state.counters.map(sanitizeCounter)
  };
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...responseHeaders,
        Allow: 'GET, PUT, OPTIONS'
      }
    });
  }

  const configuredSecret = process.env.SYNC_SECRET;
  if (!configuredSecret) {
    return json({ error: 'SYNC_SECRET is not configured in Netlify.' }, 503);
  }

  const suppliedSecret = request.headers.get('x-sync-key');
  if (!secureEquals(suppliedSecret, configuredSecret)) {
    return json({ error: 'Invalid cloud sync password.' }, 401);
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (request.method === 'GET') {
    const entry = await store.get(STATE_KEY, { type: 'json' });

    if (!entry) {
      return json({ found: false, revision: 0, state: null });
    }

    return json({
      found: true,
      revision: entry.revision,
      savedAt: entry.savedAt,
      state: entry.state
    });
  }

  if (request.method === 'PUT') {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: 'Dashboard payload is too large.' }, 413);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }

    let cleanState;
    try {
      cleanState = sanitizeState(payload?.state);
    } catch (error) {
      return json({ error: error.message }, 400);
    }

    const current = await store.get(STATE_KEY, { type: 'json' });
    const revision = Math.max(Date.now(), finiteNumber(current?.revision) + 1);
    const savedAt = new Date().toISOString();

    await store.setJSON(STATE_KEY, {
      revision,
      savedAt,
      state: cleanState
    });

    return json({ saved: true, revision, savedAt });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      ...responseHeaders,
      Allow: 'GET, PUT, OPTIONS'
    }
  });
};
