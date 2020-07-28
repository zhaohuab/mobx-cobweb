/***************************************************
 * Created by nanyuantingfeng on 2020/6/2 12:36. *
 ***************************************************/
import { IModelConstructor, PureCollection, PureModel } from '../datx'
import { IRawModel } from 'datx-utils'
import { INetActionsMixin } from '../interfaces/INetActionsMixin'
import { IRequestOptions } from '../interfaces'
import { fetchModelRef, fetchModelRefs, removeModel, saveModel } from '../helpers/model'
import { action } from 'mobx'

export function withNetActions<T extends PureModel>(Base: IModelConstructor<T>) {
  const BaseClass = Base as typeof PureModel

  class WithNetActions extends BaseClass implements INetActionsMixin<T> {
    static endpoint: string | (() => string)

    constructor(rawData: IRawModel, collection?: PureCollection) {
      super(rawData, collection)
    }

    @action public save(options?: IRequestOptions): Promise<this> {
      return saveModel(this, options)
    }
    @action public remove(options?: IRequestOptions): Promise<void> {
      return removeModel(this, options)
    }

    @action public fetchRef(field: string, options?: IRequestOptions) {
      return fetchModelRef(this, field, options)
    }

    @action public fetchRefs(options?: IRequestOptions) {
      return fetchModelRefs(this, options)
    }
  }

  return (WithNetActions as unknown) as IModelConstructor<INetActionsMixin<T> & T> & {
    endpoint: string | (() => string)
  }
}
