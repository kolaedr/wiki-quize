/**
 * Hand-authored seed data for DESIGN/DEV: realistic entities for all starter
 * games without hitting Wikidata. Real content comes from the admin-panel
 * import; this seed exists so the UI can be polished on day one.
 *
 * Image URLs hotlink Commons via Special:FilePath — a few may 404 (file
 * renames); the UI falls back to emoji/placeholder by design.
 */

export interface Ref {
  qid: string;
  labels: { en: string; uk: string };
}

const flag = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;

// ── Languages (refs) ─────────────────────────────────────────────
const L = {
  en: { qid: "Q1860", labels: { en: "English", uk: "Англійська" } },
  fr: { qid: "Q150", labels: { en: "French", uk: "Французька" } },
  de: { qid: "Q188", labels: { en: "German", uk: "Німецька" } },
  es: { qid: "Q1321", labels: { en: "Spanish", uk: "Іспанська" } },
  it: { qid: "Q652", labels: { en: "Italian", uk: "Італійська" } },
  pt: { qid: "Q5146", labels: { en: "Portuguese", uk: "Португальська" } },
  nl: { qid: "Q7411", labels: { en: "Dutch", uk: "Нідерландська" } },
  sv: { qid: "Q9027", labels: { en: "Swedish", uk: "Шведська" } },
  no: { qid: "Q9043", labels: { en: "Norwegian", uk: "Норвезька" } },
  da: { qid: "Q9035", labels: { en: "Danish", uk: "Данська" } },
  fi: { qid: "Q1412", labels: { en: "Finnish", uk: "Фінська" } },
  uk: { qid: "Q8798", labels: { en: "Ukrainian", uk: "Українська" } },
  pl: { qid: "Q809", labels: { en: "Polish", uk: "Польська" } },
  cs: { qid: "Q9056", labels: { en: "Czech", uk: "Чеська" } },
  hu: { qid: "Q9067", labels: { en: "Hungarian", uk: "Угорська" } },
  ro: { qid: "Q7913", labels: { en: "Romanian", uk: "Румунська" } },
  el: { qid: "Q36510", labels: { en: "Greek", uk: "Грецька" } },
  tr: { qid: "Q256", labels: { en: "Turkish", uk: "Турецька" } },
  ar: { qid: "Q13955", labels: { en: "Arabic", uk: "Арабська" } },
  ja: { qid: "Q5287", labels: { en: "Japanese", uk: "Японська" } },
  ko: { qid: "Q9176", labels: { en: "Korean", uk: "Корейська" } },
  zh: { qid: "Q7850", labels: { en: "Chinese", uk: "Китайська" } },
  hi: { qid: "Q1568", labels: { en: "Hindi", uk: "Гінді" } },
  th: { qid: "Q9217", labels: { en: "Thai", uk: "Тайська" } },
  vi: { qid: "Q9199", labels: { en: "Vietnamese", uk: "В'єтнамська" } },
  id: { qid: "Q9240", labels: { en: "Indonesian", uk: "Індонезійська" } },
  is: { qid: "Q294", labels: { en: "Icelandic", uk: "Ісландська" } },
  he: { qid: "Q9288", labels: { en: "Hebrew", uk: "Іврит" } },
} satisfies Record<string, Ref>;

// ── Countries ────────────────────────────────────────────────────
export interface SeedCountry {
  qid: string;
  en: string;
  uk: string;
  flagFile: string;
  emoji: string;
  langs: Ref[];
  population: number;
  area: number;
  wikiEn: string;
  wikiUk: string;
}

const c = (
  qid: string,
  en: string,
  uk: string,
  flagFile: string,
  emoji: string,
  langs: Ref[],
  population: number,
  area: number,
  wikiUk?: string,
): SeedCountry => ({
  qid,
  en,
  uk,
  flagFile,
  emoji,
  langs,
  population,
  area,
  wikiEn: `https://en.wikipedia.org/wiki/${en.replaceAll(" ", "_")}`,
  wikiUk: `https://uk.wikipedia.org/wiki/${(wikiUk ?? uk).replaceAll(" ", "_")}`,
});

