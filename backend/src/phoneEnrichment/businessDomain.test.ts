import { describe, expect, it } from 'vitest'
import { businessDomain } from './businessDomain'

describe('businessDomain', () => {
  it.each([
    ['pamela26@walker.com', 'walker.com'],
    ['Ada@Sub.Example.CO.UK', 'sub.example.co.uk'],
    ['  grace@navy.mil  ', 'navy.mil'],
  ])('uses the full domain of %j', (email, domain) => {
    expect(businessDomain(email)).toBe(domain)
  })

  it.each(['ada@gmail.com', 'ada@GMAIL.com', 'ada@yahoo.co.uk', 'ada@hotmail.es', 'ada@proton.me'])(
    'has none for the free email address %j',
    (email) => {
      expect(businessDomain(email)).toBeNull()
    }
  )

  it.each(['', 'no-at-sign', 'ada@', 'ada@localhost', 'ada@.com', 'ada@example.'])(
    'has none for the malformed address %j',
    (email) => {
      expect(businessDomain(email)).toBeNull()
    }
  )
})
