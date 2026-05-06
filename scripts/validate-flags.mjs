import fs from "fs";
import path from "path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const flagsDir = path.join(rootDir, "public", "flags");

const REQUIRED_FLAG_FILES = [
  "alemania.png",
  "arabia-saudi.png",
  "argelia.png",
  "argentina.png",
  "australia.png",
  "austria.png",
  "belgica.png",
  "bolivia.png",
  "bosnia-y-herzegovina.png",
  "brasil.png",
  "cabo-verde.png",
  "canada.png",
  "catar.png",
  "chequia.png",
  "colombia.png",
  "corea.png",
  "corea-del-sur.png",
  "costa-marfil.png",
  "costa-de-marfil.png",
  "croacia.png",
  "curazao.png",
  "dinamarca.png",
  "ecuador.png",
  "egipto.png",
  "emiratos-arabes-unidos.png",
  "escocia.png",
  "eslovaquia.png",
  "espana.png",
  "estados-unidos.png",
  "francia.png",
  "gales.png",
  "ghana.png",
  "haiti.png",
  "holanda.png",
  "inglaterra.png",
  "irak.png",
  "iran.png",
  "iraq.png",
  "irlanda.png",
  "irlanda-del-norte.png",
  "italia.png",
  "jamaica.png",
  "japon.png",
  "jordania.png",
  "kosovo.png",
  "macedonia-del-norte.png",
  "marruecos.png",
  "mexico.png",
  "noruega.png",
  "nueva-caledonia.png",
  "nueva-zelanda.png",
  "paises-bajos.png",
  "panama.png",
  "paraguay.png",
  "polonia.png",
  "portugal.png",
  "qatar.png",
  "rd-congo.png",
  "rd-del-congo.png",
  "republica-checa.png",
  "rumania.png",
  "senegal.png",
  "sudafrica.png",
  "suecia.png",
  "suiza.png",
  "surinam.png",
  "tunez.png",
  "turquia.png",
  "ucrania.png",
  "uruguay.png",
  "usa.png",
  "uzbekistan.png",
];

const missing = REQUIRED_FLAG_FILES.filter((file) => !fs.existsSync(path.join(flagsDir, file)));

if (missing.length > 0) {
  console.error("Missing flag assets:");
  missing.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log(`Flag catalog OK: ${REQUIRED_FLAG_FILES.length} PNG assets verified in public/flags.`);
