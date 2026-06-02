// Conference display order
export const CONF_ORDER = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Mtn West', 'AAC', 'MAC', 'Sun Belt', 'CUSA', 'Ind.', 'Other'];

// Common abbreviations and nicknames mapped to team name substrings.
// Ambiguous ones (OSU, MSU) intentionally map to multiple teams.
const NICKNAMES = {
  // Abbreviations
  'FSU':  ['Florida State'],
  'OSU':  ['Ohio State', 'Oklahoma State'],
  'PSU':  ['Penn State'],
  'LSU':  ['LSU'],
  'MSU':  ['Michigan State', 'Mississippi State'],
  'USC':  ['USC Trojans', 'South Carolina'],
  'UK':   ['Kentucky'],
  'UGA':  ['Georgia'],
  'UNC':  ['North Carolina'],
  'OU':   ['Oklahoma Sooners'],
  'UT':   ['Texas Longhorns', 'Tennessee'],
  'AU':   ['Auburn'],
  'CU':   ['Colorado Buffaloes'],
  'UF':   ['Florida Gators'],
  'UVA':  ['Virginia Cavaliers'],
  'VT':   ['Virginia Tech'],
  'GT':   ['Georgia Tech'],
  'WVU':  ['West Virginia'],
  'KSU':  ['Kansas State'],
  'ISU':  ['Iowa State'],
  'ASU':  ['Arizona State'],
  'TTU':  ['Texas Tech'],
  'ECU':  ['East Carolina'],
  'ODU':  ['Old Dominion'],
  'JMU':  ['James Madison'],
  'APP':  ['Appalachian State'],
  'NIU':  ['Northern Illinois'],
  'USF':  ['South Florida'],
  'BSU':  ['Boise State'],
  // Nicknames / mascots
  'Bama':     ['Alabama'],
  'Noles':    ['Florida State'],
  'Gators':   ['Florida'],
  'Vols':     ['Tennessee'],
  'Dawgs':    ['Georgia'],
  'Tide':     ['Alabama'],
  'Buckeyes': ['Ohio State'],
  'Wolverines': ['Michigan'],
  'Ducks':    ['Oregon'],
  'Hawkeyes': ['Iowa'],
  'Huskers':  ['Nebraska'],
  'Sooners':  ['Oklahoma'],
  'Cowboys':  ['Oklahoma State'],
  'Longhorns': ['Texas'],
  'Aggies':   ['Texas A&M'],
  'Tigers':   ['LSU', 'Auburn', 'Clemson', 'Memphis'],
  'Tar Heels': ['North Carolina'],
  'Hokies':   ['Virginia Tech'],
  'Mountaineers': ['West Virginia'],
  'Wildcats': ['Kentucky', 'Kansas State', 'Arizona'],
};

// Returns true if the game matches the search query,
// checking team names directly and via the nickname map.
export function matchesSearch(game, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();

  // Direct substring match on either team name
  if (game.home_team.toLowerCase().includes(q) || game.away_team.toLowerCase().includes(q)) return true;

  // Nickname prefix match: "OS" matches "OSU", "Buck" matches "Buckeyes"
  for (const [nick, teamSubstrings] of Object.entries(NICKNAMES)) {
    if (!nick.toLowerCase().startsWith(q)) continue;
    for (const sub of teamSubstrings) {
      if (game.home_team.includes(sub) || game.away_team.includes(sub)) return true;
    }
  }

  return false;
}
