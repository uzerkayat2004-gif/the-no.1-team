const { test, mock } = require('node:test');
const assert = require('node:assert');

// Mock firebase-admin completely before requiring the middleware
const mockVerifyIdToken = mock.fn(async (token) => {
    if (token === 'good_token') {
        return { uid: '123', email: 'test@example.com' };
    }
    throw new Error('Mock rejection');
});

const adminMock = {
    auth: () => ({
        verifyIdToken: mockVerifyIdToken
    })
};

// Override require cache for firebase-admin
require('module')._cache[require.resolve('firebase-admin')] = {
    id: require.resolve('firebase-admin'),
    filename: require.resolve('firebase-admin'),
    loaded: true,
    exports: adminMock
};

const { verifyAuth } = require('../src/main/authMiddleware');

test('verifyAuth returns 401 if no auth header', async (t) => {
    const req = { headers: {} };
    let statusCalled = null;
    let jsonCalled = null;
    const res = {
        status: (s) => { statusCalled = s; return res; },
        json: (j) => { jsonCalled = j; return res; }
    };
    const next = () => {};

    await verifyAuth(req, res, next);

    assert.strictEqual(statusCalled, 401);
    assert.deepStrictEqual(jsonCalled, { error: 'No authentication token provided.' });
});

test('verifyAuth returns 401 if auth header does not start with Bearer', async (t) => {
    const req = { headers: { authorization: 'Basic something' } };
    let statusCalled = null;
    let jsonCalled = null;
    const res = {
        status: (s) => { statusCalled = s; return res; },
        json: (j) => { jsonCalled = j; return res; }
    };
    const next = () => {};

    await verifyAuth(req, res, next);

    assert.strictEqual(statusCalled, 401);
    assert.deepStrictEqual(jsonCalled, { error: 'No authentication token provided.' });
});

test('verifyAuth returns 403 when verifyIdToken rejects', async (t) => {
    const originalConsoleError = console.error;
    console.error = () => {};

    const req = { headers: { authorization: 'Bearer bad_token' } };
    let statusCalled = null;
    let jsonCalled = null;
    const res = {
        status: (s) => { statusCalled = s; return res; },
        json: (j) => { jsonCalled = j; return res; }
    };
    const next = () => {};

    await verifyAuth(req, res, next);

    assert.strictEqual(statusCalled, 403);
    assert.deepStrictEqual(jsonCalled, { error: 'Invalid or expired authentication token.' });

    console.error = originalConsoleError;
});

test('verifyAuth sets req.user and calls next on success', async (t) => {
    const req = { headers: { authorization: 'Bearer good_token' } };
    let statusCalled = null;
    let jsonCalled = null;
    const res = {
        status: (s) => { statusCalled = s; return res; },
        json: (j) => { jsonCalled = j; return res; }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await verifyAuth(req, res, next);

    assert.strictEqual(nextCalled, true);
    assert.deepStrictEqual(req.user, { uid: '123', email: 'test@example.com' });
    assert.strictEqual(statusCalled, null);
});
