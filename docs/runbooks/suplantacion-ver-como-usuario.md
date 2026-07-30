# Suplantación — «ver la app como la ve un usuario»

> **Frases-gatillo:** *"revisa la suplantación"*, *"revisa el ver-como-usuario"*, *"me he quedado
> dentro de la cuenta de un usuario"*, *"la franja roja no se ve"*, o cuando aparezcan señales
> `impersonacion_*` en `observable_events`.

Entrar en la cuenta de una persona para entender lo que nos reporta. **No es una pantalla de admin
que imita la suya: es su sesión de verdad**, así que la app entera —páginas, APIs, caché por
usuario, badges— responde exactamente como le responde a ella. Esa es la virtud del diseño y
también el motivo de que todo lo de abajo sea obligatorio.

## Cómo se usa

- **Entrar:** botón «Ver como usuario» en el admin (`components/admin/BotonVerComoUsuario.tsx`) →
  `POST /api/admin/impersonar { userId, motivo? }`.
- **Salir:** botón «Salir» de la franja roja → `POST /api/impersonacion/salir`. Vive **fuera** de
  `/api/admin/*` a propósito: durante la suplantación el token es el del usuario, así que el guard
  de admin rechazaba la salida con 401 y dejaba atrapado dentro de la cuenta ajena.
- **Si te quedas dentro y no ves la franja** (no debería pasar ya; ver «El fallo del 30/07»), desde
  la consola del navegador: `fetch('/api/impersonacion/salir',{method:'POST'}).then(()=>location.href='/')`.

## Las cuatro reglas, y dónde se hacen cumplir

| Regla | Dónde vive | Por qué ahí |
|---|---|---|
| **Solo lectura** | `lib/api/auth/verifyAuth.ts` (las 3 ramas) | Es el paso por el que pasan TODAS las APIs autenticadas. Una guarda por endpoint sería confiar en que nadie olvide uno. |
| **Caduca sola (30 min)** | claim `impExp` + callback `jwt` de `lib/auth/authjs.ts` | Es el único punto por el que pasa toda rotación de sesión. |
| **Deja rastro** | `observable_events` | Quién, a quién, cuándo y por qué. Sin registro no es aceptable, ni para nosotros ni de cara al RGPD. |
| **No se suplanta a otro admin** | `decidirImpersonacion` (núcleo puro) | Escalada cruzada: saltar de un admin a otro difumina quién hizo qué. |

## El fallo del 30/07/2026 (T-335) — qué aprender de él

La regla «caduca sola» **no se cumplía**, y la franja de aviso desaparecía antes que el peligro.

- El plazo se guardó en `exp`, que **es un claim de Auth.js**: cada `GET /api/auth/session` —una por
  carga de página— re-firma la cookie con `setExpirationTime(now + maxAge)`, y el maxAge por defecto
  son **30 días**. El mecanismo que debía apagar la suplantación era el que la resucitaba.
- La franja roja se disparaba con la cookie-marca `vence_imp`, que **sí** caducaba a los 30 minutos y
  no se renovaba → pasado ese rato seguías dentro de la cuenta ajena, sin aviso y sin botón de salir.
- Ningún test lo vio porque **todos medían el acuñado** (`exp - iat === 30 min`, que era cierto) y el
  defecto vivía en la **rotación**.

Lo que quedó, y que hay que respetar al tocar esto:

1. **El reloj es nuestro**: `impExp` (`CLAIM_CADUCIDAD`). Auth.js copia los claims que no conoce sin
   tocarlos. Nunca volver a apoyar el plazo en `exp` ni en `iat` — los pisa los dos.
2. **Fail-closed**: una marca `imp` sin `impExp` cuenta como caducada. Así murieron solas las
   sesiones acuñadas antes del arreglo, sin migración ni borrar cookies a mano.
3. **Nada que nazca de la suplantación la sobrevive**: el access token se recorta a
   `min(1h, restante)` y la cookie-marca se re-emite en `/api/auth/token` con el restante real.
4. **La ausencia de la cookie-marca no significa «no hay suplantación»**. Es un atajo de render, no
   una fuente de verdad.

## Comprobar que sigue sana

```bash
# Simulación de extremo a extremo (navegador real, servidor real). 10 comprobaciones.
set -a && . ./.env.development.local && set +a      # AUTH_SECRET + DATABASE_URL
npx tsx scripts/sim/sim-impersonacion.ts [userId] [--url http://localhost:3000]
```

Comprueba el ciclo entero **con contraste**, que es lo que le da valor: que la escritura se bloquea
*y* que la misma escritura con sesión normal no se bloquea; que la sesión vencida no acuña token *y*
que la misma cookie dentro de plazo sí. Sin el contraste, un 403 o un 401 pueden venir de cualquier
otra causa y parecer que la protección funciona.

Capas que la acompañan:
- `__tests__/admin/impersonacion.test.ts` — el núcleo puro (decisiones y reloj).
- `__tests__/integration/impersonacionRotacionTtl.test.ts` — la **rotación**, con el `encode`/`decode`
  reales de Auth.js. Es el que fija la causa raíz.
- `__tests__/guardrails/impersonacionCandadoTodasLasRamas.test.ts` — candado y reloj en las 3 ramas
  del verificador.
- `__tests__/guardrails/impersonacionRelojPropio.test.ts` — que las piezas sigan conectadas.

## Señales en `observable_events`

| Evento | Severidad | Qué significa |
|---|---|---|
| `impersonacion_iniciada` | warn | Alguien entró en una cuenta. `warn` a propósito: no es un error, pero tiene que verse. |
| `impersonacion_terminada` | info | Salida limpia por el botón. |
| `impersonacion_caducada` | info | El plazo venció y la sesión se cerró sola. Es la salvaguarda funcionando. |
| `impersonacion_escritura_bloqueada` | warn | Se intentó escribir suplantando. El candado lo impidió. |
| `impersonacion_caducada_rechazada` | warn | Llegó un token de una suplantación ya terminada. **En régimen normal casi no debería aparecer**: el token nace capado. Si sube, alguna capa de arriba dejó de funcionar → mirar el callback `jwt` y el recorte del acuñado. |
| `impersonacion_rechazada` | warn | Se intentó suplantar a otro admin, a uno mismo o con un id inválido. |

```sql
SELECT event_type, severity, count(*), max(created_at)
FROM observable_events
WHERE event_type LIKE 'impersonacion%' AND created_at > now() - interval '7 days'
GROUP BY 1,2 ORDER BY 3 DESC;
```
