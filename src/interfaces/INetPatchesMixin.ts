/***************************************************
 * Created by nanyuantingfeng on 2020/6/2 12:56. *
 ***************************************************/
import { IIdentifier, IModelConstructor, IType, PureCollection, PureModel } from '../datx'
import { IRawData, IResponseData } from './IRawData'
import { IRequestOptions } from './IRequestOptions'
import { ResponseView } from '../ResponseView'
import { INetworkAdapter } from './INetworkAdapter'

export interface INetPatchesMixin<T extends PureCollection> {
  adapter: INetworkAdapter
  setNetworkAdapter(adapter: INetworkAdapter): void

  sync<T extends PureModel>(data?: IRawData<object[]>): T[]
  sync<T extends PureModel>(data?: IRawData<object>): T
  sync<T extends PureModel>(type: IModelConstructor<T> | IType, data: object[]): T[]
  sync<T extends PureModel>(type: IModelConstructor<T> | IType, data: object): T

  fetch<T extends PureModel, R = T[]>(
    type: IType | T | IModelConstructor<T>,
    options?: IRequestOptions
  ): Promise<ResponseView<R>>
  fetch<T extends PureModel, R = T[]>(
    type: IType | T | IModelConstructor<T>,
    ids: undefined | null,
    options?: IRequestOptions
  ): Promise<ResponseView<R>>
  fetch<T extends PureModel, R = T>(
    type: IType | T | IModelConstructor<T>,
    id?: IIdentifier,
    options?: IRequestOptions
  ): Promise<ResponseView<R>>
  fetch<T extends PureModel, R = T[]>(
    type: IType | T | IModelConstructor<T>,
    ids?: IIdentifier[],
    options?: IRequestOptions
  ): Promise<ResponseView<R>>

  removeOne(type: IType | typeof PureModel, id: IIdentifier, remote?: boolean | IRequestOptions): Promise<void>
  removeOne(model: PureModel, remote?: boolean | IRequestOptions): Promise<void>

  request<D>(url: string, options: IRequestOptions): Promise<IResponseData<D>>
}