/** Ordered famous → less famous (drives difficultyScore & levels). */
export const COUNTRIES: SeedCountry[] = [
  c("Q30", "United States", "США", "Flag of the United States.svg", "🇺🇸", [L.en], 335_000_000, 9_833_520, "Сполучені Штати Америки"),
  c("Q142", "France", "Франція", "Flag of France.svg", "🇫🇷", [L.fr], 68_000_000, 643_801),
  c("Q183", "Germany", "Німеччина", "Flag of Germany.svg", "🇩🇪", [L.de], 84_000_000, 357_588),
  c("Q145", "United Kingdom", "Велика Британія", "Flag of the United Kingdom.svg", "🇬🇧", [L.en], 68_000_000, 242_495),
  c("Q17", "Japan", "Японія", "Flag of Japan.svg", "🇯🇵", [L.ja], 124_000_000, 377_975),
  c("Q148", "China", "Китай", "Flag of the People's Republic of China.svg", "🇨🇳", [L.zh], 1_410_000_000, 9_596_961),
  c("Q38", "Italy", "Італія", "Flag of Italy.svg", "🇮🇹", [L.it], 59_000_000, 301_340),
  c("Q29", "Spain", "Іспанія", "Flag of Spain.svg", "🇪🇸", [L.es], 48_000_000, 505_990),
  c("Q212", "Ukraine", "Україна", "Flag of Ukraine.svg", "🇺🇦", [L.uk], 38_000_000, 603_628),
  c("Q155", "Brazil", "Бразилія", "Flag of Brazil.svg", "🇧🇷", [L.pt], 216_000_000, 8_515_767),
  c("Q16", "Canada", "Канада", "Flag of Canada (Pantone).svg", "🇨🇦", [L.en, L.fr], 40_000_000, 9_984_670),
  c("Q668", "India", "Індія", "Flag of India.svg", "🇮🇳", [L.hi, L.en], 1_430_000_000, 3_287_263),
  c("Q96", "Mexico", "Мексика", "Flag of Mexico.svg", "🇲🇽", [L.es], 129_000_000, 1_964_375),
  c("Q408", "Australia", "Австралія", "Flag of Australia (converted).svg", "🇦🇺", [L.en], 26_000_000, 7_692_024),
  c("Q43", "Turkey", "Туреччина", "Flag of Turkey.svg", "🇹🇷", [L.tr], 85_000_000, 783_562),
  c("Q36", "Poland", "Польща", "Flag of Poland.svg", "🇵🇱", [L.pl], 37_000_000, 312_696),
  c("Q55", "Netherlands", "Нідерланди", "Flag of the Netherlands.svg", "🇳🇱", [L.nl], 17_900_000, 41_850),
  c("Q39", "Switzerland", "Швейцарія", "Flag of Switzerland (Pantone).svg", "🇨🇭", [L.de, L.fr, L.it], 8_800_000, 41_284),
  c("Q34", "Sweden", "Швеція", "Flag of Sweden.svg", "🇸🇪", [L.sv], 10_500_000, 450_295),
  c("Q20", "Norway", "Норвегія", "Flag of Norway.svg", "🇳🇴", [L.no], 5_500_000, 385_207),
  c("Q41", "Greece", "Греція", "Flag of Greece.svg", "🇬🇷", [L.el], 10_400_000, 131_957),
  c("Q45", "Portugal", "Португалія", "Flag of Portugal.svg", "🇵🇹", [L.pt], 10_300_000, 92_212),
  c("Q79", "Egypt", "Єгипет", "Flag of Egypt.svg", "🇪🇬", [L.ar], 106_000_000, 1_002_450),
  c("Q884", "South Korea", "Південна Корея", "Flag of South Korea.svg", "🇰🇷", [L.ko], 51_700_000, 100_210),
  c("Q414", "Argentina", "Аргентина", "Flag of Argentina.svg", "🇦🇷", [L.es], 46_000_000, 2_780_400),
  c("Q40", "Austria", "Австрія", "Flag of Austria.svg", "🇦🇹", [L.de], 9_100_000, 83_879),
  c("Q31", "Belgium", "Бельгія", "Flag of Belgium.svg", "🇧🇪", [L.nl, L.fr, L.de], 11_700_000, 30_528),
  c("Q35", "Denmark", "Данія", "Flag of Denmark.svg", "🇩🇰", [L.da], 5_900_000, 42_933),
  c("Q33", "Finland", "Фінляндія", "Flag of Finland.svg", "🇫🇮", [L.fi, L.sv], 5_600_000, 338_424),
  c("Q213", "Czech Republic", "Чехія", "Flag of the Czech Republic.svg", "🇨🇿", [L.cs], 10_900_000, 78_871),
  c("Q218", "Romania", "Румунія", "Flag of Romania.svg", "🇷🇴", [L.ro], 19_000_000, 238_391),
  c("Q28", "Hungary", "Угорщина", "Flag of Hungary.svg", "🇭🇺", [L.hu], 9_600_000, 93_028),
  c("Q869", "Thailand", "Таїланд", "Flag of Thailand.svg", "🇹🇭", [L.th], 71_800_000, 513_120),
  c("Q881", "Vietnam", "В'єтнам", "Flag of Vietnam.svg", "🇻🇳", [L.vi], 100_000_000, 331_212),
  c("Q252", "Indonesia", "Індонезія", "Flag of Indonesia.svg", "🇮🇩", [L.id], 277_000_000, 1_904_569),
  c("Q801", "Israel", "Ізраїль", "Flag of Israel.svg", "🇮🇱", [L.he], 9_800_000, 20_770),
  c("Q298", "Chile", "Чилі", "Flag of Chile.svg", "🇨🇱", [L.es], 19_600_000, 756_102),
  c("Q189", "Iceland", "Ісландія", "Flag of Iceland.svg", "🇮🇸", [L.is], 380_000, 103_000),
];

