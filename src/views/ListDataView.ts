/***************************************************
 * Created by nanyuantingfeng on 2020/6/2 15:10. *
 ***************************************************/
import { getModelType, IIdentifier, IModelConstructor, IType, PureModel, View } from '../datx'
import { action, computed, observable, transaction } from 'mobx'
import { Collection } from '../Collection'
import { IRequestOptions, RESPONSE_DATATYPE } from '../interfaces'
import { ResponseView } from '../ResponseView'
import { error } from '../helpers/utils'

export class ListDataView<T extends PureModel> extends View<T> {
  readonly collection: Collection
  readonly modelType: IType
  private requestOptions?: IRequestOptions = {}

  public isInfiniteMode = false

  @observable isLoading: boolean = false
  @observable meta: { count: number } = { count: 0 }
  @observable limit: [number, number] = [0, 10]

  @computed get data() {
    return this.list
  }
  @computed get hasNext() {
    if (this.meta?.count === undefined) return false
    const [start, count] = this.limit
    return start + count < this.meta.count
  }
  @computed get hasPrev() {
    if (this.meta?.count === undefined) return false
    const [start, count] = this.limit
    return start - count >= 0
  }
  @computed get hasLast() {
    return this.meta?.count > 0
  }

  constructor(modelType: IModelConstructor<T> | IType, collection: Collection, models?: Array<IIdentifier | T>) {
    super(modelType, collection, undefined, models, true)
    this.modelType = getModelType(modelType)
    this.collection = collection
  }

  async infinite(start: number, count: number, options?: IRequestOptions): Promise<ResponseView<T[]>>
  async infinite(options: IRequestOptions): Promise<ResponseView<T[]>>
  @action public async infinite(...args: any[]): Promise<ResponseView<T[]>> {
    this.isInfiniteMode = true

    if (args.length === 1 && typeof args === 'object') {
      return this.search(args[0])
    }

    if (args.length === 2) {
      return this.search({ selector: { limit: args as [number, number] } })
    }

    if (args.length === 3) {
      return this.search({
        ...args[2],
        selector: {
          ...args[2].selector,
          limit: [args[0], args[1]]
        }
      })
    }

    throw error(`infinite() parameter type error`)
  }
  @action public async search(options: IRequestOptions): Promise<ResponseView<T[]>> {
    this.isLoading = true
    const response = await this.collection.fetch<T>(this.modelType, options)
    if (response.dataType !== RESPONSE_DATATYPE.PAGE) {
      throw error(`ListDataView.search must be return "PAGE" response value`)
    }

    this.requestOptions = response.requestOptions
    this.isLoading = false
    transaction(() => {
      if (!this.isInfiniteMode) this.removeAll()
      this.add(response.data)
    })
    this.meta = response.meta as any
    return response
  }

  public first(options?: IRequestOptions): Promise<ResponseView<T[]>> {
    const start = 0
    const count = this.limit[1]
    this.limit = [start, count]
    return this.search({
      ...this.requestOptions,
      selector: {
        ...this.requestOptions.selector,
        limit: [start, count]
      },
      ...options
    })
  }
  public prev(options?: IRequestOptions): Promise<ResponseView<T[]>> {
    if (!this.hasPrev) return null
    let [start, count] = this.limit
    start -= count
    start = start <= 0 ? 0 : start
    this.limit = [start, count]
    return this.search({
      ...this.requestOptions,
      selector: {
        ...this.requestOptions.selector,
        limit: [start, count]
      },
      ...options
    })
  }
  public next(options?: IRequestOptions): Promise<ResponseView<T[]>> {
    if (!this.hasNext) return null

    let [start, count] = this.limit
    start += count
    this.limit = [start, count]
    return this.search({
      ...this.requestOptions,
      selector: {
        ...this.requestOptions.selector,
        limit: [start, count]
      },
      ...options
    })
  }
  public last(options?: IRequestOptions): Promise<ResponseView<T[]>> {
    const [, count] = this.limit
    const start = this.meta.count - count
    this.limit = [start, count]

    return this.search({
      ...this.requestOptions,
      selector: {
        ...this.requestOptions.selector,
        limit: [start, count]
      },
      ...options
    })
  }
}
