// The ad description, assembled from fixed per-language templates (English / Sinhala / Tamil, each
// with a general and a walk-in interview variant). The model only extracts the content
// (DescriptionDetails); headings, emojis and boilerplate always come from here, verbatim.

export const DESCRIPTION_LANGUAGES = ["English", "Sinhala", "Tamil"] as const;
export type DescriptionLanguage = (typeof DESCRIPTION_LANGUAGES)[number];

/** Content for the description template, written in `language`. Empty strings/lists = not on the poster. */
export interface DescriptionDetails {
  language: DescriptionLanguage;
  walkInInterview: boolean;
  position: string;
  /** Education and professional qualifications. */
  qualifications: string[];
  /** Everything else asked of the candidate (experience, skills, age, ...). */
  requirements: string[];
  responsibilities: string[];
  /** Poster-specific benefits; the template's standard benefits sentence is added on top. */
  benefits: string[];
  interviewDate: string;
  interviewTime: string;
  /** The interview venue's name. */
  interviewLocation: string;
  interviewAddress: string;
  contactPhone: string;
  email: string;
  website: string;
  address: string;
}

const BULLET = "【~】✪ 🔹";
const TAMIL_BULLET = "【~】✪";
const WALK_IN_BANNER = "✪ 𝐖𝐀𝐋𝐊 - 𝐈𝐍 𝐈𝐍𝐓𝐄𝐑𝐕𝐈𝐄𝐖𝐒 ✪";

const ENGLISH_BENEFITS =
  "【~】✪ An attractive remuneration package with a pleasant working environment, and excellent opportunities for career development is on offer for the correct candidate.";
const SINHALA_BENEFITS = "ආකර්ශනීය වැටුපක් සහ අනෙකුත් වරප්‍රසාද රැසක් පිරිනැමේ.";
const TAMIL_BENEFITS =
  "【~】✪ ஒரு இனிமையான பணிச்சூழலுடன் கூடிய கவர்ச்சிகரமான ஊதியம் மற்றும் தொழில் வளர்ச்சிக்கான சிறந்த வாய்ப்புகள் சரியான விண்ணப்பதாரருக்கு வழங்கப்படுகின்றன.";

/** `label value`, or null (line left out) when there's no value. */
function field(label: string, value: string): string | null {
  return value ? `${label} ${value}` : null;
}

function bullets(bullet: string, items: string[]): string[] {
  return items.map((item) => `${bullet} ${item}`);
}

/** Consecutive lines; null when none are left. */
function lines(...all: (string | null)[]): string | null {
  const kept = all.filter((line): line is string => !!line);
  return kept.length ? kept.join("\n") : null;
}

/** A heading, a blank line, then its lines; left out entirely when there are no lines. */
function section(heading: string, body: (string | null)[]): string | null {
  const content = lines(...body);
  return content ? `${heading}\n\n${content}` : null;
}

function englishGeneral(d: DescriptionDetails): (string | null)[] {
  return [
    field("# 💼 𝐏𝐎𝐒𝐈𝐓𝐈𝐎𝐍 :", d.position),
    section("# 💠 𝐂𝐀𝐍𝐃𝐈𝐃𝐀𝐓𝐄 𝐑𝐄𝐐𝐔𝐈𝐑𝐄𝐌𝐄𝐍𝐓𝐒 :", bullets(BULLET, [...d.qualifications, ...d.requirements])),
    section("# 💠 𝐑𝐄𝐒𝐏𝐎𝐍𝐒𝐈𝐁𝐈𝐋𝐈𝐓𝐈𝐄𝐒 :", bullets(BULLET, d.responsibilities)),
    section("# ✅ 𝐁𝐄𝐍𝐄𝐅𝐈𝐓𝐒 :", [ENGLISH_BENEFITS, ...bullets(BULLET, d.benefits)]),
    section("# ✅ 𝐇𝐎𝐖 𝐓𝐎 𝐀𝐏𝐏𝐋𝐘 ✍️ :", [
      `If you feel you are the right individual for the above position, then apply via "𝗔𝗽𝗽𝗹𝘆 𝗡𝗼𝘄 " of this advert.`,
    ]),
    `[ 𝐖𝐄 𝐇𝐈𝐆𝐇𝐋𝐘 𝐈𝐍𝐅𝐎𝐑𝐌 𝐀𝐋𝐋 𝐓𝐇𝐄 𝐂𝐀𝐍𝐃𝐈𝐃𝐀𝐓𝐄𝐒 𝐓𝐎 𝐌𝐄𝐍𝐓𝐈𝐎𝐍 𝐀 𝐕𝐀𝐋𝐈𝐃 𝐌𝐎𝐁𝐈𝐋𝐄 𝐍𝐔𝐌𝐁𝐄𝐑 & 𝐈𝐓 𝐈𝐒 𝐂𝐎𝐌𝐏𝐔𝐋𝐒𝐎𝐑𝐘 𝐓𝐎 𝐀𝐓𝐓𝐀𝐂𝐇 𝐘𝐎𝐔𝐑 𝐂𝐕 𝐁𝐘 𝐔𝐏𝐃𝐀𝐓𝐈𝐍𝐆 𝐘𝐎𝐔𝐑 "𝗜𝗞𝗠𝗔𝗡 𝗥𝗘𝗦𝗨𝗠𝗘" ]`,
    lines(
      field("＃📳 📞 𝓒𝓸𝓷𝓽𝓪𝓬𝓽  | 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩 :", d.contactPhone),
      field("＃ 📧 𝐸𝓂𝒶𝒾𝓁 :", d.email),
      field("# 🌐 𝓦𝓮𝓫 :", d.website),
      field("# 📪 𝓐𝓭𝓭𝓻𝓮𝓼𝓼 :", d.address)
    ),
  ];
}

