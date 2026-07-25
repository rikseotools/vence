'use strict';
//
// temarioRefiningDoc — PURA, sin I/O. Detecta si el texto de un documento (comunicado/nota o
// convocatoria) contiene un PROGRAMA/temario que puede afinar el de la oposición. Nace del caso
// CARM (25/07): el programa base 2016 tenía 16 temas y un comunicado 2025 añadía la ofimática
// (T17-21); casi se jubilan 5 temas oficiales. Ver docs/runbooks/verificar-epigrafes-scope.md.
//
// Señal FUERTE (evita el ruido de menciones sueltas de "tema/anexo"):
//   - >=5 marcadores "Tema N" (un temario de verdad enumera muchos temas), O
//   - un anexo de ofimática (menciona PowerPoint Y Excel — patrón típico de la 2ª parte informática).
// Umbral calibrado 25/07: caza CARM (3 docs), 0 falsos positivos en AGE/Valencia/SS (28/28 verif.).

const RE_TEMA = /\btema\s+\d+/gi;

/**
 * @param {string} text  texto extraído del documento
 * @returns {{esTemario:boolean, temaMarkers:number, ofimatica:boolean}}
 */
function analyzeTemarioDoc(text) {
  const t = String(text || '');
  const temaMarkers = (t.match(RE_TEMA) || []).length;
  const ofimatica = /powerpoint/i.test(t) && /excel/i.test(t);
  return { esTemario: temaMarkers >= 5 || ofimatica, temaMarkers, ofimatica };
}

const esTemarioRefiningDoc = (text) => analyzeTemarioDoc(text).esTemario;

module.exports = { analyzeTemarioDoc, esTemarioRefiningDoc, RE_TEMA };
