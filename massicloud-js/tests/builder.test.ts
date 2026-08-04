import { describe, it, expect } from 'vitest'
import { QueryBuilder } from '../src/rest/builder'
import { serializeFilter } from '../src/rest/filters'

const ctx = {
  url: 'https://api.example.com/v1/proj/production/db/main/rest',
  key: 'mc_anon_test',
  table: 'todos',
  fetcher: globalThis.fetch,
  getAccessToken: async () => null,
}

function builder() {
  return new QueryBuilder(ctx)
}

describe('QueryBuilder.buildURL()', () => {
  it('returns bare table URL with no filters', () => {
    const b = builder().select('*')
    expect(b.buildURL()).toBe(
      'https://api.example.com/v1/proj/production/db/main/rest/todos',
    )
  })

  it('appends eq filter', () => {
    expect(builder().select('*').eq('id', 5).buildURL()).toContain('id=eq.5')
  })

  it('appends neq filter', () => {
    expect(builder().select('*').neq('status', 'inactive').buildURL()).toContain(
      'status=neq.inactive',
    )
  })

  it('appends gt / gte / lt / lte', () => {
    const url = builder().select('*').gte('price', 100).lte('price', 500).buildURL()
    expect(url).toContain('price=gte.100')
    expect(url).toContain('price=lte.500')
  })

  it('appends like filter', () => {
    expect(builder().select('*').like('name', '%ali%').buildURL()).toContain(
      'name=like.%25ali%25',
    )
  })

  it('appends ilike filter', () => {
    expect(builder().select('*').ilike('email', '%@massicloud%').buildURL()).toContain(
      'email=ilike.',
    )
  })

  it('appends in filter with array serialization', () => {
    const url = builder().select('*').in('status', ['active', 'pending']).buildURL()
    expect(url).toContain('status=in.')
    expect(url).toContain('active')
    expect(url).toContain('pending')
  })

  it('appends is null filter', () => {
    expect(builder().select('*').is('deleted_at', null).buildURL()).toContain(
      'deleted_at=is.null',
    )
  })

  it('appends order ascending', () => {
    expect(
      builder().select('*').order('created_at', { ascending: true }).buildURL(),
    ).toContain('order=created_at.asc')
  })

  it('appends order descending', () => {
    expect(
      builder().select('*').order('created_at', { ascending: false }).buildURL(),
    ).toContain('order=created_at.desc')
  })

  it('appends limit', () => {
    expect(builder().select('*').limit(20).buildURL()).toContain('limit=20')
  })

  it('appends offset', () => {
    expect(builder().select('*').offset(40).buildURL()).toContain('offset=40')
  })

  it('appends select columns when not *', () => {
    expect(builder().select('id,title,created_at').buildURL()).toContain(
      'select=id%2Ctitle%2Ccreated_at',
    )
  })

  it('does not append select=* to URL', () => {
    expect(builder().select('*').buildURL()).not.toContain('select=')
  })

  it('chains multiple filters', () => {
    const url = builder()
      .select('*')
      .eq('user_id', 'u1')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(10)
      .buildURL()
    expect(url).toContain('user_id=eq.u1')
    expect(url).toContain('published=eq.true')
    expect(url).toContain('order=created_at.desc')
    expect(url).toContain('limit=10')
  })
})

describe('serializeFilter()', () => {
  it('serializes eq', () => {
    expect(serializeFilter({ column: 'id', operator: 'eq', value: 1 })).toEqual(['id', 'eq.1'])
  })

  it('serializes null value', () => {
    expect(serializeFilter({ column: 'col', operator: 'is', value: null })).toEqual([
      'col',
      'is.null',
    ])
  })

  it('serializes in with array', () => {
    const [col, val] = serializeFilter({ column: 'x', operator: 'in', value: [1, 2, 3] })
    expect(col).toBe('x')
    expect(val).toBe('in.(1,2,3)')
  })

  it('wraps string values with commas in quotes', () => {
    const [, val] = serializeFilter({ column: 'x', operator: 'eq', value: 'a,b' })
    expect(val).toBe('eq."a,b"')
  })
})