export const countryFlagUrl = (x: SeedCountry) => flag(x.flagFile);

/** Commons arms filenames vary a lot — candidates, first working one wins. */
export const countryArmsUrls = (x: SeedCountry) =>
  [
    `Coat of arms of ${x.en}.svg`,
    `Coat of arms of the ${x.en}.svg`,
    `Emblem of ${x.en}.svg`,
    `National Emblem of ${x.en}.svg`,
    `State Emblem of ${x.en}.svg`,
    `Coat of arms of ${x.en}.png`,
  ].map(flag);
export const countryRef = (x: SeedCountry): Ref => ({
  qid: x.qid,
  labels: { en: x.en, uk: x.uk },
});

// ── Car brands ───────────────────────────────────────────────────
export interface SeedBrand {
  qid: string;
  name: string;
  /** Commons filename candidates — the seed script picks the FIRST that
   * actually resolves (URL availability check), so no broken logos. */
  logoCandidates: string[];
  origin: SeedCountry;
  inception: number;
  wikiEn: string;
}

const byQid = new Map(COUNTRIES.map((x) => [x.qid, x]));
const CO = (qid: string) => byQid.get(qid)!;

const b = (
  qid: string,
  name: string,
  logoCandidates: string[],
  originQid: string,
  inception: number,
  wikiSlug?: string,
): SeedBrand => ({
  qid,
  name,
  logoCandidates,
  origin: CO(originQid),
  inception,
  wikiEn: `https://en.wikipedia.org/wiki/${(wikiSlug ?? name).replaceAll(" ", "_")}`,
});

