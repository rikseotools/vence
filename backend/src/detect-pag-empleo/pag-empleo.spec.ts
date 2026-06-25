import {
  isRelevantPagConvocatoria,
  parsePagItems,
  parsePagMeta,
} from './pag-empleo';

// Fixture mínima pero REAL: dos <li> del buscador avanzado del PAG
// (administracion.gob.es), capturados el 25/06/2026. El primero es la
// convocatoria de Ayudantes de IIPP (C1, 1050 plazas, Min. Interior) que el
// radar antiguo no detectaba; el segundo es una de promoción interna (debe
// filtrarse por el guardarraíl de turno libre).
const FIXTURE = `
<li class="ppg-table__list--type02 ppg-brd--bottom">
  <h3 data-toggle="table-link" class="ppg-heading ppg-heading--type03">
    <span class="ppg-heading">Ref. </span>220962<span class="ppg-table__title"> | AYUDANTES DE INSTITUCIONES PENITENCIARIAS</span>
  </h3>
  <input type="hidden" name="jsonDetalle" value="{#idConvocatoria#:#220962#,#idsGrupo#:#4#,#desDenominacionCuerpo#:#AYUDANTES DE INSTITUCIONES PENITENCIARIAS#,#idsAdmiconvocante#:#1#,#idsAmbgeografico#:#2#,#idsCcaa#:#00#,#idsProvincia#:#00#,#sDesde#:#1050#}" />
  <h4 class="ppg-heading">Titulación:</h4> <p class="ppg-text t-padding-left-0">Bachiller, Técnico o equivalente</p>
  <h4 class="ppg-heading">Órgano convocante:</h4> <p class="ppg-text t-padding-left-0">Ministerio del Interior</p>
  <h4 class="ppg-heading">Convocadas:</h4> <p class="ppg-text t-padding-left-0">1050</p>
  <h4 class="ppg-heading">Plazo de presentación:</h4> <p class="ppg-text t-padding-left-0">Hasta el 16/07/2026</p>
</li>
<li class="ppg-table__list--type02 ppg-brd--bottom">
  <h3 class="ppg-heading ppg-heading--type03"><span class="ppg-heading">Ref. </span>220900<span> | ADMINISTRATIVO (PROMOCIÓN INTERNA)</span></h3>
  <input type="hidden" name="jsonDetalle" value="{#idConvocatoria#:#220900#,#idsGrupo#:#4#,#desDenominacionCuerpo#:#ADMINISTRATIVO#,#idsAdmiconvocante#:#4#,#idsAmbgeografico#:#3#,#idsCcaa#:#07#,#sDesde#:#5#}" />
  <h4 class="ppg-heading">Titulación:</h4> <p class="ppg-text t-padding-left-0">Bachiller o Técnico</p>
  <h4 class="ppg-heading">Órgano convocante:</h4> <p class="ppg-text t-padding-left-0">Universidad de León (promoción interna)</p>
  <h4 class="ppg-heading">Convocadas:</h4> <p class="ppg-text t-padding-left-0">5</p>
  <h4 class="ppg-heading">Plazo de presentación:</h4> <p class="ppg-text t-padding-left-0">Hasta el 13/07/2026</p>
</li>
<input type="hidden" name="json" value="{#numPaginaActual#:1,#numPaginasTotales#:2,#numRegistrosMostrar#:10,#elementoInicialPaginacion#:0,#elementoFinalPaginacion#:0,#numRegistrosTotales#:20}" />
`;

describe('pag-empleo parser', () => {
  const items = parsePagItems(FIXTURE);

  it('parsea cada <li> a una convocatoria estructurada', () => {
    expect(items).toHaveLength(2);
  });

  it('extrae los campos del jsonDetalle (caso IIPP)', () => {
    const iipp = items[0];
    expect(iipp.id).toBe('220962');
    expect(iipp.cuerpo).toBe('AYUDANTES DE INSTITUCIONES PENITENCIARIAS');
    expect(iipp.grupo).toBe('C1');
    expect(iipp.admin).toBe('Estatal');
    expect(iipp.ccaa).toBe('Nacional');
    expect(iipp.organismo).toBe('Ministerio del Interior');
    expect(iipp.plazas).toBe(1050);
  });

  it('normaliza el plazo a YYYY-MM-DD', () => {
    expect(items[0].plazoHasta).toBe('2026-07-16');
  });

  it('lee la meta de paginación', () => {
    const meta = parsePagMeta(FIXTURE);
    expect(meta.totalPaginas).toBe(2);
    expect(meta.total).toBe(20);
  });

  it('acepta turno libre C1/C2 y descarta promoción interna', () => {
    expect(isRelevantPagConvocatoria(items[0])).toBe(true); // IIPP libre
    expect(isRelevantPagConvocatoria(items[1])).toBe(false); // promoción interna
  });

  it('devuelve [] con HTML sin resultados', () => {
    expect(parsePagItems('<div>sin resultados</div>')).toEqual([]);
  });
});
