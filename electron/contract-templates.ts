/**
 * Hungarian contract templates for freelancers.
 * Templates are based on Hungarian civil law (Ptk.) — these are starting-point
 * templates, NOT legal advice. Users should have them reviewed by a lawyer.
 */

/** Format a numeric string with Hungarian thousand separators (space) */
function fmtNum(val: string | undefined): string {
  if (!val) return '';
  const n = Number(val.replace(/\D/g, ''));
  return isNaN(n) ? val : n.toLocaleString('hu-HU');
}

export interface ContractField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  suffix?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  /** Extra fields the user fills in beyond auto-populated client/user data */
  fields: ContractField[];
}

export interface ContractData {
  // Freelancer (user) info
  userName: string;
  userCompany: string;
  userAddress: string;
  userTaxNumber: string;
  userBankAccount: string;
  userEmail: string;
  userPhone: string;
  // Client info
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  clientTaxNumber: string;
  clientRepresentative: string;
  clientEmail: string;
  clientPhone: string;
  // Template-specific fields
  fields: Record<string, string>;
  // Meta
  contractDate: string;   // YYYY-MM-DD
  contractPlace: string;
}

// ────────────────────────────────────────────────────────────
// Line types for structured PDF rendering
// ────────────────────────────────────────────────────────────

export type LineType =
  | 'title'
  | 'subtitle'
  | 'preamble'
  | 'party-label'
  | 'party-field'
  | 'section-heading'
  | 'clause'
  | 'sub-item'
  | 'body'
  | 'separator'
  | 'signing-date'
  | 'signature-block'
  | 'gap'
  | 'user-text';

export interface ContractLine {
  type: LineType;
  text: string;
}

// ────── Template definitions ──────

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'megbizasi',
    name: 'Megbízási szerződés',
    description: 'Szolgáltatás nyújtására vonatkozó szerződés (Ptk. 6:272-6:280 §)',
    fields: [
      { key: 'subject', label: 'Megbízás tárgya', type: 'textarea', required: true, placeholder: 'pl. Weboldal tervezése és fejlesztése' },
      { key: 'fee', label: 'Megbízási díj', type: 'text', required: true, placeholder: 'pl. 500 000', suffix: 'Ft' },
      { key: 'paymentDeadline', label: 'Fizetési határidő (nap)', type: 'text', required: true, placeholder: 'pl. 15', defaultValue: '15' },
      { key: 'startDate', label: 'Kezdő dátum', type: 'date', required: true },
      { key: 'endDate', label: 'Befejezési határidő', type: 'date', required: true },
      { key: 'reportFrequency', label: 'Tájékoztatási gyakoriság', type: 'text', required: false, placeholder: 'pl. kéthetente', defaultValue: 'kéthetente' },
      { key: 'noticePeriod', label: 'Felmondási idő (nap)', type: 'text', required: false, placeholder: 'pl. 15', defaultValue: '15' },
      { key: 'place', label: 'Kelt (helyszín)', type: 'text', required: true, placeholder: 'pl. Budapest' },
    ],
  },
  {
    id: 'vallalkozasi',
    name: 'Vállalkozási szerződés',
    description: 'Eredménykötelem — konkrét mű vagy termék létrehozása (Ptk. 6:238-6:250 §)',
    fields: [
      { key: 'subject', label: 'Vállalkozás tárgya', type: 'textarea', required: true, placeholder: 'pl. Mobilalkalmazás fejlesztése iOS és Android platformra' },
      { key: 'deliverables', label: 'Átadandó eredmények', type: 'textarea', required: true, placeholder: 'pl. Forráskód, dokumentáció, tesztek' },
      { key: 'milestones', label: 'Mérföldkövek (opcionális)', type: 'textarea', required: false, placeholder: 'pl. 1. Design — 04.30., 2. Frontend — 05.31.' },
      { key: 'fee', label: 'Vállalkozási díj', type: 'text', required: true, placeholder: 'pl. 1 500 000', suffix: 'Ft' },
      { key: 'advancePayment', label: 'Előleg (opcionális)', type: 'text', required: false, placeholder: 'pl. 500 000', suffix: 'Ft' },
      { key: 'paymentDeadline', label: 'Fizetési határidő (nap)', type: 'text', required: true, placeholder: 'pl. 15', defaultValue: '15' },
      { key: 'startDate', label: 'Kezdő dátum', type: 'date', required: true },
      { key: 'deadline', label: 'Teljesítési határidő', type: 'date', required: true },
      { key: 'acceptanceDays', label: 'Átvételi határidő (munkanap)', type: 'text', required: false, placeholder: 'pl. 8', defaultValue: '8' },
      { key: 'bugfixDays', label: 'Hibajavítási határidő (munkanap)', type: 'text', required: false, placeholder: 'pl. 10', defaultValue: '10' },
      { key: 'warrantyMonths', label: 'Jótállás időtartama', type: 'text', required: false, placeholder: 'pl. 6 hónap', defaultValue: '6 hónap' },
      { key: 'place', label: 'Kelt (helyszín)', type: 'text', required: true, placeholder: 'pl. Budapest' },
    ],
  },
  {
    id: 'nda',
    name: 'Titoktartási megállapodás (NDA)',
    description: 'Bizalmas információk védelmére vonatkozó megállapodás',
    fields: [
      { key: 'purpose', label: 'Felhasználás célja', type: 'textarea', required: true, placeholder: 'pl. Webfejlesztési projekt megvalósítása' },
      { key: 'confidentialInfo', label: 'Bizalmas információ meghatározása', type: 'textarea', required: true, placeholder: 'pl. Üzleti tervek, forráskódok, ügyféllisták, pénzügyi adatok' },
      { key: 'durationYears', label: 'Titoktartás időtartama', type: 'text', required: true, placeholder: 'pl. 3 év', defaultValue: '3 év' },
      { key: 'penaltyAmount', label: 'Kötbér összege', type: 'text', required: false, placeholder: 'pl. 2 000 000', suffix: 'Ft' },
      { key: 'place', label: 'Kelt (helyszín)', type: 'text', required: true, placeholder: 'pl. Budapest' },
    ],
  },
];

