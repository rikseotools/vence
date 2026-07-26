// lib/observability/instanceId.ts
//
// Identificador ÚNICO de esta instancia (proceso) para la observabilidad.
//
// POR QUÉ (medido 26/07/2026): la firma intuitiva `${HOSTNAME}#${pid}` es
// IDÉNTICA en las 8 tasks de Fargate — el HOSTNAME del contenedor vale `0.0.0.0`
// y el proceso de Next siempre es el pid 1. Los eventos `isr_purge_applied`
// llegaban a `observable_events` con `instance=0.0.0.0#1` los ocho, así que no
// se podía saber CUÁL instancia había fallado, que era justo para lo que estaba.
//
// Un uuid corto fijado al cargar el módulo sí las distingue, y como el proceso
// vive lo que vive el contenedor, sirve de identidad estable de esa instancia
// mientras está viva. Se antepone el HOSTNAME cuando aporta algo (fuera de
// Fargate suele ser el nombre real de la máquina).

import { randomUUID } from 'crypto'

const uuid = randomUUID().slice(0, 8)
const host = process.env.HOSTNAME && process.env.HOSTNAME !== '0.0.0.0' ? process.env.HOSTNAME : null

/** Id de esta instancia, estable durante toda la vida del proceso. */
export const INSTANCE_ID = host ? `${host}:${uuid}` : uuid
