/**
 * Detects whether a law is "virtual" (not real legislation, just a question container).
 * Virtual laws have "ficticia" or "virtual" in their description.
 * Examples: Informática Básica, Windows 11, Excel, Word, Access, Outlook.
 */
export function isVirtualLaw(description: string | null | undefined): boolean {
  if (!description) return false
  const lower = description.toLowerCase()
  return lower.includes('ficticia') || lower.includes('virtual')
}
