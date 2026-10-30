import freeEmailDomains from 'free-email-domains'

const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set(freeEmailDomains)

/** A domain needs at least two non-empty labels, such as `walker.com`. */
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

/**
 * The company website implied by an email: its full domain, lowercased.
 * Free and disposable email providers, such as Gmail, say nothing about the company, so they give none.
 */
export function businessDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null

  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
  if (!DOMAIN.test(domain) || FREE_EMAIL_DOMAINS.has(domain)) return null
  return domain
}