function englishWalkIn(d: DescriptionDetails): (string | null)[] {
  return [
    field("# 💼 𝐏𝐎𝐒𝐈𝐓𝐈𝐎𝐍 :", d.position),
    section("# 💠 𝐂𝐀𝐍𝐃𝐈𝐃𝐀𝐓𝐄 𝐑𝐄𝐐𝐔𝐈𝐑𝐄𝐌𝐄𝐍𝐓𝐒 :", bullets(BULLET, d.requirements)),
    section("# 💠 Qualifications :", bullets(BULLET, d.qualifications)),
    section("# ✅ 𝐁𝐄𝐍𝐄𝐅𝐈𝐓𝐒 :", [ENGLISH_BENEFITS, ...bullets(BULLET, d.benefits)]),
    section("# ✅ 𝐇𝐎𝐖 𝐓𝐎 𝐀𝐏𝐏𝐋𝐘 ✍️ :", [
      "# If you are the most suitable person for the above position, please visit the below mentioned location for 𝐖𝐀𝐋𝐊 - 𝐈𝐍 𝐈𝐍𝐓𝐄𝐑𝐕𝐈𝐄𝐖𝐒.#",
    ]),
    lines(
      field("# ✅ 📅 Date of Interview 📅 :", d.interviewDate),
      field("# ✅ ⌚ Interview Timings ⌚:", d.interviewTime),
      field("# ✅ 📌 Interview Location📌 :", d.interviewLocation),
      field("# ✅ 📪  Interview Location Address 📪 :", d.interviewAddress)
    ),
    lines(
      field("＃📳 📞 𝓒𝓸𝓷𝓽𝓪𝓬𝓽 :", d.contactPhone),
      field("＃ 📧 𝐸𝓂𝒶𝒾𝓁 :", d.email),
      field("# 🌐 𝓦𝓮𝓫 :", d.website),
      field("# 📪 𝓐𝓭𝓭𝓻𝓮𝓼𝓼 :", d.address)
    ),
  ];
}

