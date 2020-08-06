/***************************************************
 * Created by nanyuantingfeng on 2020/6/2 12:55. *
 ***************************************************/
import { action } from 'mobx'
import { IRawModel, mapItems } from 'datx-utils'
import {
  getModelId,
  getModelType,
  ICollectionConstructor,
  IIdentifier,
  IModelConstructor,
  IType,
  PureCollection,
  PureModel,
  updateModel
} from '../datx'

import { INetPatchesMixin } from '../interfaces/INetPatchesMixin'
import { clearCache, clearCacheByType } from '../helpers/cache'
import { ResponseView } from '../ResponseView'
import { getModelIdField, removeModel } from '../helpers/model'
import { INetworkAdapter, IRequestOptions, IRawResponse, IOneOrMany } from '../interfaces'
import { Model } from '../Model'
import { query, request } from '../helpers/network'
import { ORPHAN_MODEL_ID_KEY, ORPHAN_MODEL_ID_VAL, setModelPersisted } from '../helpers/consts'

export function withNetPatches<T extends PureCollection>(Base: ICollectionConstructor<T>) {
  const BaseClass = Base as typeof PureCollection

  class WithNetPatches extends BaseClass implements INetPatchesMixin<T> {
    static types = BaseClass.types && BaseClass.types.length ? BaseClass.types.concat(Model) : [Model]
    static defaultModel = Model

    adapter: INetworkAdapter

    setNetworkAdapter(adapter: INetworkAdapter) {
      this.adapter = adapter
    }

    @action sync<P extends PureModel>(raw: IOneOrMany<IRawModel>, type: any): P | P[] {
      const modelType = getModelType(type)
      const StaticCollection = this.constructor as typeof PureCollection
      const ModelClass = StaticCollection.types.find((Q) => Q.type === modelType)
      return mapItems(raw, (item: IRawModel) => {
        let record: P

        if (ModelClass) {
          const idField = getModelIdField(ModelClass)

          let id: IIdentifier

          if (idField === ORPHAN_MODEL_ID_KEY) {
            record = this.findOne<P>(modelType, ORPHAN_MODEL_ID_VAL)
          } else {
            id = item[idField]
            record = id === undefined ? null : this.findOne<P>(modelType, id)
          }

          if (record) {
            record = updateModel(record, item)
          } else {
            record = this.add<P>(item, modelType)
          }

          setModelPersisted(record, Boolean(id))
        } else {
          record = (this.add(new Model(item, this)) as any) as P
        }

        return record
      })
    }

    @action fetch<T extends PureModel>(
      type: IType | T | IModelConstructor<T>,
      ids?: any,
      options?: any
    ): Promise<ResponseView<T | T[]>> {
      const modelType = getModelType(type)

      if (arguments.length === 2 && Object.prototype.toString.call(ids) === '[object Object]') {
        options = ids as IRequestOptions
        ids = undefined
      }

      return query<T>(modelType, options, this, undefined, ids).then((res) => {
        if (res.error) {
          throw res.error
        }
        return res
      })
    }

    @action removeOne(
      obj: IType | typeof PureModel | PureModel,
      id?: IIdentifier | boolean | IRequestOptions,
      remote?: boolean | IRequestOptions
    ): Promise<void> {
      const remove = typeof id === 'boolean' || typeof id === 'object' ? id : remote
      let modelId: number | string | undefined

      if (typeof id === 'string' || typeof id === 'number') {
        modelId = id
      } else if (typeof id === 'boolean' || obj instanceof PureModel) {
        modelId = getModelId(obj)
      }

      const type = getModelType(obj)
      const model = modelId !== undefined && this.findOne(type, modelId)

      if (model && modelId !== undefined && getModelId(model) !== modelId) {
        // The model is not in the collection, we shouldn't remove it
        return Promise.resolve()
      }

      if (model && remove) {
        return removeModel(model, typeof remove === 'object' ? remove : undefined)
      }

      if (model) {
        super.removeOne(model)
      }

      clearCacheByType(type)
      return Promise.resolve()
    }

    @action removeAll(type: string | number | typeof PureModel) {
      super.removeAll(type)
      clearCacheByType(getModelType(type))
    }

    @action reset() {
      super.reset()
      clearCache()
    }

    @action request<D>(url: string, options: IRequestOptions): Promise<IRawResponse<D>> {
      return request<D>(this as any, url, options)
    }
  }

  return (WithNetPatches as unknown) as ICollectionConstructor<INetPatchesMixin<T> & T> & {
    cache: boolean
  }
}
