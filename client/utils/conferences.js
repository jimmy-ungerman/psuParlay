// Conference display order
export const CONF_ORDER = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'Mtn West', 'AAC', 'MAC', 'Sun Belt', 'CUSA', 'Ind.', 'Other'];

// Every FBS team, keyed by its exact ESPN displayName (the value stored in
// games.home_team / games.away_team). Matching is exact — no substring checks —
// so "Eastern Kentucky Colonels" never lands in the SEC next to "Kentucky
// Wildcats", and "Southeast Missouri State Redhawks" never gets pulled in with
// "Missouri Tigers". Alignment reflects the 2026 season.
//
// A few teams appear under more than one displayName (ESPN has used both "App
// State Mountaineers" and "Appalachian State Mountaineers", "San José State" and
// "San Jose State", etc.) — every spelling we've seen is listed.
const TEAMS = {
  // SEC
  'Alabama Crimson Tide': 'SEC',
  'Arkansas Razorbacks': 'SEC',
  'Auburn Tigers': 'SEC',
  'Florida Gators': 'SEC',
  'Georgia Bulldogs': 'SEC',
  'Kentucky Wildcats': 'SEC',
  'LSU Tigers': 'SEC',
  'Mississippi State Bulldogs': 'SEC',
  'Missouri Tigers': 'SEC',
  'Oklahoma Sooners': 'SEC',
  'Ole Miss Rebels': 'SEC',
  'South Carolina Gamecocks': 'SEC',
  'Tennessee Volunteers': 'SEC',
  'Texas Longhorns': 'SEC',
  'Texas A&M Aggies': 'SEC',
  'Vanderbilt Commodores': 'SEC',

  // Big Ten
  'Illinois Fighting Illini': 'Big Ten',
  'Indiana Hoosiers': 'Big Ten',
  'Iowa Hawkeyes': 'Big Ten',
  'Maryland Terrapins': 'Big Ten',
  'Michigan Wolverines': 'Big Ten',
  'Michigan State Spartans': 'Big Ten',
  'Minnesota Golden Gophers': 'Big Ten',
  'Nebraska Cornhuskers': 'Big Ten',
  'Northwestern Wildcats': 'Big Ten',
  'Ohio State Buckeyes': 'Big Ten',
  'Oregon Ducks': 'Big Ten',
  'Penn State Nittany Lions': 'Big Ten',
  'Purdue Boilermakers': 'Big Ten',
  'Rutgers Scarlet Knights': 'Big Ten',
  'UCLA Bruins': 'Big Ten',
  'USC Trojans': 'Big Ten',
  'Washington Huskies': 'Big Ten',
  'Wisconsin Badgers': 'Big Ten',

  // Big 12
  'Arizona Wildcats': 'Big 12',
  'Arizona State Sun Devils': 'Big 12',
  'Baylor Bears': 'Big 12',
  'BYU Cougars': 'Big 12',
  'Cincinnati Bearcats': 'Big 12',
  'Colorado Buffaloes': 'Big 12',
  'Houston Cougars': 'Big 12',
  'Iowa State Cyclones': 'Big 12',
  'Kansas Jayhawks': 'Big 12',
  'Kansas State Wildcats': 'Big 12',
  'Oklahoma State Cowboys': 'Big 12',
  'TCU Horned Frogs': 'Big 12',
  'Texas Tech Red Raiders': 'Big 12',
  'UCF Knights': 'Big 12',
  'Utah Utes': 'Big 12',
  'West Virginia Mountaineers': 'Big 12',

  // ACC
  'Boston College Eagles': 'ACC',
  'California Golden Bears': 'ACC',
  'Clemson Tigers': 'ACC',
  'Duke Blue Devils': 'ACC',
  'Florida State Seminoles': 'ACC',
  'Georgia Tech Yellow Jackets': 'ACC',
  'Louisville Cardinals': 'ACC',
  'Miami Hurricanes': 'ACC',
  'NC State Wolfpack': 'ACC',
  'North Carolina Tar Heels': 'ACC',
  'Pittsburgh Panthers': 'ACC',
  'SMU Mustangs': 'ACC',
  'Stanford Cardinal': 'ACC',
  'Syracuse Orange': 'ACC',
  'Virginia Cavaliers': 'ACC',
  'Virginia Tech Hokies': 'ACC',
  'Wake Forest Demon Deacons': 'ACC',

  // Pac-12
  'Boise State Broncos': 'Pac-12',
  'Colorado State Rams': 'Pac-12',
  'Fresno State Bulldogs': 'Pac-12',
  'Oregon State Beavers': 'Pac-12',
  'San Diego State Aztecs': 'Pac-12',
  'Texas State Bobcats': 'Pac-12',
  'Utah State Aggies': 'Pac-12',
  'Washington State Cougars': 'Pac-12',

  // Mountain West
  'Air Force Falcons': 'Mtn West',
  "Hawai'i Rainbow Warriors": 'Mtn West',
  'Hawaii Rainbow Warriors': 'Mtn West',
  'Nevada Wolf Pack': 'Mtn West',
  'New Mexico Lobos': 'Mtn West',
  'Northern Illinois Huskies': 'Mtn West',
  'San José State Spartans': 'Mtn West',
  'San Jose State Spartans': 'Mtn West',
  'UNLV Rebels': 'Mtn West',
  'UTEP Miners': 'Mtn West',
  'Wyoming Cowboys': 'Mtn West',

  // AAC
  'Army Black Knights': 'AAC',
  'Charlotte 49ers': 'AAC',
  'East Carolina Pirates': 'AAC',
  'Florida Atlantic Owls': 'AAC',
  'Memphis Tigers': 'AAC',
  'Navy Midshipmen': 'AAC',
  'North Texas Mean Green': 'AAC',
  'Rice Owls': 'AAC',
  'South Florida Bulls': 'AAC',
  'Temple Owls': 'AAC',
  'Tulane Green Wave': 'AAC',
  'Tulsa Golden Hurricane': 'AAC',
  'UAB Blazers': 'AAC',
  'UTSA Roadrunners': 'AAC',

  // MAC
  'Akron Zips': 'MAC',
  'Ball State Cardinals': 'MAC',
  'Bowling Green Falcons': 'MAC',
  'Buffalo Bulls': 'MAC',
  'Central Michigan Chippewas': 'MAC',
  'Eastern Michigan Eagles': 'MAC',
  'Kent State Golden Flashes': 'MAC',
  'Miami (OH) RedHawks': 'MAC',
  'Massachusetts Minutemen': 'MAC',
  'UMass Minutemen': 'MAC',
  'Ohio Bobcats': 'MAC',
  'Toledo Rockets': 'MAC',
  'Western Michigan Broncos': 'MAC',

  // Sun Belt
  'App State Mountaineers': 'Sun Belt',
  'Appalachian State Mountaineers': 'Sun Belt',
  'Arkansas State Red Wolves': 'Sun Belt',
  'Coastal Carolina Chanticleers': 'Sun Belt',
  'Georgia Southern Eagles': 'Sun Belt',
  'Georgia State Panthers': 'Sun Belt',
  'James Madison Dukes': 'Sun Belt',
  "Louisiana Ragin' Cajuns": 'Sun Belt',
  'UL Monroe Warhawks': 'Sun Belt',
  'Marshall Thundering Herd': 'Sun Belt',
  'Old Dominion Monarchs': 'Sun Belt',
  'South Alabama Jaguars': 'Sun Belt',
  'Southern Miss Golden Eagles': 'Sun Belt',
  'Troy Trojans': 'Sun Belt',

  // Conference USA
  'Delaware Blue Hens': 'CUSA',
  'Florida International Panthers': 'CUSA',
  'FIU Panthers': 'CUSA',
  'Jacksonville State Gamecocks': 'CUSA',
  'Kennesaw State Owls': 'CUSA',
  'Liberty Flames': 'CUSA',
  'Louisiana Tech Bulldogs': 'CUSA',
  'Middle Tennessee Blue Raiders': 'CUSA',
  'Missouri State Bears': 'CUSA',
  'New Mexico State Aggies': 'CUSA',
  'Sam Houston Bearkats': 'CUSA',
  'Western Kentucky Hilltoppers': 'CUSA',

  // Independents
  'Notre Dame Fighting Irish': 'Ind.',
  'UConn Huskies': 'Ind.',
  'Connecticut Huskies': 'Ind.',
};

// Accent/whitespace-insensitive lookup so "San Jose State Spartans" resolves the
// same as "San José State Spartans" without needing every spelling spelled out.
function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const NORM_TEAMS = Object.fromEntries(
  Object.entries(TEAMS).map(([name, conf]) => [normalizeName(name), conf])
);

export function getConference(teamName) {
  if (!teamName) return 'Other';
  return TEAMS[teamName] ?? NORM_TEAMS[normalizeName(teamName)] ?? 'Other';
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