function sinhalaGeneral(d: DescriptionDetails): (string | null)[] {
  return [
    field("# 💼 𝐏𝐎𝐒𝐈𝐓𝐈𝐎𝐍 | තනතුර :", d.position),
    section("# 💠 𝗞𝗲𝘆 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗶𝗯𝗶𝗹𝗶𝘁𝗶𝗲𝘀 | රැකියාවේ කාර්ය භාරය :", bullets(BULLET, d.responsibilities)),
    section("# 💠 𝐑𝐄𝐐𝐔𝐈𝐑𝐄𝐌𝐄𝐍𝐓𝐒 | සුදුසුකම් :", bullets(BULLET, [...d.qualifications, ...d.requirements])),
    section("# ✅ 𝐁𝐄𝐍𝐄𝐅𝐈𝐓𝐒 | වරප්‍රසාද :", [SINHALA_BENEFITS, ...bullets(BULLET, d.benefits)]),
    section("# ✅ 𝐇𝐎𝐖 𝐓𝐎 𝐀𝐏𝐏𝐋𝐘 | අයදුම් කලයුතු ආකාරය ✍️ :", [
      `ඉහත තනතුර සඳහා සුදුසූම පුද්ගලයා  ඔබ නම්, මෙම දැන්වීමේ "Apply for this job" හරහා  හෝ  පහත සඳහන් දුරකථන අංකය හරහා  අයදුම් කරන්න.`,
    ]),
    lines(
      field("＃📳 📞 𝓒𝓸𝓷𝓽𝓪𝓬𝓽  | දුරකථන අංකය :", d.contactPhone),
      field("＃ 📧 𝐸𝓂𝒶𝒾𝓁 | ඊ-මේල් ලිපිනය :", d.email),
      field("# 📪 𝓐𝓭𝓭𝓻𝓮𝓼𝓼  | ලිපිනය :", d.address)
    ),
  ];
}

function sinhalaWalkIn(d: DescriptionDetails): (string | null)[] {
  // This template has a single interview-place line, so the venue and its address share it.
  const interviewPlace = [d.interviewLocation, d.interviewAddress].filter(Boolean).join(", ");
  return [
    WALK_IN_BANNER,
    lines(
      field("# 💼 තනතුර :", d.position),
      "------------------------------------------------------------------------"
    ),
    section("# 💠 සුදුසුකම් :", bullets(BULLET, [...d.qualifications, ...d.requirements])),
    section("# 💠 රැකියාවේ කාර්ය භාරය :", bullets(BULLET, d.responsibilities)),
    section("# ✅ ප්‍රතිලාභ :", [SINHALA_BENEFITS, ...bullets(BULLET, d.benefits)]),
    section("# ✅ අයදුම් කළ යුතු ආකාරය :", [
      "# ඉහත තනතුර සඳහා සුදුසූම පුද්ගලයා ඔබ නම්, බඳවා ගැනීමේ සම්මුඛ පරීක්‍ෂණ සඳහා පහත සදහන් ස්ථානයට පැමිණෙන්න. #",
    ]),
    lines(
      field("# ✅ 📅 සම්මුඛ පරීක්‍ෂණ පැවැත්වෙන දිනය 📅 :", d.interviewDate),
      field("# ✅ ⌚ සම්මුඛ පරීක්‍ෂණ පැවැත්වෙන වේලාව ⌚:", d.interviewTime),
      field("# ✅ 📌 සම්මුඛ පරීක්‍ෂණය පැවැත්වෙන ස්ථානය 📌 :", interviewPlace)
    ),
    `වැඩි විස්තර දැනගැනීම සඳහා මෙම දැන්වීමේ "𝐂𝐚𝐥𝐥 𝐄𝐦𝐩𝐥𝐨𝐲𝐞𝐫 | සේවායෝජකයා අමතන්න " හි සඳහන් දුරකථන අංකය හරහා විමසන්න.`,
  ];
}

function tamilGeneral(d: DescriptionDetails): (string | null)[] {
  return [
    field("# 💼 𝐏𝐎𝐒𝐈𝐓𝐈𝐎𝐍 | பதவி :", d.position),
    section("# 💠 𝐑𝐄𝐐𝐔𝐈𝐑𝐄𝐌𝐄𝐍𝐓𝐒 (Qualifications) | தகுதிகள் :", bullets(TAMIL_BULLET, [...d.qualifications, ...d.requirements])),
    // This template has no standard benefits sentence; it's borrowed from the walk-in one when
    // the poster lists no benefits, so the section is never empty.
    section("# ✅ 𝐁𝐄𝐍𝐄𝐅𝐈𝐓𝐒 | பலன்கள் :", d.benefits.length ? bullets(TAMIL_BULLET, d.benefits) : [TAMIL_BENEFITS]),
    section("# 💠 RESPONSIBILITIES | பொறுப்புகள் :", bullets(TAMIL_BULLET, d.responsibilities)),
    section("# ✅ 𝐇𝐎𝐖 𝐓𝐎 𝐀𝐏𝐏𝐋𝐘 | எப்படி விண்ணப்பிப்பது ✍️ :", [
      `மேலும் தகவலை அறிய, இந்த விளம்பரத்தில் குறிப்பிடப்பட்டுள்ள தொலைபேசி எண்ணின் மூலம் "𝐂𝐚𝐥𝐥 𝐄𝐦𝐩𝐥𝐨𝐲𝐞𝐫 | வேலை வழங்குநரைத் தொடர்புகொள்ளவும்".`,
    ]),
    lines(
      field("＃📳 📞 𝓒𝓸𝓷𝓽𝓪𝓬𝓽  | தொடர்பு எண் :", d.contactPhone),
      field("＃ 📧 𝐸𝓂𝒶𝒾𝓁  | மின்னஞ்சல் முகவரி :", d.email)
    ),
  ];
}

