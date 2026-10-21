import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getJobHealth,
  jobsDegraded,
  recordJobFailure,
  recordJobSuccess,
  resetJobHealth,
} from '../src/services/healthState.js';

const blank = { lastSuccessAt: null, lastErrorAt: null, lastError: null };

describe('healthState', () => {
  beforeEach(() => {
    resetJobHealth();
    mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-17T15:00:00.000Z') });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test('starts with every job blank and not degraded', () => {
    assert.deepEqual(getJobHealth(), { scores: blank, spreads: blank, seeding: blank });
    assert.equal(jobsDegraded(), false);
  });

  test('recordJobSuccess sets only lastSuccessAt', () => {
    recordJobSuccess('scores');
    assert.deepEqual(getJobHealth().scores, {
      lastSuccessAt: '2026-10-17T15:00:00.000Z',
      lastErrorAt: null,
      lastError: null,
    });
  });

  test('recordJobFailure stores the message of an Error', () => {
    recordJobFailure('spreads', new Error('quota exhausted'));
    assert.deepEqual(getJobHealth().spreads, {
      lastSuccessAt: null,
      lastErrorAt: '2026-10-17T15:00:00.000Z',
      lastError: 'quota exhausted',
    });
  });

  test('recordJobFailure stringifies a non-Error value', () => {
    recordJobFailure('seeding', 'ESPN timeout');
    assert.equal(getJobHealth().seeding.lastError, 'ESPN timeout');
  });

  test('a failure with no success is degraded', () => {
    recordJobFailure('seeding', new Error('boom'));
    assert.equal(jobsDegraded(), true);
  });

  test('a failure after a success is degraded', () => {
    recordJobSuccess('scores');
    mock.timers.tick(1000);
    recordJobFailure('scores', new Error('boom'));
    assert.equal(jobsDegraded(), true);
  });

  test('a success after a failure recovers', () => {
    recordJobFailure('scores', new Error('boom'));
    mock.timers.tick(1000);
    recordJobSuccess('scores');
    assert.equal(jobsDegraded(), false);
  });

  test('a failure and success in the same millisecond is not degraded', () => {
    recordJobFailure('spreads', new Error('boom'));
    recordJobSuccess('spreads');
    assert.equal(jobsDegraded(), false);
  });

  test('getJobHealth returns copies', () => {
    const snapshot = getJobHealth();
    snapshot.scores.lastError = 'mutated';
    assert.equal(getJobHealth().scores.lastError, null);
  });
});
