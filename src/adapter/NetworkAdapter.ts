/***************************************************
 * Created by nanyuantingfeng on 2019/11/28 17:24. *
 ***************************************************/
import { IIdentifier } from '../datx'
import { INetworkAdapter, IRequestMethod, IRequestOptions, IRawResponse, IOneOrMany, $ElementType } from '../interfaces'
import { error, isBrowser, isEmptyObject } from '../helpers/utils'
import { isArrayLike } from 'mobx'

function appendParams(url: string, qs: string): string {
  let newUrl = url
  if (qs && qs.length) {
    const separator = newUrl.indexOf('?') === -1 ? '?' : '&'
    newUrl += separator + qs
  }
  return newUrl
}

interface IQueryParamOrder {
  value: string
  order: 'ASC' | 'DESC'
}

interface IQueryParamLimit {
  start: number
  count: number
}

interface IQueryParams {
  orderBy?: IQueryParamOrder[]
  limit?: IQueryParamLimit
  filterBy?: string
  select?: string
}

type ISelector = $ElementType<IRequestOptions, 'selector'>

const URL_REGEX = /^(?:http(s)?:\/\/)[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=]+$/

export class NetworkAdapter implements INetworkAdapter {
  private readonly baseUrl: string
  private readonly fetchInstance: typeof fetch
  protected defaultFetchOptions: any = { headers: { 'content-type': 'application/json' } }

  constructor(baseUrl: string)
  constructor(baseUrl: string, fetchInstance?: typeof fetch)
  constructor(baseUrl: string, options?: Partial<{ params: any; headers: any }>)
  constructor(baseUrl: string, fetchInstance?: typeof fetch, options?: Partial<{ params: any; headers: any }>)
  constructor(baseUrl: string, fetchInstance?: any, options?: any) {
    this.baseUrl = baseUrl

    if (fetchInstance && typeof fetchInstance !== 'function') {
      options = fetchInstance
      fetchInstance = undefined
    }

    this.fetchInstance = fetchInstance
    this.defaultFetchOptions = Object.assign({}, this.defaultFetchOptions, options)

    if (!isBrowser && !fetchInstance) {
      throw error('Fetch reference needs to be defined before using the network')
    }

    if (isBrowser && !fetchInstance) {
      this.fetchInstance = window.fetch.bind(window)
    }
  }

  public prepare(props: {
    endpoint: string
    ids?: IOneOrMany<IIdentifier>
    options?: IRequestOptions
    method?: IRequestMethod
  }): { url: string; options?: any; cacheKey?: string } {
    const options = props.options || {}

    const url = this.prepareURL(props.endpoint, props.ids, options.action)
    const { headers: defaultHeaders, params: defaultParams, ...defaultOthers } = this.defaultFetchOptions

    const fixedURL = appendParams(url, this.prepareQS(Object.assign({}, defaultParams, options.params)))

    const requestHeaders: Record<string, string> = options.headers || {}
    let uppercaseMethod = options.method?.toUpperCase() || props.method?.toUpperCase()
    let body = options.data as object
    let cacheKey
    let selectBody

    if (options.selector) {
      selectBody = this.prepareSelector(options.selector)
      body = { ...body, ...selectBody }
    }

    if (uppercaseMethod === 'GET') {
      if (!isEmptyObject(selectBody)) {
        // If it's a `selector` call, switch to the `POST` procedure
        // to ensure the parameter integrity of the `body`
        uppercaseMethod = 'POST'
      }
      cacheKey = `${fixedURL}@@${body ? JSON.stringify(body) : ''}`
    }

    const isBodySupported = uppercaseMethod !== 'GET' && uppercaseMethod !== 'HEAD'
    const reqHeaders: Record<string, string> = Object.assign({}, defaultHeaders, requestHeaders)
    const optionsO = Object.assign({}, defaultOthers, {
      body: (isBodySupported && JSON.stringify(body)) || undefined,
      headers: reqHeaders,
      method: uppercaseMethod
    })

    return { url: fixedURL, options: optionsO, cacheKey }
  }
  public async fetch(url: string, options: any): Promise<IRawResponse<any | void>> {
    let status: number
    let headers: Headers
    const requestHeaders = options.headers
    try {
      let responseData: any
      try {
        const response = await this.fetchInstance(url, options)
        status = response.status
        headers = response.headers
        responseData = await response.json()
      } catch (error) {
        if (status === 204) {
          responseData = null
        }
        throw error
      }

      const result: IRawResponse = {}

      result.status = status
      result.headers = headers
      result.requestHeaders = requestHeaders

      if ('value' in responseData) {
        result.data = responseData.value
      } else if ('items' in responseData && isArrayLike(responseData.items)) {
        result.data = responseData.items
        result.meta = { count: responseData.count }
      } else {
        throw responseData
      }

      if (status >= 400) {
        throw { message: `Invalid HTTP status: ${status}`, status }
      }

      return result
    } catch (error) {
      return this.onError({ error, headers, requestHeaders, status })
    }
  }

  onError(error: IRawResponse<void>) {
    return error
  }

  protected prepareFilters(filters: $ElementType<$ElementType<IRequestOptions, 'selector'>, 'filters'>): string {
    if (!filters) return undefined
    const filters2 = isArrayLike(filters) ? filters : [filters]
    return filters2.join('&&')
  }
  protected prepareOrders(orders?: $ElementType<ISelector, 'orders'>): IQueryParamOrder[] {
    if (!orders) return undefined
    return orders.map((key) => {
      let oo = { value: key, order: 'ASC' }
      if (key.endsWith('!')) {
        oo = { value: key.slice(0, -1), order: 'DESC' }
      }
      return oo
    }) as IQueryParamOrder[]
  }
  protected prepareSelect(select: $ElementType<ISelector, 'select'>): string {
    if (!select) return undefined
    if (typeof select === 'string') return select

    return select
      .map((k) => {
        if (k === '...') {
          return '`...`'
        }
        if (isArrayLike(k)) {
          return `${k.shift()}(${this.prepareSelect(k)})`
        }
        return k
      })
      .join(',')
  }
  protected prepareLimit(limit: $ElementType<ISelector, 'limit'>): IQueryParamLimit {
    if (!limit) return undefined
    return { start: limit[0], count: limit[1] }
  }
  protected prepareURL(endpoint: string, ids?: IOneOrMany<IIdentifier>, action?: string | ((url: string) => string)) {
    let url = endpoint
    if (ids != undefined) url += isArrayLike(ids) ? `/[${ids.join(',')}]` : `/\$${ids}`
    const baseURL = this.baseUrl
    if (!action) action = ''

    let oo: string
    if (typeof action === 'string') {
      oo = URL_REGEX.test(url) ? `${url}///${action}` : `${baseURL}///${url}///${action}`
      oo = oo.replace(/[/]{3,}/g, '/')
      if (oo.endsWith('/')) oo = oo.slice(0, -1)
    } else if (typeof action === 'function') {
      oo = URL_REGEX.test(url) ? `${url}` : `${baseURL}///${url}`
      oo = oo.replace(/[/]{3,}/g, '/')
      oo = action(oo)
    }
    return oo
  }
  protected prepareQS(params: $ElementType<IRequestOptions, 'params'>): string {
    if (!params) return undefined
    return Object.keys(params)
      .map((k) => `${k}=${params[k]}`)
      .join('&')
  }
  protected prepareSelector(selector: ISelector): IQueryParams {
    return {
      filterBy: this.prepareFilters(selector.filters),
      orderBy: this.prepareOrders(selector.orders),
      select: this.prepareSelect(selector.select),
      limit: this.prepareLimit(selector.limit)
    }
  }
}
