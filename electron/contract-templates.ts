/**
 * Hungarian contract templates for freelancers.
 * Templates are based on Hungarian civil law (Ptk.) — these are starting-point
 * templates, NOT legal advice. Users should have them reviewed by a lawyer.
 */

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
  // Client info
  clientName: string;
  clientCompany: string;
  clientAddress: string;
  clientTaxNumber: string;
  clientRepresentative: string;
  clientEmail: string;
  // Template-specific fields
  fields: Record<string, string>;
  // Meta
  contractDate: string;   // YYYY-MM-DD
  contractPlace: string;
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
      { key: 'paymentDeadline', label: 'Fizetési határidő', type: 'text', required: true, placeholder: 'pl. 15 nap', defaultValue: '15 nap' },
      { key: 'startDate', label: 'Kezdő dátum', type: 'date', required: true },
      { key: 'endDate', label: 'Befejezési határidő', type: 'date', required: true },
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
      { key: 'fee', label: 'Vállalkozási díj', type: 'text', required: true, placeholder: 'pl. 1 500 000', suffix: 'Ft' },
      { key: 'advancePayment', label: 'Előleg (opcionális)', type: 'text', required: false, placeholder: 'pl. 500 000', suffix: 'Ft' },
      { key: 'paymentDeadline', label: 'Fizetési határidő', type: 'text', required: true, placeholder: 'pl. 15 nap', defaultValue: '15 nap' },
      { key: 'startDate', label: 'Kezdő dátum', type: 'date', required: true },
      { key: 'deadline', label: 'Teljesítési határidő', type: 'date', required: true },
      { key: 'warrantyMonths', label: 'Jótállás időtartama', type: 'text', required: false, placeholder: 'pl. 6 hónap', defaultValue: '6 hónap' },
      { key: 'place', label: 'Kelt (helyszín)', type: 'text', required: true, placeholder: 'pl. Budapest' },
    ],
  },
  {
    id: 'nda',
    name: 'Titoktartási megállapodás (NDA)',
    description: 'Bizalmas információk védelmére vonatkozó megállapodás',
    fields: [
      { key: 'confidentialInfo', label: 'Bizalmas információ meghatározása', type: 'textarea', required: true, placeholder: 'pl. Üzleti tervek, forráskódok, ügyféllisták, pénzügyi adatok' },
      { key: 'purpose', label: 'Felhasználás célja', type: 'textarea', required: true, placeholder: 'pl. Webfejlesztési projekt megvalósítása' },
      { key: 'durationYears', label: 'Titoktartás időtartama', type: 'text', required: true, placeholder: 'pl. 3 év', defaultValue: '3 év' },
      { key: 'penaltyAmount', label: 'Kötbér összege', type: 'text', required: false, placeholder: 'pl. 2 000 000', suffix: 'Ft' },
      { key: 'place', label: 'Kelt (helyszín)', type: 'text', required: true, placeholder: 'pl. Budapest' },
    ],
  },
];

// ────── Template body generators ──────

function formatDate(dateStr: string): string {
  if (!dateStr) return '_______________';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
}

function partyBlock(role: string, name: string, company: string, address: string, taxNumber: string, representative: string, email: string): string[] {
  const lines: string[] = [];
  lines.push(`${role}:`);
  if (company) lines.push(`Név / Cégnév: ${company}`);
  else lines.push(`Név: ${name}`);
  if (representative) lines.push(`Képviselő: ${representative}`);
  if (address) lines.push(`Székhely / Lakcím: ${address}`);
  if (taxNumber) lines.push(`Adószám: ${taxNumber}`);
  if (email) lines.push(`E-mail: ${email}`);
  return lines;
}