// ────── Helpers ──────

function formatDate(dateStr: string): string {
  if (!dateStr) return '_______________';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
}

function L(type: LineType, text: string): ContractLine {
  return { type, text };
}

function gap(): ContractLine {
  return L('gap', '');
}

function partyBlock(role: string, name: string, company: string, address: string, taxNumber: string, representative: string, email: string, phone: string, bankAccount?: string): ContractLine[] {
  const lines: ContractLine[] = [];
  lines.push(L('party-label', `${role}:`));
  if (company) lines.push(L('party-field', `Név / Cégnév: ${company}`));
  else lines.push(L('party-field', `Név / Cégnév: ${name}`));
  if (address) lines.push(L('party-field', `Székhely / Lakcím: ${address}`));
  if (taxNumber) lines.push(L('party-field', `Adószám: ${taxNumber}`));
  if (representative) lines.push(L('party-field', `Képviselő neve: ${representative}`));
  if (email) lines.push(L('party-field', `E-mail: ${email}`));
  if (phone) lines.push(L('party-field', `Telefonszám: ${phone}`));
  if (bankAccount) lines.push(L('party-field', `Bankszámlaszám: ${bankAccount}`));
  return lines;
}

// ────── MEGBÍZÁSI SZERZŐDÉS ──────

export function generateMegbizasi(data: ContractData): ContractLine[] {
  const f = data.fields;
  const lines: ContractLine[] = [];

  lines.push(L('title', 'MEGBÍZÁSI SZERZŐDÉS'));
  lines.push(gap());
  lines.push(L('preamble', 'amely létrejött egyrészről'));
  lines.push(gap());
  lines.push(...partyBlock('Megbízó', data.clientName, data.clientCompany, data.clientAddress, data.clientTaxNumber, data.clientRepresentative, data.clientEmail, data.clientPhone));
  lines.push(gap());
  lines.push(L('preamble', 'másrészről'));
  lines.push(gap());
  lines.push(...partyBlock('Megbízott', data.userName, data.userCompany, data.userAddress, data.userTaxNumber, '', data.userEmail, data.userPhone, data.userBankAccount));
  lines.push(gap());
  lines.push(L('preamble', '(a továbbiakban együttesen: Felek) között az alulírott helyen és napon, az alábbi feltételekkel:'));
  lines.push(gap());
  lines.push(L('separator', ''));

  // 1. Tárgy
  lines.push(L('section-heading', '1. A MEGBÍZÁS TÁRGYA'));
  lines.push(gap());
  lines.push(L('clause', '1.1. A Megbízó megbízza a Megbízottat az alábbi feladat(ok) elvégzésével:'));
  lines.push(L('user-text', f.subject || '_______________'));
  lines.push(gap());
  lines.push(L('clause', '1.2. A Megbízott a megbízást a Megbízó utasításai szerint, a tőle elvárható szakmai gondossággal, a vonatkozó jogszabályok és szakmai standardok betartásával köteles ellátni.'));
  lines.push(gap());
  lines.push(L('clause', '1.3. A Megbízott a megbízást személyesen köteles ellátni. Alvállalkozó vagy közreműködő igénybevételéhez a Megbízó előzetes írásbeli hozzájárulása szükséges. Az alvállalkozó tevékenységéért a Megbízott úgy felel, mintha a munkát maga végezte volna.'));
  lines.push(gap());

  // 2. Időtartam
  lines.push(L('section-heading', '2. A MEGBÍZÁS IDŐTARTAMA'));
  lines.push(gap());
  lines.push(L('clause', `2.1. A jelen szerződés hatályba lép: ${formatDate(f.startDate)}.`));
  lines.push(L('clause', `2.2. A megbízás teljesítési határideje: ${formatDate(f.endDate)}.`));
  lines.push(L('clause', '2.3. A szerződés a teljesítéssel, a határidő lejártával, vagy a 7. pont szerinti felmondással szűnik meg.'));
  lines.push(gap());

  // 3. Díj
  lines.push(L('section-heading', '3. MEGBÍZÁSI DÍJ ÉS FIZETÉSI FELTÉTELEK'));
  lines.push(gap());
  lines.push(L('clause', `3.1. A Megbízó a megbízás teljesítéséért ${fmtNum(f.fee) || '_______________'} Ft + ÁFA összeget fizet a Megbízottnak. (Amennyiben a Megbízott alanyi adómentes, a díj ÁFA-t nem tartalmaz.)`));
  lines.push(L('clause', `3.2. A díj fizetése a Megbízott által kiállított számla alapján, annak kézhezvételétől számított ${f.paymentDeadline || '15'} napon belül, banki átutalással történik a Megbízott bankszámlájára.`));
  if (data.userBankAccount) {
    lines.push(L('clause', `3.3. A Megbízott bankszámlaszáma: ${data.userBankAccount}.`));
  }
  lines.push(L('clause', '3.4. Fizetési késedelem esetén a Megbízó a Polgári Törvénykönyv szerinti késedelmi kamatot köteles megfizetni.'));
  lines.push(L('clause', '3.5. A Megbízó a számla ellen annak kézhezvételétől számított 5 munkanapon belül élhet kifogással. Kifogás hiányában a számla elfogadottnak tekintendő.'));
  lines.push(gap());

  // 4. Jogok és kötelezettségek
  lines.push(L('section-heading', '4. A FELEK JOGAI ÉS KÖTELEZETTSÉGEI'));
  lines.push(gap());
  lines.push(L('clause', '4.1. A Megbízott köteles:'));
  lines.push(L('sub-item', 'a) a megbízást a szerződésben foglaltak szerint, szakszerűen és határidőben ellátni;'));
  lines.push(L('sub-item', `b) a megbízás előrehaladásáról a Megbízót rendszeresen, de legalább ${f.reportFrequency || 'kéthetente'} tájékoztatni;`));
  lines.push(L('sub-item', 'c) a Megbízó utasításait követni, kivéve, ha az utasítás jogszabályba ütközik vagy a megbízás eredményes teljesítését veszélyezteti — erről a Megbízót haladéktalanul értesíteni köteles;'));
  lines.push(L('sub-item', 'd) a megbízás során tudomására jutott üzleti titkokat és bizalmas információkat a szerződés időtartama alatt és annak megszűnését követően is megőrizni.'));
  lines.push(gap());
  lines.push(L('clause', '4.2. A Megbízó köteles:'));
  lines.push(L('sub-item', 'a) a megbízás teljesítéséhez szükséges adatokat, információkat, hozzáféréseket és egyéb feltételeket határidőben biztosítani;'));
  lines.push(L('sub-item', 'b) a megbízási díjat a jelen szerződés szerint határidőben megfizetni;'));
  lines.push(L('sub-item', 'c) a Megbízott munkáját a szükséges mértékben segíteni és az együttműködési kötelezettségének eleget tenni.'));
  lines.push(gap());
  lines.push(L('clause', '4.3. Amennyiben a Megbízó a szükséges közreműködést nem biztosítja, és emiatt a teljesítés késedelmet szenved, a Megbízott a késedelemmel érintett időszakra mentesül a teljesítési határidő alól.'));
  lines.push(gap());

  // 5. Szellemi tulajdon
  lines.push(L('section-heading', '5. SZELLEMI TULAJDON'));
  lines.push(gap());
  lines.push(L('clause', '5.1. A megbízás teljesítése során keletkező szellemi alkotások (ideértve különösen a szerzői műveket, forráskódot, grafikai elemeket, dokumentációt) feletti vagyoni jogok a megbízási díj teljes megfizetését követően a Megbízóra szállnak át, a Szerzői jogról szóló 1999. évi LXXVI. törvény rendelkezéseivel összhangban.'));
  lines.push(L('clause', '5.2. A díj teljes megfizetéséig a szellemi alkotások feletti vagyoni jogok a Megbízottnál maradnak.'));
  lines.push(L('clause', '5.3. A Megbízott a referencia célú felhasználás jogát fenntartja: jogosult a létrehozott mű tényét és általános leírását portfóliójában, weboldalán és marketing anyagaiban feltüntetni, a Megbízó bizalmas üzleti információinak közlése nélkül.'));
  lines.push(gap());

  // 6. Titoktartás
  lines.push(L('section-heading', '6. TITOKTARTÁS'));
  lines.push(gap());
  lines.push(L('clause', '6.1. A Felek kötelezettséget vállalnak arra, hogy a jelen szerződés teljesítése során egymás tudomására jutott üzleti titkokat, bizalmas információkat és személyes adatokat bizalmasan kezelik, harmadik személynek nem adják ki.'));
  lines.push(L('clause', '6.2. A titoktartási kötelezettség a szerződés megszűnését követően is hatályban marad, időbeli korlátozás nélkül — az üzleti titokról szóló 2018. évi LIV. törvény rendelkezéseivel összhangban.'));
  lines.push(L('clause', '6.3. Nem minősül titoktartási kötelezettség megsértésének, ha a Fél az információt jogszabályi kötelezettség alapján, hatóság vagy bíróság felhívására köteles közölni.'));
  lines.push(gap());

  // 7. Felmondás
  lines.push(L('section-heading', '7. FELMONDÁS'));
  lines.push(gap());
  lines.push(L('clause', '7.1. A Megbízó a szerződést bármikor, indokolás nélkül felmondhatja. Ebben az esetben köteles a Megbízottnak az elvégzett munkával arányos díjazást megfizetni, valamint a felmondással okozott kárt megtéríteni.'));
  lines.push(L('clause', `7.2. A Megbízott a szerződést ${f.noticePeriod || '15'} napos határidővel, írásban mondhatja fel. A felmondási idő alatt a Megbízott köteles a megbízást folytatni és az átadás-átvételt biztosítani.`));
  lines.push(L('clause', '7.3. Súlyos szerződésszegés esetén bármelyik Fél jogosult a szerződést azonnali hatállyal, írásban felmondani. Súlyos szerződésszegésnek minősül különösen: a fizetési kötelezettség 30 napot meghaladó késedelme, a titoktartási kötelezettség megsértése, vagy bármelyik Fél elleni felszámolási vagy csődeljárás megindítása.'));
  lines.push(gap());

  // 8. Felelősség
  lines.push(L('section-heading', '8. FELELŐSSÉG'));
  lines.push(gap());
  lines.push(L('clause', '8.1. A Megbízott a megbízás teljesítése során a tőle elvárható gondossággal köteles eljárni. A Megbízott felelőssége a jelen szerződés alapján összesen legfeljebb a megbízási díj összegéig terjed.'));
  lines.push(L('clause', '8.2. A Megbízott nem felel az olyan károkért, amelyek a Megbízó által szolgáltatott hibás vagy hiányos adatokból, utasításokból, vagy a Megbízó együttműködési kötelezettségének elmulasztásából erednek.'));
  lines.push(L('clause', '8.3. A Megbízott nem felel az elmaradt haszonért vagy közvetett károkért.'));
  lines.push(gap());

  // 9. GDPR
  lines.push(L('section-heading', '9. ADATKEZELÉS (GDPR)'));
  lines.push(gap());
  lines.push(L('clause', '9.1. A Felek a jelen szerződés teljesítése során egymás kapcsolattartóinak személyes adatait (név, e-mail, telefon) kizárólag a szerződés teljesítése céljából, a szerződés időtartama alatt és az elévülési idő lejártáig kezelik, az Európai Parlament és a Tanács (EU) 2016/679 rendeletének (GDPR) és az információs önrendelkezési jogról szóló 2011. évi CXII. törvény rendelkezéseinek megfelelően.'));
  lines.push(L('clause', '9.2. Amennyiben a megbízás teljesítése során a Megbízott a Megbízó ügyfelei vagy partnerei személyes adataihoz fér hozzá, a Felek külön adatfeldolgozási megállapodást (DPA) kötnek.'));
  lines.push(gap());

  // 10. Vis maior
  lines.push(L('section-heading', '10. VIS MAIOR (FORCE MAJEURE)'));
  lines.push(gap());
  lines.push(L('clause', '10.1. Egyik Fél sem felel a jelen szerződésben foglalt kötelezettségei teljesítésének késedelméért vagy elmulasztásáért, ha azt vis maior esemény okozza (természeti katasztrófa, járvány, háború, szankciók, hatósági intézkedések, kibertámadás).'));
  lines.push(L('clause', '10.2. A vis maior eseményt az érintett Fél haladéktalanul, de legkésőbb 5 munkanapon belül írásban köteles a másik Félnek bejelenteni. A vis maior időtartamával a teljesítési határidő meghosszabbodik.'));
  lines.push(L('clause', '10.3. Amennyiben a vis maior esemény 60 napot meghaladóan fennáll, bármelyik Fél jogosult a szerződést írásban, azonnali hatállyal felmondani.'));
  lines.push(gap());

  // 11. Értesítések
  lines.push(L('section-heading', '11. ÉRTESÍTÉSEK'));
  lines.push(gap());
  lines.push(L('clause', '11.1. A jelen szerződéssel kapcsolatos értesítések érvényesen a másik Fél jelen szerződésben megadott e-mail címére küldött elektronikus levél útján tehetők meg. Az értesítés az elküldést követő második munkanapon tekintendő kézbesítettnek.'));
  lines.push(L('clause', '11.2. Azonnali hatályú felmondás vagy jogi jelentőségű nyilatkozat esetén az értesítést ajánlott, tértivevényes postai küldeményként is meg kell küldeni.'));
  lines.push(gap());

  // 12. Záró
  lines.push(L('section-heading', '12. ZÁRÓ RENDELKEZÉSEK'));
  lines.push(gap());
  lines.push(L('clause', '12.1. A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény (különösen a megbízási szerződésre vonatkozó 6:272–6:280. §), valamint a vonatkozó egyéb jogszabályok rendelkezései az irányadók.'));
  lines.push(L('clause', '12.2. A Felek a jelen szerződésből eredő vitáikat elsősorban közvetlen tárgyalásos úton kísérlik meg rendezni.'));
  lines.push(L('clause', '12.3. A jelen szerződés a Felek teljes megállapodását tartalmazza a szerződés tárgyát illetően, és hatályon kívül helyez minden korábbi, a tárgyra vonatkozó szóbeli vagy írásbeli megállapodást.'));
  lines.push(L('clause', '12.4. A jelen szerződés módosítása kizárólag írásban, mindkét Fél aláírásával érvényes.'));
  lines.push(L('clause', '12.5. Amennyiben a jelen szerződés bármely rendelkezése érvénytelennek vagy végrehajthatatlannak bizonyul, az nem érinti a szerződés többi rendelkezésének érvényességét.'));
  lines.push(L('clause', '12.6. A jelen szerződés 2 (kettő) eredeti példányban készült, amelyet a Felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag írtak alá.'));
  lines.push(gap());

  // Signature
  lines.push(L('separator', ''));
  lines.push(gap());
  lines.push(L('signing-date', `Kelt: ${f.place || '_______________'}, ${formatDate(data.contractDate)}`));
  lines.push(gap());
  lines.push(gap());
  lines.push(L('signature-block', 'Megbízó|Megbízott'));

  return lines;
}

