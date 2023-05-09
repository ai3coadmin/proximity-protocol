import { ClientCore, Context } from "@aragon/sdk-client";
import {
  IClient,
  IClientDecoding,
  IClientEncoding,
  IClientEstimation,
  IClientMethods
} from '@aragon/sdk-client/dist/interfaces';
import {ClientMethods} from '@aragon/sdk-client/dist/internal/client/methods';
import {ClientEncoding} from '@aragon/sdk-client/dist/internal/client/encoding';
import {ClientDecoding} from '@aragon/sdk-client/dist/internal/client/decoding';
import {ClientEstimation} from '@aragon/sdk-client/dist/internal/client/estimation';

export class CustomClient extends ClientCore implements IClient {
  private privateMethods: IClientMethods;
  private privateEncoding: IClientEncoding;
  private privateDecoding: IClientDecoding;
  private privateEstimation: IClientEstimation;

  constructor(context: Context) {
    super(context);
    this.privateMethods = new ClientMethods(context);
    this.privateEncoding = new ClientEncoding(context);
    this.privateDecoding = new ClientDecoding(context);
    this.privateEstimation = new ClientEstimation(context);
    Object.freeze(CustomClient.prototype);
    Object.freeze(this);
  }
  get methods(): IClientMethods {
    return this.privateMethods;
  }
  get encoding(): IClientEncoding {
    return this.privateEncoding;
  }
  get decoding(): IClientDecoding {
    return this.privateDecoding;
  }
  get estimation(): IClientEstimation {
    return this.privateEstimation;
  }
}
