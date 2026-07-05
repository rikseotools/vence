#!/usr/bin/env node
/**
 * Envío de newsletter promocional de una oposición con inscripción abierta,
 * a usuarios de su zona (target exacto + provincia/comunidad).
 *
 * Réplica EXACTA del flujo de /api/admin/newsletters/send (token de baja +
 * pixel de apertura + tracking de clics + registro en email_events), pero con
 * audiencia geográfica personalizada que el endpoint estándar no soporta.
 *
 * Uso:
 *   export PROD_DATABASE_URL="postgresql://venceadmin:<pass>@vence-prod...:5432/app"
 *   node scripts/newsletters/send-promo-inscripcion.cjs <config.json> --dry     # prueba en seco
 *   node scripts/newsletters/send-promo-inscripcion.cjs <config.json> --send    # envío real
 *
 * config.json (ver docs/runbooks/newsletter-promociones.md):
 * {
 *   "targetOposicion": "administrativo_la_rioja",   // user_profiles.target_oposicion (GUIONES BAJOS)
 *   "slug": "administrativo-la-rioja",              // oposiciones.slug (GUIONES)
 *   "nombreOposicion": "C1 Administrativo de La Rioja",
 *   "subtitulo": "Inscripción abierta hasta el 8 de julio",
 *   "textoPlazas": " Se han convocado <strong>17 plazas</strong>...",
 *   "features": ["<strong>42 temas</strong> del temario oficial", "Tests por tema", ...],
 *   "municipios": ["rioja","logro","calahorra", ...],   // ILIKE %m% sobre user_profiles.ciudad
 *   "templateSlug": "inscripcion-abierta"            // plantilla en email_templates (opcional)
 * }
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');

const configPath = process.argv[2];
const MODE = process.argv.includes('--send') ? 'send' : (process.argv.includes('--dry') ? 'dry' : null);
if (!configPath || !MODE) {
  console.error('Uso: node send-promo-inscripcion.cjs <config.json> --dry|--send');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const templateSlug = cfg.templateSlug || 'inscripcion-abierta';

const CONN = process.env.PROD_DATABASE_URL;
if (!CONN) { console.error('❌ Falta env PROD_DATABASE_URL (RDS). Ver memoria project_cutover_rds_prod / scratchpad/rdsprod.env'); process.exit(1); }
if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY en .env.local'); process.exit(1); }

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Vence.es';
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es';

const renderTemplate = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  const v = vars[k];
  return (v === undefined || v === null) ? m : String(v);
});
const featLi = (t) => '<li style="margin: 10px 0; color: #065f46; font-size: 15px; padding-left: 28px; position: relative;"><span style="position: absolute; left: 0;">✅</span>' + t + '</li>';

const BASE_VARS = {
  nombreOposicion: cfg.nombreOposicion,
  subtitulo: cfg.subtitulo,
  textoPlazas: cfg.textoPlazas || '',
  features: (cfg.features || []).map(featLi).join(''),
  ctaUrl: `https://www.vence.es/${cfg.slug}/test?utm_source=email&utm_campaign=nueva_oposicion`,
  slug: cfg.slug,
};

(async () => {
  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tplRes = await c.query(`SELECT subject_template, html_template FROM email_templates WHERE slug=$1`, [templateSlug]);
  if (!tplRes.rows.length) { console.error(`❌ Plantilla "${templateSlug}" no encontrada`); process.exit(1); }
  const { subject_template, html_template } = tplRes.rows[0];

  const muni = cfg.municipios || [];
  const like = muni.length ? '(' + muni.map((_, i) => 'up.ciudad ILIKE $' + (i + 1)).join(' OR ') + ')' : 'false';
  const params = muni.map(m => '%' + m + '%');
  // Excluir falsos positivos de substring (ej: "Salvaleón"/"Gibraleón" matchean %león%).
  // Se aplica salvo a los que entran por target exacto (esos son legítimos).
  const excl = cfg.excludeCiudades || [];
  const exclSql = excl.length
    ? 'AND (up.target_oposicion=$' + (muni.length + 1) + ' OR NOT (' +
      excl.map((_, i) => 'up.ciudad ILIKE $' + (muni.length + 2 + i)).join(' OR ') + '))'
    : '';
  // Envío incremental / make-up: no re-enviar a quien ya recibió una campaña previa.
  const skipCampaign = cfg.excludeSentCampaignId || null;
  const skipParamIdx = muni.length + 2 + excl.length;
  const skipSql = skipCampaign
    ? `AND up.id NOT IN (SELECT user_id FROM email_events WHERE campaign_id=$${skipParamIdx} AND event_type='sent' AND user_id IS NOT NULL)`
    : '';
  const users = (await c.query(`
    SELECT up.id, up.email, up.full_name AS "fullName"
    FROM user_profiles up
    LEFT JOIN email_preferences ep ON ep.user_id = up.id
    WHERE up.email IS NOT NULL AND up.email <> ''
      AND COALESCE(ep.unsubscribed_all,false)=false AND COALESCE(ep.email_newsletter_disabled,false)=false
      AND (up.target_oposicion=$${muni.length + 1} OR ${like})
      ${exclSql}
      ${skipSql}
    ORDER BY up.email`, [...params, cfg.targetOposicion, ...excl.map(m => '%' + m + '%'), ...(skipCampaign ? [skipCampaign] : [])])).rows;

  console.log(`👥 Audiencia: ${users.length} enviables | plantilla=${templateSlug} | MODO=${MODE}`);

  const campaignId = `${templateSlug}_${Date.now()}`;
  let sent = 0, failed = 0; const errors = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 1000)); // rate limit 1/seg

      const token = crypto.randomBytes(32).toString('hex');
      const unsubscribeLink = `https://www.vence.es/unsubscribe?token=${token}`;
      const userVars = { ...BASE_VARS, userName: (u.fullName ? u.fullName.split(' ')[0] : '') || 'Opositor/a', unsubscribeUrl: unsubscribeLink };
      const personalizedSubject = renderTemplate(subject_template, userVars);
      let html = renderTemplate(html_template, userVars);
      html += `<img src="https://www.vence.es/api/email-tracking/open?user_id=${u.id}&email_id=${campaignId}&type=newsletter&template_id=${templateSlug}&campaign_id=${campaignId}" width="1" height="1" style="display:none;" alt="">`;
      html = html.replace(/href="(https?:\/\/(?:www\.)?vence\.es[^"]*)"/g,
        `href="https://www.vence.es/api/email-tracking/click?user_id=${u.id}&type=newsletter&action=newsletter_link&template_id=${templateSlug}&campaign_id=${campaignId}&redirect=$1"`);

      if (MODE === 'dry') { console.log(`  [DRY] ${u.email} | ${personalizedSubject} | ${userVars.userName}`); sent++; continue; }

      await c.query(`INSERT INTO email_unsubscribe_tokens (user_id, token, email, email_type) VALUES ($1,$2,$3,'newsletter')`, [u.id, token, u.email]);

      let retries = 0, ok = false;
      while (!ok && retries < 3) {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [u.email], subject: personalizedSubject, html })
        });
        const result = await resp.json();
        if (resp.ok) {
          ok = true; sent++;
          await c.query(`INSERT INTO email_events (user_id, event_type, email_type, email_address, subject, template_id, campaign_id, email_content_preview)
             VALUES ($1,'sent','newsletter',$2,$3,$4,$5,$6)`, [u.id, u.email, personalizedSubject, templateSlug, campaignId, html]);
          console.log(`  ✅ ${i + 1}/${users.length} ${u.email} (${result.id})`);
        } else if (resp.status === 429) {
          retries++; if (retries < 3) await new Promise(r => setTimeout(r, 3000)); else { failed++; errors.push({ email: u.email, error: 'rate limit' }); }
        } else { failed++; errors.push({ email: u.email, error: result.message || 'error' }); console.log(`  ❌ ${u.email}: ${result.message || 'error'}`); break; }
      }
    } catch (e) { failed++; errors.push({ email: u.email, error: e.message }); console.log(`  ❌ ${u.email}: ${e.message}`); }
  }

  console.log(`\n=== RESUMEN ===\ncampaignId: ${campaignId}\nenviados: ${sent}\nfallos: ${failed}\ntotal: ${users.length}`);
  if (errors.length) console.log('errores:', JSON.stringify(errors, null, 1));
  await c.end();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