export function generateMegbizasi(data: ContractData): string[] {
  const f = data.fields;
  const lines: string[] = [];

  lines.push('MEGBÍZÁSI SZERZŐDÉS');
  lines.push('');
  lines.push(`amely létrejött egyrészről`);
  lines.push('');
  lines.push(...partyBlock('Megbízó', data.clientName, data.clientCompany, data.clientAddress, data.clientTaxNumber, data.clientRepresentative, data.clientEmail));
  lines.push('');
  lines.push('másrészről');
  lines.push('');
  lines.push(...partyBlock('Megbízott', data.userName, data.userCompany, data.userAddress, data.userTaxNumber, '', data.userEmail));
  lines.push('');
  lines.push('(a továbbiakban együttesen: Felek) között az alulírott helyen és napon, az alábbi feltételekkel:');
  lines.push('');

  lines.push('1. A MEGBÍZÁS TÁRGYA');
  lines.push('');
  lines.push(`1.1. A Megbízó megbízza a Megbízottat az alábbi feladat elvégzésével:`);
  lines.push(`${f.subject || '_______________'}`);
  lines.push('');
  lines.push('1.2. A Megbízott a megbízást a Megbízó utasításai szerint, a tőle elvárható szakmai gondossággal köteles ellátni.');
  lines.push('');

  lines.push('2. A MEGBÍZÁS IDŐTARTAMA');
  lines.push('');
  lines.push(`2.1. A szerződés hatályba lép: ${formatDate(f.startDate)}`);
  lines.push(`2.2. A megbízás teljesítési határideje: ${formatDate(f.endDate)}`);
  lines.push('');

  lines.push('3. MEGBÍZÁSI DÍJ ÉS FIZETÉSI FELTÉTELEK');
  lines.push('');
  lines.push(`3.1. A Megbízó a megbízás teljesítéséért ${f.fee || '_______________'} Ft + ÁFA összeget fizet a Megbízottnak.`);
  lines.push(`3.2. A díj fizetése a Megbízott által kiállított számla alapján, annak kézhezvételétől számított ${f.paymentDeadline || '15 nap'} napon belül, banki átutalással történik.`);
  if (data.userBankAccount) {
    lines.push(`3.3. A Megbízott bankszámlaszáma: ${data.userBankAccount}`);
  }
  lines.push('');

  lines.push('4. A FELEK JOGAI ÉS KÖTELEZETTSÉGEI');
  lines.push('');
  lines.push('4.1. A Megbízott köteles:');
  lines.push('   a) a megbízást személyesen ellátni, illetve alvállalkozó igénybevételéhez a Megbízó előzetes írásbeli hozzájárulását kérni;');
  lines.push('   b) a megbízás állásáról a Megbízót rendszeresen tájékoztatni;');
  lines.push('   c) a megbízás során tudomására jutott üzleti titkokat megőrizni.');
  lines.push('');
  lines.push('4.2. A Megbízó köteles:');
  lines.push('   a) a megbízás teljesítéséhez szükséges adatokat, információkat és hozzáféréseket biztosítani;');
  lines.push('   b) a megbízási díjat határidőben megfizetni.');
  lines.push('');

  lines.push('5. SZELLEMI TULAJDON');
  lines.push('');
  lines.push('5.1. A megbízás teljesítése során keletkező szellemi alkotások (ideértve a szerzői jogokat) a megbízási díj teljes megfizetését követően a Megbízóra szállnak át.');
  lines.push('5.2. A Megbízott a referencia célú felhasználás jogát fenntartja.');
  lines.push('');

  lines.push('6. FELMONDÁS');
  lines.push('');
  lines.push('6.1. A szerződést bármelyik Fél 15 napos határidővel, írásban felmondhatja.');
  lines.push('6.2. Felmondás esetén a Megbízott az elvégzett munkával arányos díjazásra jogosult.');
  lines.push('');

  lines.push('7. ZÁRÓ RENDELKEZÉSEK');
  lines.push('');
  lines.push('7.1. A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény rendelkezései az irányadók.');
  lines.push('7.2. A Felek a jelen szerződésből eredő vitáikat elsősorban tárgyalásos úton rendezik.');
  lines.push('7.3. A jelen szerződés 2 (kettő) eredeti példányban készült, amelyet a Felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag írtak alá.');
  lines.push('');
  lines.push(`Kelt: ${f.place || '_______________'}, ${formatDate(data.contractDate)}`);
  lines.push('');
  lines.push('');
  lines.push('_______________________________          _______________________________');
  lines.push('         Megbízó                                    Megbízott');

  return lines;
}

