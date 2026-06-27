const ISO_BY_NAME = {
  'Canadá': 'ca', 'México': 'mx', 'Estados Unidos': 'us', 'Curazao': 'cw', 'Haití': 'ht',
  'Panamá': 'pa', 'Australia': 'au', 'Irán': 'ir', 'Japón': 'jp', 'Jordania': 'jo',
  'Catar': 'qa', 'Arabia Saudita': 'sa', 'Corea del Sur': 'kr', 'Uzbekistán': 'uz', 'Irak': 'iq',
  'Argelia': 'dz', 'Cabo Verde': 'cv', 'RD Congo': 'cd', 'Egipto': 'eg', 'Ghana': 'gh',
  'Costa de Marfil': 'ci', 'Marruecos': 'ma', 'Senegal': 'sn', 'Sudáfrica': 'za', 'Túnez': 'tn',
  'Argentina': 'ar', 'Brasil': 'br', 'Colombia': 'co', 'Ecuador': 'ec', 'Paraguay': 'py',
  'Uruguay': 'uy', 'Nueva Zelanda': 'nz', 'Austria': 'at', 'Bélgica': 'be',
  'Bosnia y Herzegovina': 'ba', 'Croacia': 'hr', 'Chequia': 'cz', 'Inglaterra': 'gb-eng',
  'Francia': 'fr', 'Alemania': 'de', 'Países Bajos': 'nl', 'Noruega': 'no', 'Portugal': 'pt',
  'Escocia': 'gb-sct', 'España': 'es', 'Suecia': 'se', 'Suiza': 'ch', 'Turquía': 'tr',
};

export function teamFlagUrl(iso, width = 40) {
  if (!iso) return null;
  return `https://flagcdn.com/w${width}/${iso}.png`;
}