/** Ordered famous → less famous. */
export const BRANDS: SeedBrand[] = [
  b("Q53268", "Toyota", ["Toyota carlogo.svg", "Toyota Motor Corporation logo (2020).svg", "Toyota EU.svg", "Toyota logo.png"], "Q17", 1937),
  b("Q26678", "BMW", ["BMW.svg", "BMW logo (gray).svg", "BMW logo (2017).svg"], "Q183", 1916),
  b("Q36008", "Mercedes-Benz", ["Mercedes-Logo.svg", "Mercedes-Benz Logo 2010.svg", "Mercedes-Benz free logo.svg"], "Q183", 1926),
  b("Q246", "Volkswagen", ["Volkswagen logo 2019.svg", "Volkswagen Logo.png", "VW-Logo.svg"], "Q183", 1937),
  b("Q44294", "Ford", ["Ford logo flat.svg", "Ford Motor Company Logo.svg", "Ford logo.svg"], "Q30", 1903, "Ford_Motor_Company"),
  b("Q23317", "Audi", ["Audi-Logo 2016.svg", "Audi logo detail.svg", "Audi Rings.svg"], "Q183", 1909),
  b("Q9584", "Honda", ["Honda Logo.svg", "Honda logo.png", "Honda-logo.svg"], "Q17", 1948),
  b("Q478214", "Tesla", ["Tesla Motors.svg", "Tesla T symbol.svg", "Tesla logo.png"], "Q30", 2003, "Tesla,_Inc."),
  b("Q27586", "Ferrari", ["Ferrari-Logo.svg", "Scuderia Ferrari Logo.svg", "Prancing horse.svg"], "Q38", 1939),
  b("Q40993", "Porsche", ["Porsche logo.svg", "Porsche Wappen.svg", "Porsche wordmark.svg"], "Q183", 1931),
  b("Q20165", "Nissan", ["Nissan 2020 logo.svg", "Nissan logo.png", "Nissan-logo.svg"], "Q17", 1933),
  b("Q29570", "Chevrolet", ["Chevrolet logo.svg", "Chevrolet-logo.png", "Chevrolet.svg"], "Q30", 1911),
  b("Q6686", "Renault", ["Renault 2021 Text.svg", "Renault 2021.svg", "Renault Logo.svg"], "Q142", 1899),
  b("Q35886", "Lamborghini", ["Lamborghini Logo.svg", "Lamborghini logo.png", "Lamborghini.svg"], "Q38", 1963),
  b("Q6742", "Peugeot", ["Peugeot Logo.svg", "Peugeot 2021 Logo.svg", "Peugeot logo.png"], "Q142", 1810),
  b("Q55931", "Hyundai", ["Hyundai Motor Company logo.svg", "Hyundai logo.svg", "Hyundai-logo.png"], "Q884", 1967, "Hyundai_Motor_Company"),
  b("Q35996", "Mazda", ["Mazda logo with emblem.svg", "Mazda logo.svg", "Mazda-logo.png"], "Q17", 1920),
  b("Q181642", "Suzuki", ["Suzuki logo 2.svg", "Suzuki Motor Corporation logo.svg", "Suzuki logo.png"], "Q17", 1909),
  b("Q35349", "Kia", ["KIA logo3.svg", "KIA logo2.svg", "Kia-logo.png"], "Q884", 1944),
  b("Q172741", "Subaru", ["Subaru logo.svg", "Subaru Corporation logo.svg", "Subaru-logo.png"], "Q17", 1953),
  b("Q6746", "Citroën", ["Citroen 2022.svg", "Citroën 2021.svg", "Citroen-logo.png"], "Q142", 1919, "Citroën"),
  b("Q29637", "Škoda", ["Skoda Auto logo (2022).svg", "Škoda Auto logo.svg", "Skoda-logo.png"], "Q213", 1895, "Škoda_Auto"),
  b("Q215293", "Volvo", ["Volvo logo1.svg", "Volvo-Iron-Mark.svg", "Volvo Cars logo.svg"], "Q34", 1927, "Volvo_Cars"),
  b("Q30113", "Jeep", ["Jeep logo.svg", "Jeep wordmark.svg", "Jeep-logo.png"], "Q30", 1941),
  b("Q40966", "Opel", ["Opel-Logo 2021.svg", "Opel Logo 2017.svg", "Opel-logo.png"], "Q183", 1862),
  b("Q7501", "Fiat", ["Fiat Automobiles logo.svg", "Fiat logo.svg", "Fiat-logo.png"], "Q38", 1899, "Fiat_Automobiles"),
];

export const commonsUrl = flag;
export const brandLogoUrls = (x: SeedBrand) => x.logoCandidates.map(flag);