export function generateVallalkozasi(data: ContractData): string[] {
  const f = data.fields;
  const lines: string[] = [];

  lines.push('VÁLLALKOZÁSI SZERZŐDÉS');
  lines.push('');
  lines.push('amely létrejött egyrészről');
  lines.push('');
  lines.push(...partyBlock('Megrendelő', data.clientName, data.clientCompany, data.clientAddress, data.clientTaxNumber, data.clientRepresentative, data.clientEmail));
  lines.push('');
  lines.push('másrészről');
  lines.push('');
  lines.push(...partyBlock('Vállalkozó', data.userName, data.userCompany, data.userAddress, data.userTaxNumber, '', data.userEmail));
  lines.push('');
  lines.push('(a továbbiakban együttesen: Felek) között az alulírott helyen és napon, az alábbi feltételekkel:');
  lines.push('');

  lines.push('1. A VÁLLALKOZÁS TÁRGYA');
  lines.push('');
  lines.push('1.1. A Megrendelő megrendeli, a Vállalkozó elvállalja az alábbi mű/eredmény létrehozását:');
  lines.push(`${f.subject || '_______________'}`);
  lines.push('');
  lines.push('1.2. Átadandó eredmények:');
  lines.push(`${f.deliverables || '_______________'}`);
  lines.push('');

  lines.push('2. TELJESÍTÉSI HATÁRIDŐ');
  lines.push('');
  lines.push(`2.1. A szerződés hatályba lép: ${formatDate(f.startDate)}`);
  lines.push(`2.2. A teljesítési (átadási) határidő: ${formatDate(f.deadline)}`);
  lines.push('2.3. A Vállalkozó jogosult a határidő előtt is teljesíteni.');
  lines.push('');

  lines.push('3. VÁLLALKOZÁSI DÍJ ÉS FIZETÉSI FELTÉTELEK');
  lines.push('');
  lines.push(`3.1. A Megrendelő a vállalkozás teljesítéséért ${f.fee || '_______________'} Ft + ÁFA összeget fizet a Vállalkozónak.`);
  if (f.advancePayment) {
    lines.push(`3.2. A Megrendelő a szerződés aláírásakor ${f.advancePayment} Ft + ÁFA előleget fizet.`);
    lines.push(`3.3. A fennmaradó összeg az átadás-átvételi jegyzőkönyv aláírását követően, a Vállalkozó által kiállított számla alapján, ${f.paymentDeadline || '15 nap'} napon belül fizetendő.`);
  } else {
    lines.push(`3.2. A díj fizetése az átadás-átvételi jegyzőkönyv aláírását követően, a Vállalkozó által kiállított számla alapján, ${f.paymentDeadline || '15 nap'} napon belül, banki átutalással történik.`);
  }
  if (data.userBankAccount) {
    lines.push(`3.4. A Vállalkozó bankszámlaszáma: ${data.userBankAccount}`);
  }
  lines.push('');

  lines.push('4. ÁTADÁS-ÁTVÉTEL');
  lines.push('');
  lines.push('4.1. A Vállalkozó a mű elkészültét írásban jelzi a Megrendelőnek.');
  lines.push('4.2. A Megrendelő az értesítés kézhezvételétől számított 8 munkanapon belül köteles az átvételi eljárást lefolytatni.');
  lines.push('4.3. Amennyiben az eredmény megfelel a szerződésben foglaltaknak, a Felek átadás-átvételi jegyzőkönyvet írnak alá.');
  lines.push('4.4. Hibás teljesítés esetén a Megrendelő a hibákat tételesen közli, a Vállalkozó pedig ésszerű határidőn belül javítja.');
  lines.push('');

  lines.push('5. SZELLEMI TULAJDON');
  lines.push('');
  lines.push('5.1. A vállalkozási díj teljes megfizetését követően a létrehozott mű feletti vagyoni jogok a Megrendelőre szállnak át.');
  lines.push('5.2. A Vállalkozó a referencia célú felhasználás jogát fenntartja.');
  lines.push('');

  lines.push('6. JÓTÁLLÁS');
  lines.push('');
  if (f.warrantyMonths) {
    lines.push(`6.1. A Vállalkozó az átadástól számított ${f.warrantyMonths} időtartamra jótállást vállal a létrehozott mű hibamentes működéséért.`);
  } else {
    lines.push('6.1. A Vállalkozó az átadástól számított 6 hónap időtartamra jótállást vállal a létrehozott mű hibamentes működéséért.');
  }
  lines.push('6.2. A jótállás nem terjed ki a Megrendelő vagy harmadik fél által okozott hibákra, illetve a nem rendeltetésszerű használatból eredő meghibásodásokra.');
  lines.push('');

  lines.push('7. SZERZŐDÉSSZEGÉS');
  lines.push('');
  lines.push('7.1. Amennyiben bármelyik Fél a jelen szerződésben foglalt kötelezettségeit megszegi, a másik Fél a szerződést azonnali hatállyal felmondhatja.');
  lines.push('7.2. A Vállalkozó késedelmes teljesítése esetén a Megrendelő késedelmi kötbérre jogosult, amelynek mértéke naponta a vállalkozási díj 0,5%-a, de legfeljebb a díj 10%-a.');
  lines.push('');

  lines.push('8. ZÁRÓ RENDELKEZÉSEK');
  lines.push('');
  lines.push('8.1. A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény rendelkezései az irányadók.');
  lines.push('8.2. A Felek a jelen szerződésből eredő vitáikat elsősorban tárgyalásos úton rendezik.');
  lines.push('8.3. A jelen szerződés 2 (kettő) eredeti példányban készült, amelyet a Felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag írtak alá.');
  lines.push('');
  lines.push(`Kelt: ${f.place || '_______________'}, ${formatDate(data.contractDate)}`);
  lines.push('');
  lines.push('');
  lines.push('_______________________________          _______________________________');
  lines.push('        Megrendelő                                  Vállalkozó');

  return lines;
}

