// Per-process job timestamps for /api/status. A probe describes this pod, so
// these stay in memory and are not shared across replicas.

function blankJob() {
  return { lastSuccessAt: null, lastErrorAt: null, lastError: null };
}

const jobs = {
  scores: blankJob(),
  spreads: blankJob(),
  seeding: blankJob(),
};

export function recordJobSuccess(name) {
  jobs[name].lastSuccessAt = new Date().toISOString();
}

export function recordJobFailure(name, err) {
  const job = jobs[name];
  job.lastErrorAt = new Date().toISOString();
  job.lastError = err?.message ?? String(err);
}

export function resetJobHealth() {
  for (const name of Object.keys(jobs)) jobs[name] = blankJob();
}

export function getJobHealth() {
  return {
    scores: { ...jobs.scores },
    spreads: { ...jobs.spreads },
    seeding: { ...jobs.seeding },
  };
}

// Degraded only when the most recent attempt failed. An earlier error that a
// later run recovered from leaves the pod healthy.
export function jobsDegraded() {
  return Object.values(jobs).some(job =>
    job.lastErrorAt && (!job.lastSuccessAt || job.lastErrorAt > job.lastSuccessAt)
  );
}
