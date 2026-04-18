const FLAG_EMOJI: Record<string, string> = {
  "México": "🇲🇽",
  "Sudáfrica": "🇿🇦",
  "Corea del Sur": "🇰🇷",
  "Chequia": "🇨🇿",
  "Canadá": "🇨🇦",
  "Bosnia y Herzegovina": "🇧🇦",
  "Catar": "🇶🇦",
  "Suiza": "🇨🇭",
  "Brasil": "🇧🇷",
  "Marruecos": "🇲🇦",
  "Haití": "🇭🇹",
  "Escocia": "🏴",
  "Estados Unidos": "🇺🇸",
  "Paraguay": "🇵🇾",
  "Australia": "🇦🇺",
  "Turquía": "🇹🇷",
  "Alemania": "🇩🇪",
  "Curazao": "🇨🇼",
  "Costa de Marfil": "🇨🇮",
  "Ecuador": "🇪🇨",
  "Países Bajos": "🇳🇱",
  "Japón": "🇯🇵",
  "Suecia": "🇸🇪",
  "Túnez": "🇹🇳",
  "Bélgica": "🇧🇪",
  "Egipto": "🇪🇬",
  "Irán": "🇮🇷",
  "Nueva Zelanda": "🇳🇿",
  "España": "🇪🇸",
  "Cabo Verde": "🇨🇻",
  "Arabia Saudí": "🇸🇦",
  "Uruguay": "🇺🇾",
  "Francia": "🇫🇷",
  "Senegal": "🇸🇳",
  "Irak": "🇮🇶",
  "Noruega": "🇳🇴",
  "Argentina": "🇦🇷",
  "Argelia": "🇩🇿",
  "Austria": "🇦🇹",
  "Jordania": "🇯🇴",
  "Portugal": "🇵🇹",
  "RD Congo": "🇨🇩",
  "RD del Congo": "🇨🇩",
  "Uzbekistán": "🇺🇿",
  "Colombia": "🇨🇴",
  "Inglaterra": "🏴",
  "Croacia": "🇭🇷",
  "Ghana": "🇬🇭",
  "Panamá": "🇵🇦",
};

export function getFlagPath(country: string): string | null {
  return country === "Inglaterra" ? "/flags/Inglaterra.png" : null;
}

export function getFlagEmoji(country: string): string {
  return FLAG_EMOJI[country] || "🏳️";
}

export default FLAG_EMOJI;
