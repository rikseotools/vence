// app/api/email-unsubscribe/route.ts
// Legacy HMAC-based unsubscribe endpoint — redirects to profile email settings.
// Old emails may still contain links to this endpoint, so we keep it as a redirect
// rather than returning a 404.

import { NextResponse } from 'next/server'

const REDIRECT_URL = 'https://www.vence.es/perfil?tab=emails&from=old_unsubscribe'

export async function GET() {
  // Old HMAC tokens are no longer valid. Redirect users to their profile
  // where they can manage email preferences after logging in.
  return NextResponse.redirect(REDIRECT_URL, 302)
}