export function generateNda(data: ContractData): string[] {
  const f = data.fields;
  const lines: string[] = [];

  lines.push('TITOKTARTÁSI MEGÁLLAPODÁS');
  lines.push('(NDA — Non-Disclosure Agreement)');
  lines.push('');
  lines.push('amely létrejött egyrészről');
  lines.push('');
  lines.push(...partyBlock('Átadó Fél', data.clientName, data.clientCompany, data.clientAddress, data.clientTaxNumber, data.clientRepresentative, data.clientEmail));
  lines.push('');
  lines.push('másrészről');
  lines.push('');
  lines.push(...partyBlock('Átvevő Fél', data.userName, data.userCompany, data.userAddress, data.userTaxNumber, '', data.userEmail));
  lines.push('');
  lines.push('(a továbbiakban együttesen: Felek) között az alulírott helyen és napon, az alábbi feltételekkel:');
  lines.push('');

  lines.push('1. A MEGÁLLAPODÁS CÉLJA');
  lines.push('');
  lines.push(`1.1. A jelen megállapodás célja, hogy szabályozza a Felek között az alábbi célból átadott bizalmas információk védelmét:`);
  lines.push(`${f.purpose || '_______________'}`);
  lines.push('');

  lines.push('2. BIZALMAS INFORMÁCIÓ MEGHATÁROZÁSA');
  lines.push('');
  lines.push('2.1. A jelen megállapodás alkalmazásában bizalmas információnak minősül minden olyan adat, dokumentum, tudás, know-how, üzleti titok, amelyet az Átadó Fél az Átvevő Fél rendelkezésére bocsát, különösen:');
  lines.push(`${f.confidentialInfo || '_______________'}`);
  lines.push('');
  lines.push('2.2. Nem minősül bizalmas információnak az, amely:');
  lines.push('   a) az átadás időpontjában már nyilvánosan hozzáférhető volt;');
  lines.push('   b) az átadást követően — nem az Átvevő Fél szerződésszegése következtében — vált nyilvánossá;');
  lines.push('   c) az Átvevő Fél jogszerűen, harmadik féltől, titoktartási kötelezettség nélkül szerezte meg;');
  lines.push('   d) az Átvevő Fél önállóan, a bizalmas információ felhasználása nélkül fejlesztette ki.');
  lines.push('');

  lines.push('3. TITOKTARTÁSI KÖTELEZETTSÉG');
  lines.push('');
  lines.push('3.1. Az Átvevő Fél kötelezettséget vállal arra, hogy:');
  lines.push('   a) a bizalmas információt kizárólag az 1.1. pontban meghatározott céllal összhangban használja fel;');
  lines.push('   b) a bizalmas információt harmadik személy részére nem adja ki, nem teszi hozzáférhetővé;');
  lines.push('   c) a bizalmas információ védelme érdekében legalább olyan gondossággal jár el, mint amit saját bizalmas információi tekintetében tanúsít;');
  lines.push('   d) a bizalmas információhoz csak olyan személyek számára biztosít hozzáférést, akiknek az a feladat ellátásához feltétlenül szükséges, és akik maguk is titoktartási kötelezettséget vállaltak.');
  lines.push('');

  lines.push('4. IDŐTARTAM');
  lines.push('');
  lines.push(`4.1. A jelen megállapodás szerinti titoktartási kötelezettség a megállapodás aláírásától számított ${f.durationYears || '3 év'} időtartamig áll fenn.`);
  lines.push('4.2. Az együttműködés megszűnése esetén az Átvevő Fél köteles az összes bizalmas információt — beleértve a másolatokat is — visszaszolgáltatni vagy igazoltan megsemmisíteni.');
  lines.push('');

  lines.push('5. JOGKÖVETKEZMÉNYEK');
  lines.push('');
  if (f.penaltyAmount) {
    lines.push(`5.1. A titoktartási kötelezettség megsértése esetén az Átvevő Fél ${f.penaltyAmount} Ft összegű kötbér megfizetésére köteles.`);
    lines.push('5.2. A kötbér megfizetése nem mentesíti az Átvevő Felet az esetleges további kártérítési kötelezettség alól.');
  } else {
    lines.push('5.1. A titoktartási kötelezettség megsértése esetén az Átvevő Fél az Átadó Félnek okozott teljes kár megtérítésére köteles.');
  }
  lines.push('');

  lines.push('6. ZÁRÓ RENDELKEZÉSEK');
  lines.push('');
  lines.push('6.1. A jelen megállapodásban nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény, valamint az üzleti titokról szóló 2018. évi LIV. törvény rendelkezései az irányadók.');
  lines.push('6.2. A jelen megállapodás módosítása kizárólag írásban, mindkét Fél aláírásával érvényes.');
  lines.push('6.3. A jelen megállapodás 2 (kettő) eredeti példányban készült, amelyet a Felek elolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt, jóváhagyólag írtak alá.');
  lines.push('');
  lines.push(`Kelt: ${f.place || '_______________'}, ${formatDate(data.contractDate)}`);
  lines.push('');
  lines.push('');
  lines.push('_______________________________          _______________________________');
  lines.push('        Átadó Fél                                   Átvevő Fél');

  return lines;
}

export function generateContractLines(templateId: string, data: ContractData): string[] {
  switch (templateId) {
    case 'megbizasi': return generateMegbizasi(data);
    case 'vallalkozasi': return generateVallalkozasi(data);
    case 'nda': return generateNda(data);
    default: throw new Error(`Ismeretlen sablon: ${templateId}`);
  }
}