// ────── VÁLLALKOZÁSI SZERZŐDÉS ──────

export function generateVallalkozasi(data: ContractData): ContractLine[] {
  const f = data.fields;
  const lines: ContractLine[] = [];

  lines.push(L('title', 'VÁLLALKOZÁSI SZERZŐDÉS'));
  lines.push(gap());
  lines.push(L('preamble', 'amely létrejött egyrészről'));
  lines.push(gap());
  lines.push(...partyBlock('Megrendelő', data.clientName, data.clientCompany, data.clientAddress, data.clientTaxNumber, data.clientRepresentative, data.clientEmail, data.clientPhone));
  lines.push(gap());
  lines.push(L('preamble', 'másrészről'));
  lines.push(gap());
  lines.push(...partyBlock('Vállalkozó', data.userName, data.userCompany, data.userAddress, data.userTaxNumber, '', data.userEmail, data.userPhone, data.userBankAccount));
  lines.push(gap());
  lines.push(L('preamble', '(a továbbiakban együttesen: Felek) között az alulírott helyen és napon, az alábbi feltételekkel:'));
  lines.push(gap());
  lines.push(L('separator', ''));

  // 1. Tárgy
  lines.push(L('section-heading', '1. A VÁLLALKOZÁS TÁRGYA'));
  lines.push(gap());
  lines.push(L('clause', '1.1. A Megrendelő megrendeli, a Vállalkozó elvállalja az alábbi mű / eredmény létrehozását:'));
  lines.push(L('user-text', f.subject || '_______________'));
  lines.push(gap());
  lines.push(L('clause', '1.2. Átadandó eredmények (deliverables):'));
  lines.push(L('user-text', f.deliverables || '_______________'));
  lines.push(gap());
  lines.push(L('clause', '1.3. A Vállalkozó a munkát a vonatkozó jogszabályok, szakmai standardok és a jelen szerződésben foglalt specifikáció szerint köteles elvégezni.'));
  lines.push(gap());

  // 2. Határidő
  lines.push(L('section-heading', '2. TELJESÍTÉSI HATÁRIDŐ ÉS MÉRFÖLDKÖVEK'));
  lines.push(gap());
  lines.push(L('clause', `2.1. A szerződés hatályba lép: ${formatDate(f.startDate)}.`));
  lines.push(L('clause', `2.2. A teljesítési (átadási) határidő: ${formatDate(f.deadline)}.`));
  lines.push(L('clause', '2.3. A Vállalkozó jogosult a határidő előtt is teljesíteni, erről a Megrendelőt legalább 5 munkanappal előre értesíteni köteles.'));
  if (f.milestones) {
    lines.push(L('clause', '2.4. A Felek az alábbi mérföldköveket határozták meg:'));
    lines.push(L('user-text', f.milestones));
  }
  lines.push(L('clause', `2.${f.milestones ? '5' : '4'}. Amennyiben a Megrendelő a szükséges közreműködést nem biztosítja határidőben, a teljesítési határidő a késedelem időtartamával meghosszabbodik.`));
  lines.push(gap());

  // 3. Díj
  lines.push(L('section-heading', '3. VÁLLALKOZÁSI DÍJ ÉS FIZETÉSI FELTÉTELEK'));
  lines.push(gap());
  lines.push(L('clause', `3.1. A Megrendelő a vállalkozás teljesítéséért ${fmtNum(f.fee) || '_______________'} Ft + ÁFA összeget fizet a Vállalkozónak. (Amennyiben a Vállalkozó alanyi adómentes, a díj ÁFA-t nem tartalmaz.)`));
  if (f.advancePayment) {
    lines.push(L('clause', `3.2. A Megrendelő a szerződés aláírásakor ${fmtNum(f.advancePayment)} Ft + ÁFA előleget fizet. Az előleg a végszámlába beszámít.`));
  }
  const feeIdx = f.advancePayment ? 3 : 2;
  lines.push(L('clause', `3.${feeIdx}. A fennmaradó összeg az átadás-átvételi jegyzőkönyv aláírását követően, a Vállalkozó által kiállított számla alapján, ${f.paymentDeadline || '15'} napon belül fizetendő banki átutalással.`));
  if (data.userBankAccount) {
    lines.push(L('clause', `3.${feeIdx + 1}. A Vállalkozó bankszámlaszáma: ${data.userBankAccount}.`));
  }
  lines.push(L('clause', `3.${feeIdx + (data.userBankAccount ? 2 : 1)}. Fizetési késedelem esetén a Megrendelő a Polgári Törvénykönyv szerinti késedelmi kamatot köteles megfizetni. 15 napot meghaladó fizetési késedelem esetén a Vállalkozó jogosult a munkát felfüggeszteni a tartozás rendezéséig.`));
  lines.push(gap());

  // 4. Átadás-átvétel
  lines.push(L('section-heading', '4. ÁTADÁS-ÁTVÉTEL'));
  lines.push(gap());
  lines.push(L('clause', '4.1. A Vállalkozó a mű elkészültét írásban (e-mail útján) jelzi a Megrendelőnek, és átadja az eredményt, valamint a vonatkozó dokumentációt.'));
  lines.push(L('clause', `4.2. A Megrendelő az értesítés kézhezvételétől számított ${f.acceptanceDays || '8'} munkanapon belül köteles az átvételi eljárást lefolytatni és írásbeli észrevételeit megtenni.`));
  lines.push(L('clause', '4.3. Amennyiben az eredmény megfelel a szerződésben foglaltaknak, a Felek átadás-átvételi jegyzőkönyvet írnak alá. A Megrendelő indokolatlanul nem tagadhatja meg az átvételt.'));
  lines.push(L('clause', `4.4. Hibás teljesítés esetén a Megrendelő a hibákat tételesen, írásban közli a Vállalkozóval. A Vállalkozó a hibákat a közléstől számított ésszerű határidőn belül — de legkésőbb ${f.bugfixDays || '10'} munkanapon belül — köteles javítani.`));
  lines.push(L('clause', 'a Megrendelő az átvételi határidőn belül nem tesz írásbeli észrevételt, az eredmény átvettnek tekintendő (hallgatólagos átvétel).'));
  lines.push(gap());

  // 5. Szellemi tulajdon
  lines.push(L('section-heading', '5. SZELLEMI TULAJDON'));
  lines.push(gap());
  lines.push(L('clause', '5.1. A vállalkozási díj teljes megfizetését követően a létrehozott mű feletti vagyoni jogok — ideértve különösen a szerzői jogokat, a forráskód, grafikai elemek, dokumentáció feletti jogokat — a Megrendelőre szállnak át, a Szerzői jogról szóló 1999. évi LXXVI. törvény rendelkezéseivel összhangban.'));
  lines.push(L('clause', '5.2. A díj teljes megfizetéséig a szellemi alkotások feletti vagyoni jogok a Vállalkozónál maradnak, és a Vállalkozó a művet visszatarthatja.'));
  lines.push(L('clause', '5.3. A Vállalkozó a referencia célú felhasználás jogát fenntartja: jogosult a létrehozott mű tényét és általános leírását portfóliójában feltüntetni, a Megrendelő bizalmas üzleti információinak közlése nélkül.'));
  lines.push(L('clause', '5.4. A Vállalkozó szavatolja, hogy a mű nem sérti harmadik fél szellemi tulajdonjogát.'));
  lines.push(gap());

  // 6. Jótállás
  lines.push(L('section-heading', '6. JÓTÁLLÁS ÉS SZAVATOSSÁG'));
  lines.push(gap());
  lines.push(L('clause', `6.1. A Vállalkozó az átadástól számított ${f.warrantyMonths || '6 hónap'} időtartamra jótállást vállal a létrehozott mű hibamentes működéséért.`));
  lines.push(L('clause', '6.2. A jótállás keretében a Vállalkozó a hibák bejelentésétől számított ésszerű határidőn belül köteles az elhárítást megkezdeni.'));
  lines.push(L('clause', '6.3. A jótállás nem terjed ki:'));
  lines.push(L('sub-item', 'a) a Megrendelő vagy harmadik fél által okozott hibákra;'));
  lines.push(L('sub-item', 'b) a nem rendeltetésszerű használatból eredő meghibásodásokra;'));
  lines.push(L('sub-item', 'c) a Megrendelő által a Vállalkozó jóváhagyása nélkül végzett módosításokból eredő problémákra;'));
  lines.push(L('sub-item', 'd) vis maior eseményekből eredő hibákra.'));
  lines.push(L('clause', '6.4. A jótálláson túl a Megrendelőt a Ptk. szerinti kellékszavatossági jogok is megilletik.'));
  lines.push(gap());

  // 7. Szerződésszegés és kötbér
  lines.push(L('section-heading', '7. SZERZŐDÉSSZEGÉS ÉS KÖTBÉR'));
  lines.push(gap());
  lines.push(L('clause', '7.1. A Vállalkozó késedelmes teljesítése esetén a Megrendelő késedelmi kötbérre jogosult, amelynek mértéke naponta a vállalkozási díj 0,5%-a, de összesen legfeljebb a vállalkozási díj 10%-a.'));
  lines.push(L('clause', '7.2. A Megrendelő fizetési késedelme esetén a Vállalkozó a Ptk. szerinti késedelmi kamaton felül napi 0,5%-os késedelmi kötbérre jogosult, de összesen legfeljebb a hátralékos összeg 10%-a.'));
  lines.push(L('clause', '7.3. A kötbér megfizetése nem mentesíti a szerződésszegő Felet az esetleges további kártérítési kötelezettség alól, de a kötbéren felüli kártérítésbe a megfizetett kötbér összege beszámít.'));
  lines.push(L('clause', '7.4. Súlyos szerződésszegés esetén bármelyik Fél jogosult a szerződést azonnali hatállyal, írásban felmondani.'));
  lines.push(gap());

  // 8. Titoktartás
  lines.push(L('section-heading', '8. TITOKTARTÁS'));
  lines.push(gap());
  lines.push(L('clause', '8.1. A Felek kötelezettséget vállalnak arra, hogy a jelen szerződés teljesítése során egymás tudomására jutott üzleti titkokat, bizalmas információkat és személyes adatokat bizalmasan kezelik, harmadik személynek nem adják ki.'));
  lines.push(L('clause', '8.2. A titoktartási kötelezettség a szerződés megszűnését követően is hatályban marad, időbeli korlátozás nélkül.'));
  lines.push(gap());

  // 9. Felelősség
  lines.push(L('section-heading', '9. FELELŐSSÉG'));
  lines.push(gap());
  lines.push(L('clause', '9.1. A Vállalkozó felelőssége a jelen szerződés alapján összesen legfeljebb a vállalkozási díj összegéig terjed.'));
  lines.push(L('clause', '9.2. A Vállalkozó nem felel az olyan károkért, amelyek a Megrendelő által szolgáltatott hibás vagy hiányos specifikációból, adatokból, vagy a Megrendelő együttműködési kötelezettségének elmulasztásából erednek.'));
  lines.push(L('clause', '9.3. A Vállalkozó nem felel az elmaradt haszonért vagy közvetett károkért, kivéve szándékos vagy súlyosan gondatlan károkozás esetén.'));
  lines.push(gap());

  // 10. GDPR
  lines.push(L('section-heading', '10. ADATKEZELÉS (GDPR)'));
  lines.push(gap());
  lines.push(L('clause', '10.1. A Felek a jelen szerződés teljesítése során egymás kapcsolattartóinak személyes adatait kizárólag a szerződés teljesítése céljából kezelik, a GDPR és az információs önrendelkezési jogról szóló 2011. évi CXII. törvény rendelkezéseinek megfelelően.'));
  lines.push(gap());

  // 11. Vis maior
  lines.push(L('section-heading', '11. VIS MAIOR (FORCE MAJEURE)'));
  lines.push(gap());
  lines.push(L('clause', '11.1. Egyik Fél sem felel a jelen szerződésben foglalt kötelezettségei teljesítésének késedelméért vagy elmulasztásáért, ha azt vis maior esemény okozza.'));
  lines.push(L('clause', '11.2. A vis maior eseményt az érintett Fél haladéktalanul, de legkésőbb 5 munkanapon belül írásban köteles a másik Félnek bejelenteni.'));
  lines.push(L('clause', '11.3. Amennyiben a vis maior esemény 60 napot meghaladóan fennáll, bármelyik Fél jogosult a szerződést felmondani.'));
  lines.push(gap());

  // 12. Értesítések
  lines.push(L('section-heading', '12. ÉRTESÍTÉSEK'));
  lines.push(gap());
  lines.push(L('clause', '12.1. A jelen szerződéssel kapcsolatos értesítések érvényesen a másik Fél e-mail címére küldött elektronikus levél útján tehetők meg.'));
  lines.push(L('clause', '12.2. Azonnali hatályú felmondás esetén az értesítést ajánlott, tértivevényes postai küldeményként is meg kell küldeni.'));
  lines.push(gap());

  // 13. Záró
  lines.push(L('section-heading', '13. ZÁRÓ RENDELKEZÉSEK'));
  lines.push(gap());
  lines.push(L('clause', '13.1. A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény (különösen a vállalkozási szerződésre vonatkozó 6:238–6:250. §), a Szerzői jogról szóló 1999. évi LXXVI. törvény, valamint a vonatkozó egyéb jogszabályok rendelkezései az irányadók.'));
  lines.push(L('clause', '13.2. A Felek a jelen szerződésből eredő vitáikat elsősorban közvetlen tárgyalásos úton kísérlik meg rendezni.'));
  lines.push(L('clause', '13.3. A jelen szerződés a Felek teljes megállapodását tartalmazza a szerződés tárgyát illetően, és hatályon kívül helyez minden korábbi szóbeli vagy írásbeli megállapodást.'));
  lines.push(L('clause', '13.4. A jelen szerződés módosítása kizárólag írásban, mindkét Fél aláírásával érvényes.'));
  lines.push(L('clause', '13.5. Amennyiben a jelen szerződés bármely rendelkezése érvénytelennek bizonyul, az nem érinti a szerződés többi rendelkezésének érvényességét.'));
  lines.push(L('clause', '13.6. A jelen szerződés 2 (kettő) eredeti példányban készült, amelyet a Felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag írtak alá.'));
  lines.push(gap());

  // Signature
  lines.push(L('separator', ''));
  lines.push(gap());
  lines.push(L('signing-date', `Kelt: ${f.place || '_______________'}, ${formatDate(data.contractDate)}`));
  lines.push(gap());
  lines.push(gap());
  lines.push(L('signature-block', 'Megrendelő|Vállalkozó'));

  return lines;
}

