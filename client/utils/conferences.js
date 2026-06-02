// Conference display order
export const CONF_ORDER = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Mtn West', 'AAC', 'MAC', 'Sun Belt', 'CUSA', 'Ind.', 'Other'];

const TEAMS = {
  // SEC
  'Alabama': 'SEC', 'Auburn': 'SEC', 'Georgia': 'SEC', 'LSU': 'SEC',
  'Ole Miss': 'SEC', 'Mississippi State': 'SEC', 'Texas A&M': 'SEC',
  'Arkansas': 'SEC', 'Missouri': 'SEC', 'Tennessee': 'SEC',
  'South Carolina': 'SEC', 'Vanderbilt': 'SEC', 'Florida': 'SEC',
  'Kentucky': 'SEC', 'Texas Longhorns': 'SEC', 'Oklahoma Sooners': 'SEC',

  // Big Ten
  'Ohio State': 'Big Ten', 'Michigan Wolverines': 'Big Ten', 'Penn State': 'Big Ten',
  'Michigan State': 'Big Ten', 'Iowa Hawkeyes': 'Big Ten', 'Wisconsin': 'Big Ten',
  'Minnesota': 'Big Ten', 'Illinois': 'Big Ten', 'Indiana Hoosiers': 'Big Ten',
  'Purdue': 'Big Ten', 'Rutgers': 'Big Ten', 'Nebraska': 'Big Ten',
  'Northwestern': 'Big Ten', 'Maryland': 'Big Ten', 'USC Trojans': 'Big Ten',
  'UCLA Bruins': 'Big Ten', 'Oregon Ducks': 'Big Ten', 'Washington Huskies': 'Big Ten',

  // Big 12
  'Kansas State': 'Big 12', 'Kansas Jayhawks': 'Big 12', 'Oklahoma State': 'Big 12',
  'TCU': 'Big 12', 'Baylor': 'Big 12', 'West Virginia': 'Big 12',
  'Iowa State': 'Big 12', 'Texas Tech': 'Big 12', 'Cincinnati Bearcats': 'Big 12',
  'UCF': 'Big 12', 'Houston Cougars': 'Big 12', 'BYU': 'Big 12',
  'Arizona Wildcats': 'Big 12', 'Arizona State': 'Big 12', 'Colorado Buffaloes': 'Big 12',
  'Utah Utes': 'Big 12',

  // ACC
  'Clemson': 'ACC', 'Florida State': 'ACC', 'Miami Hurricanes': 'ACC',
  'North Carolina Tar Heels': 'ACC', 'NC State': 'ACC', 'Virginia Tech': 'ACC',
  'Virginia Cavaliers': 'ACC', 'Duke Blue Devils': 'ACC', 'Wake Forest': 'ACC',
  'Georgia Tech': 'ACC', 'Pittsburgh': 'ACC', 'Louisville Cardinals': 'ACC',
  'Boston College': 'ACC', 'Syracuse': 'ACC', 'California Golden Bears': 'ACC',
  'Stanford': 'ACC', 'SMU Mustangs': 'ACC',

  // Mountain West
  'Boise State': 'Mtn West', 'Fresno State': 'Mtn West', 'Nevada Wolf Pack': 'Mtn West',
  'UNLV': 'Mtn West', 'Colorado State': 'Mtn West', 'Wyoming': 'Mtn West',
  'Air Force': 'Mtn West', 'New Mexico Lobos': 'Mtn West', 'San José State': 'Mtn West',
  'San Jose State': 'Mtn West', 'San Diego State': 'Mtn West', 'Hawaii': 'Mtn West',
  'Utah State': 'Mtn West',

  // AAC
  'Memphis Tigers': 'AAC', 'Navy Midshipmen': 'AAC', 'Tulane': 'AAC',
  'East Carolina': 'AAC', 'South Florida': 'AAC', 'Rice Owls': 'AAC',
  'North Texas': 'AAC', 'UTSA': 'AAC', 'Temple': 'AAC',
  'UAB Blazers': 'AAC', 'Florida Atlantic': 'AAC', 'Charlotte 49ers': 'AAC',
  'Tulsa Golden Hurricane': 'AAC',

  // MAC
  'Toledo Rockets': 'MAC', 'Western Michigan': 'MAC', 'Central Michigan': 'MAC',
  'Ohio Bobcats': 'MAC', 'Ball State': 'MAC', 'Miami (OH)': 'MAC',
  'Bowling Green': 'MAC', 'Buffalo Bulls': 'MAC', 'Kent State': 'MAC',
  'Akron': 'MAC', 'Eastern Michigan': 'MAC', 'Northern Illinois': 'MAC',

  // Sun Belt
  'Louisiana Ragin': 'Sun Belt', 'Appalachian State': 'Sun Belt',
  'Georgia Southern': 'Sun Belt', 'South Alabama': 'Sun Belt',
  'Arkansas State': 'Sun Belt', 'Louisiana Monroe': 'Sun Belt',
  'Troy Trojans': 'Sun Belt', 'Texas State': 'Sun Belt',
  'Georgia State': 'Sun Belt', 'Marshall Thundering': 'Sun Belt',
  'Southern Miss': 'Sun Belt', 'Old Dominion': 'Sun Belt',
  'James Madison': 'Sun Belt', 'Coastal Carolina': 'Sun Belt',

  // CUSA
  'Liberty Flames': 'CUSA', 'Jacksonville State': 'CUSA', 'Sam Houston': 'CUSA',
  'New Mexico State': 'CUSA', 'FIU': 'CUSA', 'Middle Tennessee': 'CUSA',
  'Western Kentucky': 'CUSA', 'Louisiana Tech': 'CUSA', 'UTEP': 'CUSA',
  'Kennesaw State': 'CUSA',

  // Independents
  'Notre Dame': 'Ind.', 'Army Black Knights': 'Ind.',
};

// Sorted longest-first so more specific names match before shorter ones
// (e.g. "Florida State" before "Florida", "Georgia Tech" before "Georgia")
const SORTED_TEAMS = Object.entries(TEAMS).sort((a, b) => b[0].length - a[0].length);

export function getConference(teamName) {
  if (!teamName) return 'Other';
  for (const [key, conf] of SORTED_TEAMS) {
    if (teamName.includes(key)) return conf;
  }
  return 'Other';
}

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
