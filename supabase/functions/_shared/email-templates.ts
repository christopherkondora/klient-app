// Klient-branded transactional email HTML generators.
// Each function returns a complete HTML body string ready for Resend.

const CARD_STYLE = `max-width:460px;margin:0 auto;background:linear-gradient(180deg,rgba(18,69,89,0.12) 0%,rgba(1,22,30,0.95) 100%);border:1px solid rgba(18,69,89,0.2);border-radius:16px;overflow:hidden`;
const WRAPPER_STYLE = `background-color:#01161E;padding:40px 0;font-family:'Red Hat Display',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif`;
const FOOTER_HTML = `<div style="padding:16px 32px;border-top:1px solid rgba(18,69,89,0.15);text-align:center"><p style="color:rgba(89,131,146,0.35);font-size:10px;margin:0">© 2026 Klient · klient.work · Kristóf</p></div>`;

function logo() {
  return `<div style="padding:32px 32px 0;text-align:center"><h1 style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#EFF6E0;letter-spacing:0.05em;margin:0">KLIENT</h1></div>`;
}

function icon(emoji: string, danger = false) {
  const bg = danger ? 'rgba(239,68,68,0.1)' : 'rgba(18,69,89,0.2)';
  const border = danger ? 'rgba(239,68,68,0.25)' : 'rgba(18,69,89,0.3)';
  return `<div style="text-align:center;padding:28px 0 8px"><div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:${bg};border:1px solid ${border};line-height:56px"><span style="font-size:28px">${emoji}</span></div></div>`;
}

export function welcomeEmail(name: string, planLabel: string): string {
  return `<div style="${WRAPPER_STYLE}"><div style="${CARD_STYLE}">${logo()}${icon('✓')}<div style="padding:16px 32px 32px;text-align:center"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;color:#EFF6E0;margin:0 0 12px">Üdvözöllek a Klientben!</h2><p style="color:#598392;font-size:14px;line-height:1.7;margin:0 0 20px">Szia ${name},<br/><br/>örülök, hogy csatlakoztál! Az előfizetésed most aktív — mostantól a Klient összes funkciója a rendelkezésedre áll.<br/><br/>Ha bármilyen kérdésed van az induláshoz, csak írj vissza erre az emailre.</p><div style="display:inline-block;padding:6px 16px;background:rgba(18,69,89,0.3);border:1px solid rgba(18,69,89,0.4);border-radius:20px;margin-bottom:28px"><span style="font-size:12px;font-weight:600;color:#AEC3B0;letter-spacing:0.03em">${planLabel} csomag aktív ✓</span></div><p style="color:rgba(89,131,146,0.6);font-size:12px;margin:0;line-height:1.6">Nyisd meg a Klient alkalmazást és kezdj el dolgozni.<br/>A számlát Billingótól külön kapod meg.</p></div>${FOOTER_HTML}</div></div>`;
}

export function lifetimeWelcomeEmail(name: string): string {
  const cardStyle = `max-width:460px;margin:0 auto;background:linear-gradient(180deg,rgba(18,69,89,0.18) 0%,rgba(1,22,30,0.95) 100%);border:1px solid rgba(18,69,89,0.25);border-radius:16px;overflow:hidden`;
  return `<div style="${WRAPPER_STYLE}"><div style="${cardStyle}">${logo()}${icon('♾')}<div style="padding:16px 32px 32px;text-align:center"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;color:#EFF6E0;margin:0 0 12px">Lifetime hozzáférésed aktiválva!</h2><p style="color:#598392;font-size:14px;line-height:1.7;margin:0 0 20px">Szia ${name},<br/><br/>ez egy különleges pillanat — egyszer fizetsz, és a Klient örökre a tiéd. Nagyon örülök, hogy hosszú távon is velem maradsz.<br/><br/>Mostantól minden funkció, minden jövőbeli frissítés, korlátlan ideig — semmi extra teendő.</p><div style="display:inline-block;padding:8px 20px;background:linear-gradient(135deg,rgba(18,69,89,0.4),rgba(89,131,146,0.15));border:1px solid rgba(89,131,146,0.3);border-radius:20px;margin-bottom:28px"><span style="font-size:12px;font-weight:700;color:#AEC3B0;letter-spacing:0.05em">LIFETIME · Örökös hozzáférés</span></div><p style="color:rgba(89,131,146,0.6);font-size:12px;margin:0;line-height:1.6">Nyisd meg a Klient alkalmazást — már minden elér.<br/>A számlát Billingótól külön kapod meg.</p></div>${FOOTER_HTML}</div></div>`;
}

export function renewalEmail(name: string, amount: string): string {
  return `<div style="${WRAPPER_STYLE}"><div style="${CARD_STYLE}">${logo()}${icon('↻')}<div style="padding:16px 32px 32px;text-align:center"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;color:#EFF6E0;margin:0 0 12px">Éves előfizetésed megújult</h2><p style="color:#598392;font-size:14px;line-height:1.7;margin:0 0 20px">Szia ${name},<br/><br/>szerettelek értesíteni, hogy az éves Klient előfizetésed automatikusan megújult. A következő <strong style="color:#EFF6E0">${amount}</strong> levonásra került a kártyáról.<br/><br/>Köszönöm, hogy még egy évre velem maradsz — igyekszem megérdemelni!</p><div style="display:inline-block;padding:6px 16px;background:rgba(18,69,89,0.3);border:1px solid rgba(18,69,89,0.4);border-radius:20px;margin-bottom:28px"><span style="font-size:12px;font-weight:600;color:#AEC3B0">Éves csomag · ${amount}</span></div><p style="color:rgba(89,131,146,0.6);font-size:12px;margin:0;line-height:1.6">A számlát Billingótól külön kapod meg.<br/>Ha kérdésed van, csak írj erre az emailre.</p></div>${FOOTER_HTML}</div></div>`;
}

export function dunningEmail(name: string, portalLink: string): string {
  return `<div style="${WRAPPER_STYLE}"><div style="${CARD_STYLE}">${logo()}${icon('⚠', true)}<div style="padding:16px 32px 32px;text-align:center"><h2 style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;color:#EFF6E0;margin:0 0 12px">Sikertelen fizetés</h2><p style="color:#598392;font-size:14px;line-height:1.7;margin:0 0 24px">Szia ${name},<br/><br/>sajnos az előfizetésed díjának terhelése nem sikerült. Az előfizetésed jelenleg felfüggesztett állapotban van — a hozzáférésed visszaáll, amint sikerül a fizetés.<br/><br/>Frissítsd a fizetési adataidat az alábbi gombra kattintva:</p><a href="${portalLink}" target="_blank" style="display:inline-block;padding:14px 36px;background:#124559;color:#EFF6E0;text-decoration:none;font-size:14px;font-weight:600;border-radius:10px;letter-spacing:0.02em;margin-bottom:24px">Fizetési adatok frissítése</a><p style="color:rgba(89,131,146,0.5);font-size:11px;margin:0;line-height:1.6">A link 7 napig érvényes. Ha lejárt, nyisd meg a Klient appot<br/>és a Beállítások → Előfizetés menüben is eléred a portált.<br/><br/>Ha kérdésed van, csak írj erre az emailre.</p></div>${FOOTER_HTML}</div></div>`;
}

export function planLabelHu(plan: string): string {
  if (plan === 'yearly') return 'Éves';
  if (plan === 'monthly') return 'Havi';
  return 'Klient';
}

export function planAmountHu(plan: string): string {
  if (plan === 'yearly') return '49 900 Ft';
  if (plan === 'monthly') return '4 990 Ft';
  return '';
}