const RAW = [
  { keys: ['Canada', 'Canadá'], name: 'Canadá', flag: '🇨🇦', cornersFav: 5.0, cornersAgainst: 4.8, aggressiveness: 12.5, aerial: ['Alistair Johnston', 'Jonathan David'] },
  { keys: ['Mexico', 'México'], name: 'México', flag: '🇲🇽', cornersFav: 5.5, cornersAgainst: 4.3, aggressiveness: 13.0, aerial: ['César Montes', 'Raúl Jiménez'] },
  { keys: ['USA', 'United States', 'Estados Unidos'], name: 'Estados Unidos', flag: '🇺🇸', cornersFav: 5.8, cornersAgainst: 4.0, aggressiveness: 11.8, aerial: ['Chris Richards', 'Ricardo Pepi'] },
  { keys: ['Curaçao', 'Curacao'], name: 'Curazao', flag: '🇨🇼', cornersFav: 3.8, cornersAgainst: 5.5, aggressiveness: 14.2, aerial: ['Roshon van Eijma', 'Jürgen Locadia'] },
  { keys: ['Haiti', 'Haití'], name: 'Haití', flag: '🇭🇹', cornersFav: 4.0, cornersAgainst: 5.2, aggressiveness: 15.5, aerial: ['Ricardo Adé', 'Duckens Nazon'] },
  { keys: ['Panama', 'Panamá'], name: 'Panamá', flag: '🇵🇦', cornersFav: 4.5, cornersAgainst: 4.8, aggressiveness: 14.8, aerial: ['Román Torres', 'Ismael Díaz'] },
  { keys: ['Australia'], name: 'Australia', flag: '🇦🇺', cornersFav: 5.2, cornersAgainst: 4.5, aggressiveness: 13.5, aerial: ['Harry Souttar', 'Mathew Leckie'] },
  { keys: ['Iran', 'IR Iran', 'Irán'], name: 'Irán', flag: '🇮🇷', cornersFav: 4.8, cornersAgainst: 4.6, aggressiveness: 13.2, aerial: ['Morteza Pouraliganji', 'Sardar Azmoun'] },
  { keys: ['Japan', 'Japón'], name: 'Japón', flag: '🇯🇵', cornersFav: 6.2, cornersAgainst: 3.8, aggressiveness: 11.2, aerial: ['Maya Yoshida', 'Takefusa Kubo'] },
  { keys: ['Jordan', 'Jordania'], name: 'Jordania', flag: '🇯🇴', cornersFav: 4.2, cornersAgainst: 5.0, aggressiveness: 14.0, aerial: ['Yazan Al-Arab', 'Musa Al-Taamari'] },
  { keys: ['Qatar', 'Catar'], name: 'Catar', flag: '🇶🇦', cornersFav: 5.0, cornersAgainst: 4.5, aggressiveness: 12.8, aerial: ['Boualem Khoukhi', 'Akram Afif'] },
  { keys: ['Saudi Arabia', 'Arabia Saudita'], name: 'Arabia Saudita', flag: '🇸🇦', cornersFav: 4.5, cornersAgainst: 4.8, aggressiveness: 13.5, aerial: ['Ali Al-Boleahi', 'Saleh Al-Shehri'] },
  { keys: ['South Korea', 'Korea Republic', 'Corea del Sur'], name: 'Corea del Sur', flag: '🇰🇷', cornersFav: 5.8, cornersAgainst: 4.0, aggressiveness: 12.0, aerial: ['Kim Min-jae', 'Son Heung-min'] },
  { keys: ['Uzbekistan', 'Uzbekistán'], name: 'Uzbekistán', flag: '🇺🇿', cornersFav: 4.8, cornersAgainst: 4.8, aggressiveness: 13.8, aerial: ['Shakhzod Azmiddinov', 'Eldor Shomurodov'] },
  { keys: ['Iraq', 'Irak'], name: 'Irak', flag: '🇮🇶', cornersFav: 4.5, cornersAgainst: 5.0, aggressiveness: 14.2, aerial: ['Ali Adnan', 'Mohanad Ali'] },
  { keys: ['Algeria', 'Argelia'], name: 'Argelia', flag: '🇩🇿', cornersFav: 5.5, cornersAgainst: 4.2, aggressiveness: 12.8, aerial: ['Aïssa Mandi', 'Riyad Mahrez'] },
  { keys: ['Cabo Verde', 'Cape Verde'], name: 'Cabo Verde', flag: '🇨🇻', cornersFav: 3.5, cornersAgainst: 5.2, aggressiveness: 15.0, aerial: ['Stopira', 'Ryan Mendes'] },
  { keys: ['DR Congo', 'Congo DR', 'RD Congo'], name: 'RD Congo', flag: '🇨🇩', cornersFav: 4.2, cornersAgainst: 5.0, aggressiveness: 15.8, aerial: ['Chancel Mbemba', 'Cédric Bakambu'] },
  { keys: ['Egypt', 'Egipto'], name: 'Egipto', flag: '🇪🇬', cornersFav: 5.2, cornersAgainst: 4.3, aggressiveness: 12.5, aerial: ['Ahmed Hegazi', 'Mohamed Salah'] },
  { keys: ['Ghana'], name: 'Ghana', flag: '🇬🇭', cornersFav: 5.5, cornersAgainst: 4.5, aggressiveness: 13.2, aerial: ['Thomas Partey', 'Iñaki Williams'] },
  { keys: ['Ivory Coast', 'Cote d\'Ivoire', 'Costa de Marfil'], name: 'Costa de Marfil', flag: '🇨🇮', cornersFav: 5.8, cornersAgainst: 4.2, aggressiveness: 13.5, aerial: ['Willy Boly', 'Sébastien Haller'] },
  { keys: ['Morocco', 'Marruecos'], name: 'Marruecos', flag: '🇲🇦', cornersFav: 6.0, cornersAgainst: 3.8, aggressiveness: 12.2, aerial: ['Romain Saïss', 'Youssef En-Nesyri'] },
  { keys: ['Senegal'], name: 'Senegal', flag: '🇸🇳', cornersFav: 5.5, cornersAgainst: 4.0, aggressiveness: 13.8, aerial: ['Kalidou Koulibaly', 'Sadio Mané'] },
  { keys: ['South Africa', 'Sudáfrica'], name: 'Sudáfrica', flag: '🇿🇦', cornersFav: 4.8, cornersAgainst: 4.8, aggressiveness: 13.0, aerial: ['Percy Tau', 'Ronwen Williams'] },
  { keys: ['Tunisia', 'Túnez'], name: 'Túnez', flag: '🇹🇳', cornersFav: 5.0, cornersAgainst: 4.5, aggressiveness: 12.5, aerial: ['Dylan Bronn', 'Wahbi Khazri'] },
  { keys: ['Argentina'], name: 'Argentina', flag: '🇦🇷', cornersFav: 6.1, cornersAgainst: 3.9, aggressiveness: 13.8, aerial: ['Cristian Romero', 'Lautaro Martínez'] },
  { keys: ['Brazil', 'Brasil'], name: 'Brasil', flag: '🇧🇷', cornersFav: 6.5, cornersAgainst: 3.5, aggressiveness: 12.5, aerial: ['Marquinhos', 'Richarlison'] },
  { keys: ['Colombia'], name: 'Colombia', flag: '🇨🇴', cornersFav: 5.8, cornersAgainst: 4.2, aggressiveness: 15.2, aerial: ['Dávinson Sánchez', 'Luis Díaz'] },
  { keys: ['Ecuador'], name: 'Ecuador', flag: '🇪🇨', cornersFav: 5.5, cornersAgainst: 4.0, aggressiveness: 13.0, aerial: ['Piero Hincapié', 'Enner Valencia'] },
  { keys: ['Paraguay'], name: 'Paraguay', flag: '🇵🇾', cornersFav: 5.0, cornersAgainst: 4.5, aggressiveness: 14.5, aerial: ['Gustavo Gómez', 'Antonio Sanabria'] },
  { keys: ['Uruguay'], name: 'Uruguay', flag: '🇺🇾', cornersFav: 5.4, cornersAgainst: 4.6, aggressiveness: 16.0, aerial: ['José María Giménez', 'Darwin Núñez'] },
  { keys: ['New Zealand', 'Nueva Zelanda'], name: 'Nueva Zelanda', flag: '🇳🇿', cornersFav: 4.0, cornersAgainst: 5.5, aggressiveness: 13.5, aerial: ['Winston Reid', 'Chris Wood'] },
  { keys: ['Austria'], name: 'Austria', flag: '🇦🇹', cornersFav: 5.5, cornersAgainst: 4.2, aggressiveness: 12.8, aerial: ['David Alaba', 'Marko Arnautović'] },
  { keys: ['Belgium', 'Bélgica'], name: 'Bélgica', flag: '🇧🇪', cornersFav: 5.8, cornersAgainst: 4.0, aggressiveness: 11.5, aerial: ['Jan Vertonghen', 'Romelu Lukaku'] },
  { keys: ['Bosnia and Herzegovina', 'Bosnia y Herzegovina'], name: 'Bosnia y Herzegovina', flag: '🇧🇦', cornersFav: 5.0, cornersAgainst: 4.5, aggressiveness: 14.0, aerial: ['Miralem Pjanić', 'Edin Džeko'] },
  { keys: ['Croatia', 'Croacia'], name: 'Croacia', flag: '🇭🇷', cornersFav: 5.8, cornersAgainst: 4.0, aggressiveness: 12.8, aerial: ['Joško Gvardiol', 'Andrej Kramarić'] },
  { keys: ['Czech Republic', 'Czechia', 'Chequia'], name: 'Chequia', flag: '🇨🇿', cornersFav: 5.2, cornersAgainst: 4.3, aggressiveness: 13.2, aerial: ['Tomáš Souček', 'Patrik Schick'] },
  { keys: ['England', 'Inglaterra'], name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', cornersFav: 6.7, cornersAgainst: 3.3, aggressiveness: 11.8, aerial: ['Harry Maguire', 'Harry Kane'] },
  { keys: ['France', 'Francia'], name: 'Francia', flag: '🇫🇷', cornersFav: 5.9, cornersAgainst: 4.1, aggressiveness: 14.0, aerial: ['Dayot Upamecano', 'Olivier Giroud'] },
  { keys: ['Germany', 'Alemania'], name: 'Alemania', flag: '🇩🇪', cornersFav: 6.2, cornersAgainst: 3.8, aggressiveness: 13.0, aerial: ['Antonio Rüdiger', 'Niclas Füllkrug'] },
  { keys: ['Netherlands', 'Holland', 'Países Bajos'], name: 'Países Bajos', flag: '🇳🇱', cornersFav: 6.0, cornersAgainst: 4.0, aggressiveness: 12.2, aerial: ['Virgil van Dijk', 'Memphis Depay'] },
  { keys: ['Norway', 'Noruega'], name: 'Noruega', flag: '🇳🇴', cornersFav: 5.5, cornersAgainst: 4.3, aggressiveness: 13.5, aerial: ['Erling Haaland', 'Martin Ødegaard'] },
  { keys: ['Portugal'], name: 'Portugal', flag: '🇵🇹', cornersFav: 6.3, cornersAgainst: 3.7, aggressiveness: 12.8, aerial: ['Rúben Dias', 'Cristiano Ronaldo'] },
  { keys: ['Scotland', 'Escocia'], name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', cornersFav: 5.0, cornersAgainst: 4.5, aggressiveness: 13.8, aerial: ['Scott McTominay', 'Lyndon Dykes'] },
  { keys: ['Spain', 'España'], name: 'España', flag: '🇪🇸', cornersFav: 6.8, cornersAgainst: 3.2, aggressiveness: 11.5, aerial: ['Aymeric Laporte', 'Álvaro Morata'] },
  { keys: ['Sweden', 'Suecia'], name: 'Suecia', flag: '🇸🇪', cornersFav: 5.5, cornersAgainst: 4.2, aggressiveness: 12.5, aerial: ['Victor Lindelöf', 'Alexander Isak'] },
  { keys: ['Switzerland', 'Suiza'], name: 'Suiza', flag: '🇨🇭', cornersFav: 5.2, cornersAgainst: 4.0, aggressiveness: 12.0, aerial: ['Manuel Akanji', 'Breel Embolo'] },
  { keys: ['Turkey', 'Türkiye', 'Turquía'], name: 'Turquía', flag: '🇹🇷', cornersFav: 5.5, cornersAgainst: 4.3, aggressiveness: 13.2, aerial: ['Çağlar Söyüncü', 'Hakan Çalhanoğlu'] },
];

const lookup = new Map();
for (const team of RAW) {
  for (const key of team.keys) {
    lookup.set(key.toLowerCase().trim(), team);
  }
}

export function resolveTeam(name) {
  const key = (name || '').toLowerCase().trim();
  const found = lookup.get(key);
  const base = found || {
    keys: [name],
    name,
    flag: '🏳️',
    cornersFav: 4.5,
    cornersAgainst: 4.5,
    aggressiveness: 12.0,
    aerial: ['Referente defensivo', 'Delantero centro'],
  };

  const shooters = base.shooters || [
    { name: base.aerial[1] || 'Delantero principal', avgShots: base.cornersFav * 0.42 },
    { name: base.aerial[0] || 'Segundo referente', avgShots: base.cornersFav * 0.24 },
  ].filter((p) => !/medio ofensivo/i.test(p.name));

  const iso = base.iso ?? ISO_BY_NAME[base.name] ?? null;

  return {
    ...base,
    displayName: base.name,
    iso,
    flagUrl: teamFlagUrl(iso),
    logo: null,
    shotsOnTargetFav: base.shotsOnTargetFav ?? +(base.cornersFav * 0.58).toFixed(2),
    shotsOnTargetAgainst: base.shotsOnTargetAgainst ?? +(base.cornersAgainst * 0.52).toFixed(2),
    shooters,
  };
}

export function teamStats(team) {
  return {
    goalsForAvg: +(team.cornersFav * 0.35).toFixed(1),
    goalsAgainstAvg: +(team.cornersAgainst * 0.32).toFixed(1),
    winRate: +(team.cornersFav / 10).toFixed(2),
    aggressiveness: team.aggressiveness,
    redPerGame: +(team.aggressiveness / 80).toFixed(2),
    form: '—',
  };
}