function tamilWalkIn(d: DescriptionDetails): (string | null)[] {
  const contact = [
    field("# 📪 𝓐𝓭𝓭𝓻𝓮𝓼𝓼  | முகவரி :", d.address),
    field("＃📳 📞 𝓒𝓸𝓷𝓽𝓪𝓬𝓽 | தொடர்பு:", d.contactPhone),
    field("＃ 📧 𝐸𝓂𝒶𝒾𝓁 | மின்னஞ்சல்:", d.email),
    field("# 🌐 𝓦𝓮𝓫 | இணையம்:", d.website),
  ];
  return [
    WALK_IN_BANNER,
    field("# 💼 𝐏𝐎𝐒𝐈𝐓𝐈𝐎𝐍 | பதவி :", d.position),
    section("# 💠 𝐑𝐄𝐐𝐔𝐈𝐑𝐄𝐌𝐄𝐍𝐓𝐒 (Qualifications) | தகுதிகள் :", bullets(TAMIL_BULLET, [...d.qualifications, ...d.requirements])),
    section("# 💠 𝐑𝐄𝐒𝐏𝐎𝐍𝐒𝐈𝐁𝐈𝐋𝐈𝐓𝐈𝐄𝐒  | பொறுப்புகள் :", bullets(TAMIL_BULLET, d.responsibilities)),
    section("# ✅ 𝐁𝐄𝐍𝐄𝐅𝐈𝐓𝐒 | பலன்கள் :", [TAMIL_BENEFITS, ...bullets(TAMIL_BULLET, d.benefits)]),
    section("# ✅ 𝐇𝐎𝐖 𝐓𝐎 𝐀𝐏𝐏𝐋𝐘 | எப்படி விண்ணப்பிப்பது ✍️ :", [
      "# நீங்கள் மேற்கூறிய பதவிக்கு மிகவும் பொருத்தமான நபராக இருந்தால், கீழே குறிப்பிடப்பட்டுள்ள இடத்திற்குச் செல்லவும்.",
    ]),
    lines(
      field("# ✅ 📅 Date of Interview | நேர்காணல் தேதி 📅 :", d.interviewDate),
      field("# ✅ ⌚  Interview Timings | நேர்காணல் நேரங்கள் ⌚:", d.interviewTime),
      field("#✅ 📌  Interview Location | நேர்காணல் இடம்📌 :", d.interviewLocation),
      field("# ✅ 📪 Interview Location Address | நேர்காணல் நடைபெறும் இடம் முகவரி 📪 :", d.interviewAddress)
    ),
    contact.some(Boolean) ? lines("# மேலும் தகவலுக்கு; எங்களை தொடர்பு கொள்ள தயங்க.", ...contact) : null,
  ];
}

const TEMPLATES: Record<DescriptionLanguage, { general: typeof englishGeneral; walkIn: typeof englishGeneral }> = {
  English: { general: englishGeneral, walkIn: englishWalkIn },
  Sinhala: { general: sinhalaGeneral, walkIn: sinhalaWalkIn },
  Tamil: { general: tamilGeneral, walkIn: tamilWalkIn },
};

/** Renders the description template for the poster's language and kind (general / walk-in interview). */
export function buildJobDescription(details: DescriptionDetails): string {
  const template = TEMPLATES[details.language];
  const blocks = details.walkInInterview ? template.walkIn(details) : template.general(details);
  return blocks.filter((block): block is string => !!block).join("\n\n");
}

/** Case-insensitive match against the template languages, returning the canonical spelling. */
export function matchDescriptionLanguage(input: unknown): DescriptionLanguage | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  return DESCRIPTION_LANGUAGES.find((language) => language.toLowerCase() === trimmed) ?? null;
}