// ────── TITOKTARTÁSI MEGÁLLAPODÁS (NDA) ──────

export function generateNda(data: ContractData): ContractLine[] {
  const f = data.fields;
  const lines: ContractLine[] = [];

  lines.push(L('title', 'TITOKTARTÁSI MEGÁLLAPODÁS'));
  lines.push(L('subtitle', '(NDA — Non-Disclosure Agreement)'));
  lines.push(gap());
  lines.push(L('preamble', 'amely létrejött egyrészről'));
  lines.push(gap());
  lines.push(...partyBlock('Átadó Fél', data.clientName, data.clientCompany, data.clientAddress, data.clientTaxNumber, data.clientRepresentative, data.clientEmail, data.clientPhone));
  lines.push(gap());
  lines.push(L('preamble', 'másrészről'));
  lines.push(gap());
  lines.push(...partyBlock('Átvevő Fél', data.userName, data.userCompany, data.userAddress, data.userTaxNumber, '', data.userEmail, data.userPhone));
  lines.push(gap());
  lines.push(L('preamble', '(a továbbiakban együttesen: Felek) között az alulírott helyen és napon, az alábbi feltételekkel:'));
  lines.push(gap());
  lines.push(L('separator', ''));

  // 1. Cél
  lines.push(L('section-heading', '1. A MEGÁLLAPODÁS CÉLJA'));
  lines.push(gap());
  lines.push(L('clause', '1.1. A jelen megállapodás célja, hogy szabályozza a Felek között az alábbi célból átadott bizalmas információk védelmét:'));
  lines.push(L('user-text', f.purpose || '_______________'));
  lines.push(gap());

  // 2. Bizalmas információ
  lines.push(L('section-heading', '2. BIZALMAS INFORMÁCIÓ MEGHATÁROZÁSA'));
  lines.push(gap());
  lines.push(L('clause', '2.1. A jelen megállapodás alkalmazásában bizalmas információnak minősül minden olyan — szóban, írásban, elektronikusan vagy bármely más formában átadott — adat, dokumentum, tudás, know-how, üzleti titok, amelyet az Átadó Fél az Átvevő Fél rendelkezésére bocsát, különösen:'));
  lines.push(L('user-text', f.confidentialInfo || '_______________'));
  lines.push(gap());
  lines.push(L('clause', '2.2. Bizalmas információnak minősülnek továbbá:'));
  lines.push(L('sub-item', 'a) üzleti tervek, stratégiák, pénzügyi adatok;'));
  lines.push(L('sub-item', 'b) ügyféladatok, ügyféllisták, szerződéses feltételek;'));
  lines.push(L('sub-item', 'c) technológiai megoldások, forráskódok, algoritmusok, szoftverarchitektúra;'));
  lines.push(L('sub-item', 'd) marketing tervek, árazási stratégiák;'));
  lines.push(L('sub-item', 'e) munkavállalói és partneri adatok;'));
  lines.push(L('sub-item', 'f) a jelen megállapodás léte és tartalma.'));
  lines.push(gap());
  lines.push(L('clause', '2.3. Nem minősül bizalmas információnak az, amely:'));
  lines.push(L('sub-item', 'a) az átadás időpontjában már nyilvánosan hozzáférhető volt, vagy amelyet az Átadó Fél nyilvánosságra hozatalra szánt;'));
  lines.push(L('sub-item', 'b) az átadást követően — nem az Átvevő Fél szerződésszegése következtében — vált nyilvánossá;'));
  lines.push(L('sub-item', 'c) az Átvevő Fél igazolhatóan jogszerűen, harmadik féltől, titoktartási kötelezettség nélkül szerezte meg;'));
  lines.push(L('sub-item', 'd) az Átvevő Fél igazolhatóan önállóan, a bizalmas információ felhasználása nélkül fejlesztette ki;'));
  lines.push(L('sub-item', 'e) amelyet az Átadó Fél írásban, kifejezetten felszabadított a titoktartási kötelezettség alól.'));
  lines.push(gap());

  // 3. Kötelezettség
  lines.push(L('section-heading', '3. TITOKTARTÁSI KÖTELEZETTSÉG'));
  lines.push(gap());
  lines.push(L('clause', '3.1. Az Átvevő Fél kötelezettséget vállal arra, hogy:'));
  lines.push(L('sub-item', 'a) a bizalmas információt kizárólag az 1.1. pontban meghatározott céllal összhangban használja fel;'));
  lines.push(L('sub-item', 'b) a bizalmas információt harmadik személy részére nem adja ki, nem teszi hozzáférhetővé, nem publikálja;'));
  lines.push(L('sub-item', 'c) a bizalmas információ védelme érdekében legalább olyan gondossággal jár el, mint amit saját azonos értékű bizalmas információi tekintetében tanúsít;'));
  lines.push(L('sub-item', 'd) a bizalmas információhoz csak olyan személyek számára biztosít hozzáférést, akiknek az a feladat ellátásához feltétlenül szükséges (need-to-know elv), és akik maguk is titoktartási kötelezettséget vállaltak;'));
  lines.push(L('sub-item', 'e) haladéktalanul értesíti az Átadó Felet, ha a bizalmas információ jogosulatlan hozzáférésének gyanújáról szerez tudomást.'));
  lines.push(gap());
  lines.push(L('clause', '3.2. Nem minősül a titoktartási kötelezettség megsértésének, ha az Átvevő Fél a bizalmas információt jogszabályi kötelezettség alapján, hatóság vagy bíróság felhívására köteles közölni — feltéve, hogy erről az Átadó Felet előzetesen értesíti.'));
  lines.push(gap());

  // 4. Időtartam
  lines.push(L('section-heading', '4. IDŐTARTAM'));
  lines.push(gap());
  lines.push(L('clause', `4.1. A jelen megállapodás szerinti titoktartási kötelezettség a megállapodás aláírásától számított ${f.durationYears || '3 év'} időtartamig áll fenn.`));
  lines.push(L('clause', '4.2. Az üzleti titoknak minősülő információk tekintetében a titoktartási kötelezettség a 4.1. pont szerinti időtartamon túl is fennáll, amíg az információ üzleti titoknak minősül.'));
  lines.push(L('clause', '4.3. Az együttműködés megszűnése esetén az Átvevő Fél köteles — az Átadó Fél írásbeli kérésére — az összes bizalmas információt 15 napon belül visszaszolgáltatni vagy igazoltan megsemmisíteni, és erről írásbeli igazolást adni.'));
  lines.push(gap());

  // 5. Szellemi tulajdon
  lines.push(L('section-heading', '5. SZELLEMI TULAJDON'));
  lines.push(gap());
  lines.push(L('clause', '5.1. A bizalmas információ átadása nem jelenti annak szellemi tulajdonjogának átruházását. Az Átadó Fél a bizalmas információ feletti minden jogot fenntart.'));
  lines.push(L('clause', '5.2. Az Átvevő Fél semmilyen licencet, felhasználási jogot vagy egyéb jogosultságot nem szerez a bizalmas információ felett, kivéve az 1.1. pontban meghatározott cél szerinti korlátozott felhasználást.'));
  lines.push(gap());

  // 6. Jogkövetkezmények
  lines.push(L('section-heading', '6. JOGKÖVETKEZMÉNYEK'));
  lines.push(gap());
  if (f.penaltyAmount) {
    lines.push(L('clause', `6.1. A titoktartási kötelezettség megsértése esetén az Átvevő Fél ${fmtNum(f.penaltyAmount)} Ft összegű kötbér megfizetésére köteles. A kötbér minden egyes jogsértés esetén külön-külön esedékes.`));
    lines.push(L('clause', '6.2. A kötbér megfizetése nem mentesíti az Átvevő Felet az esetleges további kártérítési kötelezettség alól. A megfizetett kötbér a kártérítésbe beszámít.'));
    lines.push(L('clause', '6.3. Az Átadó Fél jogosult a jogsértés abbahagyására, az eredeti állapot helyreállítására, valamint ideiglenes intézkedés kérésére bíróságtól.'));
  } else {
    lines.push(L('clause', '6.1. A titoktartási kötelezettség megsértése esetén az Átvevő Fél az Átadó Félnek okozott teljes kár megtérítésére köteles.'));
    lines.push(L('clause', '6.2. Az Átadó Fél jogosult a jogsértés abbahagyására, az eredeti állapot helyreállítására, valamint ideiglenes intézkedés kérésére bíróságtól.'));
  }
  lines.push(gap());

  // 7. GDPR
  lines.push(L('section-heading', '7. ADATKEZELÉS (GDPR)'));
  lines.push(gap());
  lines.push(L('clause', '7.1. A Felek a jelen megállapodás teljesítése során egymás kapcsolattartóinak személyes adatait kizárólag a megállapodás céljának megvalósítása érdekében kezelik, a GDPR és az információs önrendelkezési jogról szóló 2011. évi CXII. törvény rendelkezéseinek megfelelően.'));
  lines.push(L('clause', '7.2. Amennyiben a bizalmas információ személyes adatokat tartalmaz, az Átvevő Fél azokat adatfeldolgozóként, kizárólag az Átadó Fél utasításai szerint kezeli.'));
  lines.push(gap());

  // 8. Záró
  lines.push(L('section-heading', '8. ZÁRÓ RENDELKEZÉSEK'));
  lines.push(gap());
  lines.push(L('clause', '8.1. A jelen megállapodásban nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény, az üzleti titokról szóló 2018. évi LIV. törvény, a Szerzői jogról szóló 1999. évi LXXVI. törvény, valamint a vonatkozó egyéb jogszabályok rendelkezései az irányadók.'));
  lines.push(L('clause', '8.2. A Felek a jelen megállapodásból eredő vitáikat elsősorban közvetlen tárgyalásos úton kísérlik meg rendezni.'));
  lines.push(L('clause', '8.3. A jelen megállapodás módosítása kizárólag írásban, mindkét Fél aláírásával érvényes.'));
  lines.push(L('clause', '8.4. Amennyiben a jelen megállapodás bármely rendelkezése érvénytelennek bizonyul, az nem érinti a megállapodás többi rendelkezésének érvényességét.'));
  lines.push(L('clause', '8.5. A jelen megállapodás a Felek teljes megállapodását tartalmazza a titoktartás tárgyában.'));
  lines.push(L('clause', '8.6. A jelen megállapodás 2 (kettő) eredeti példányban készült, amelyet a Felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag írtak alá.'));
  lines.push(gap());

  // Signature
  lines.push(L('separator', ''));
  lines.push(gap());
  lines.push(L('signing-date', `Kelt: ${f.place || '_______________'}, ${formatDate(data.contractDate)}`));
  lines.push(gap());
  lines.push(gap());
  lines.push(L('signature-block', 'Átadó Fél|Átvevő Fél'));

  return lines;
}

// ────── Router ──────

export function generateContractLines(templateId: string, data: ContractData): ContractLine[] {
  switch (templateId) {
    case 'megbizasi': return generateMegbizasi(data);
    case 'vallalkozasi': return generateVallalkozasi(data);
    case 'nda': return generateNda(data);
    default: throw new Error(`Ismeretlen sablon: ${templateId}`);
  }
}
