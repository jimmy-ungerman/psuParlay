const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // send/receive httpOnly cookies
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  me: () => request('GET', '/auth/me'),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  register: (username, password, inviteToken) =>
    request('POST', '/auth/register', { username, password, inviteToken }),

  // Invites (admin)
  getInvites: () => request('GET', '/invites'),
  createInvite: (label) => request('POST', '/invites', { label }),
  deleteInvite: (id) => request('DELETE', `/invites/${id}`),
  validateInvite: (token) => request('GET', `/invites/validate/${token}`),

  // Games & picks
  getGames: () => request('GET', '/games'),
  getPicks: (week, season) => {
    const qs = week && season ? `?week=${week}&season=${season}` : '';
    return request('GET', `/picks${qs}`);
  },
  submitPick: (gameId, pickedTeam) => request('POST', '/picks', { gameId, pickedTeam }),

  // Leaderboard
  getLeaderboard: (season) => request('GET', `/leaderboard${season ? `?season=${season}` : ''}`),
  getHistory: (season) => request('GET', `/leaderboard/history${season ? `?season=${season}` : ''}`),
  getSeasons: () => request('GET', '/leaderboard/seasons'),

  // Reactions
  getReactions: (week, season) => request('GET', `/reactions?week=${week}&season=${season}`),
  toggleReaction: (pickId, emoji) => request('POST', '/reactions', { pickId, emoji }),

  // Comments
  getComments: (week, season) => request('GET', `/comments?week=${week}&season=${season}`),
  postComment: (content, weekNumber, season) => request('POST', '/comments', { content, weekNumber, season }),
  deleteComment: (id) => request('DELETE', `/comments/${id}`),

  // Users & stats
  getUsers: () => request('GET', '/users'),
  getParlayRecord: () => request('GET', '/stats/parlay-record'),
  getH2H: (userId) => request('GET', `/stats/h2h/${userId}`),

  // Parlay link
  getParlayLink: (week, season) => {
    const qs = week && season ? `?week=${week}&season=${season}` : '';
    return request('GET', `/parlay-link${qs}`);
  },
  setParlayLink: (week, season, draftkings_url, fanduel_url) =>
    request('PUT', '/parlay-link', { week, season, draftkings_url, fanduel_url }),
};
