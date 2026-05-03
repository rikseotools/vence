// app/admin/notificaciones/page.js
// Redirect: el hub mixto push+email fue eliminado al retirar push notifications
// (decision producto 2026-05-03 — usuarios prefieren emails). El subpath
// /admin/notificaciones/email sigue activo con todas las analytics email.
import { redirect } from 'next/navigation'

export default function AdminNotificacionesRedirect() {
  redirect('/admin/notificaciones/email')
}
