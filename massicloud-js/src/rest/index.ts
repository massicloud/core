import { QueryBuilder } from './builder'

interface RESTOptions {
  url: string    // base URL including /db/{db}
  key: string
  fetcher: typeof fetch
  getAccessToken: () => Promise<string | null>
}

export class RESTClient {
  constructor(private opts: RESTOptions) {}

  from<T = unknown>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>({
      url: `${this.opts.url}/rest`,
      key: this.opts.key,
      table,
      fetcher: this.opts.fetcher,
      getAccessToken: this.opts.getAccessToken,
    })
  }
}
