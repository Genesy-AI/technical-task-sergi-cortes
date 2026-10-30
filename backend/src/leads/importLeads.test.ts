import { describe, expect, it } from 'vitest'
import { buildImport } from './importLeads'

const row = (overrides: Record<string, string> = {}) => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'Engineer',
  companyName: 'Acme',
  countryCode: 'GB',
  ...overrides,
})

const plan = (rows: Record<string, unknown>[], existing: string[] = []) =>
  buildImport(rows, new Set(existing))

describe('buildImport', () => {
  describe('column mapping', () => {
    it('maps the sample file headers, including phone and years in role', () => {
      const { leads } = plan([
        {
          firstName: 'Chad',
          lastName: 'Smith',
          email: 'hancockjames@gmail.com',
          jobTitle: 'Child psychotherapist',
          countryCode: 'TV',
          companyName: 'Global Tech Solutions',
          yearsInRole: '2',
          phoneNumber: '+1-280-754-0462x2154',
        },
      ])

      expect(leads[0]).toMatchObject({
        phone: '+1-280-754-0462x2154',
        jobTitle: 'Child psychotherapist',
        yearsInRole: 2,
        yearsAtCompany: 2,
      })
    })

    it('accepts header variants by ignoring case, spaces, and punctuation, plus aliases', () => {
      const { leads } = plan([
        {
          'First Name': 'Ada',
          last_name: 'Lovelace',
          EMAIL: 'ada@acme.com',
          Phone: '555-0100-123',
          'LinkedIn Profile': 'linkedin.com/in/ada',
          'Years In Role': '3',
        },
      ])

      expect(leads[0]).toMatchObject({
        firstName: 'Ada',
        phone: '555-0100-123',
        linkedinUrl: 'https://www.linkedin.com/in/ada',
        yearsInRole: 3,
      })
    })

    it('ignores unrecognized columns', () => {
      const { leads } = plan([row({ favouriteColour: 'green' })])

      expect(leads[0]).not.toHaveProperty('favouriteColour')
    })
  })

  describe('grouping rows into people', () => {
    it('imports rows sharing an email as one lead with roles in file order', () => {
      const { leads } = plan([
        row({ jobTitle: 'Engineer', yearsInRole: '3' }),
        row({ email: ' ADA@acme.com ', jobTitle: 'Eng. Manager', yearsInRole: '2' }),
      ])

      expect(leads).toHaveLength(1)
      expect(leads[0].roles.map((r) => r.jobTitle)).toEqual(['Engineer', 'Eng. Manager'])
      expect(leads[0].rowNumbers).toEqual([1, 2])
    })

    it('keeps different people with the same name apart', () => {
      const { leads } = plan([
        row({ firstName: 'Curtis', lastName: 'Monson', email: 'curtis1@example.com' }),
        row({ firstName: 'Curtis', lastName: 'Monson', email: 'curtis2@example.com' }),
      ])

      expect(leads).toHaveLength(2)
    })

    it('merges identical rows for one person into one role with a note', () => {
      const { leads } = plan([row({ yearsInRole: '5' }), row({ yearsInRole: '5' })])

      expect(leads[0].roles).toHaveLength(1)
      expect(leads[0].yearsAtCompany).toBe(5)
      expect(leads[0].notes).toContainEqual(
        expect.objectContaining({ rowNumber: 2, message: 'Same role as row 1, merged' })
      )
    })
  })

  describe('current role', () => {
    it('is the last role in file order by default', () => {
      const { leads } = plan([row({ jobTitle: 'Engineer' }), row({ jobTitle: 'Eng. Manager' })])

      expect(leads[0].jobTitle).toBe('Eng. Manager')
      expect(leads[0].roles.map((r) => r.isCurrent)).toEqual([false, true])
    })

    it('is the row marked by isCurrentRole', () => {
      const { leads } = plan([
        row({ jobTitle: 'Engineer', isCurrentRole: 'yes' }),
        row({ jobTitle: 'Eng. Manager' }),
      ])

      expect(leads[0].jobTitle).toBe('Engineer')
      expect(leads[0].roles.map((r) => r.isCurrent)).toEqual([true, false])
    })

    it('is the last marked row when several are marked, with a note', () => {
      const { leads } = plan([
        row({ jobTitle: 'Engineer', isCurrentRole: 'true' }),
        row({ jobTitle: 'Eng. Manager', isCurrentRole: 'true' }),
      ])

      expect(leads[0].jobTitle).toBe('Eng. Manager')
      expect(leads[0].notes).toContainEqual(
        expect.objectContaining({
          field: 'isCurrentRole',
          message: 'Several rows are marked as current; using row 2',
        })
      )
    })
  })

  describe('years at company', () => {
    it('sums years over roles at the current company only', () => {
      const { leads } = plan([
        row({ companyName: 'Globex', jobTitle: 'Analyst', yearsInRole: '4' }),
        row({ companyName: 'Acme', jobTitle: 'Engineer', yearsInRole: '3' }),
        row({ companyName: 'acme ', jobTitle: 'Eng. Manager', yearsInRole: '2' }),
      ])

      expect(leads[0].companyName).toBe('acme')
      expect(leads[0].yearsAtCompany).toBe(5)
    })

    it('is blank when no role at the current company has years', () => {
      const { leads } = plan([row({ yearsInRole: '' })])

      expect(leads[0].yearsAtCompany).toBeNull()
    })
  })

  describe('person-level values', () => {
    it('takes the first non-blank value and notes a conflict', () => {
      const { leads } = plan([
        row({ phoneNumber: '' }),
        row({ jobTitle: 'Eng. Manager', phoneNumber: '555-0100-123' }),
        row({ jobTitle: 'Director', phoneNumber: '555-0199-456' }),
      ])

      expect(leads[0].phone).toBe('555-0100-123')
      expect(leads[0].notes).toContainEqual(
        expect.objectContaining({
          rowNumber: 3,
          field: 'phone',
          message: 'Different phone 555-0199-456 ignored; using 555-0100-123 from row 2',
        })
      )
    })
  })

  describe('invalid values', () => {
    it('imports the row with the value blank and a note', () => {
      const { leads } = plan([
        row({ linkedinUrl: 'https://example.com/in/ada', yearsInRole: 'ten', phoneNumber: '12-34' }),
      ])

      expect(leads[0]).toMatchObject({ linkedinUrl: null, yearsInRole: null, phone: null })
      expect(leads[0].notes.map((n) => n.message)).toEqual(
        expect.arrayContaining([
          'https://example.com/in/ada is not a LinkedIn profile URL',
          'ten is not a whole number of years from 0 to 80',
          '12-34 has fewer than 7 digits',
        ])
      )
    })

    it('converts countries and notes the conversion', () => {
      const { leads } = plan([row({ countryCode: 'ESP' }), row({ email: 'b@acme.com', countryCode: 'XXX' })])

      expect(leads.map((l) => l.countryCode)).toEqual(['ES', null])
      expect(leads[0].notes).toContainEqual(
        expect.objectContaining({ field: 'countryCode', message: 'Converted from ESP' })
      )
      expect(leads[1].notes).toContainEqual(
        expect.objectContaining({ field: 'countryCode', message: 'XXX is not a recognized country' })
      )
    })
  })

  describe('invalid rows', () => {
    it('excludes rows missing a required field or with a malformed email, with reasons', () => {
      const result = plan([
        row({ lastName: '' }),
        row({ email: 'invalid email' }),
        row({ firstName: '', email: '' }),
        row({ email: 'ok@acme.com' }),
      ])

      expect(result.leads.map((l) => l.email)).toEqual(['ok@acme.com'])
      expect(result.invalidRows).toEqual([
        expect.objectContaining({ rowNumber: 1, errors: ['Last name is required'] }),
        expect.objectContaining({ rowNumber: 2, errors: ['Invalid email format'] }),
        expect.objectContaining({ rowNumber: 3, errors: ['First name is required', 'Email is required'] }),
      ])
      expect(result.totalRows).toBe(4)
    })

    it('skips completely blank rows without counting them', () => {
      const result = plan([row(), { firstName: '', lastName: '', email: '' }])

      expect(result.totalRows).toBe(1)
      expect(result.invalidRows).toEqual([])
    })
  })

  describe('existing leads', () => {
    it('marks a person whose email already exists as a duplicate, ignoring case', () => {
      const { leads } = plan([row({ email: 'ADA@acme.com' })], ['ada@acme.com'])

      expect(leads[0].status).toBe('duplicate')
    })

    it('marks other people as new even when their name exists', () => {
      const { leads } = plan([row({ email: 'another.ada@acme.com' })], ['ada@acme.com'])

      expect(leads[0].status).toBe('new')
    })
  })
})
