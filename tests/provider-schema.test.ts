import { describe, it, expect } from 'vitest'
import { createProviderSchema } from '../shared/admin-schema'

describe('createProviderSchema', () => {
  it('accepts firstName and lastName and constructs combined name', () => {
    const input = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '08012345678', password: 'secret123', categories: ['plumbing'] }
    const parsed = createProviderSchema.parse(input)
    expect(parsed.firstName).toBe('Jane')
    expect(parsed.lastName).toBe('Doe')
  })

  it('rejects when firstName missing', () => {
    const input = { lastName: 'Doe', email: 'jane@example.com', phone: '08012345678', password: 'secret123' }
    expect(() => createProviderSchema.parse(input)).toThrow()
  })
})
