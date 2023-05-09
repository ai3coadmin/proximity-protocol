import {
  IVetoClient,
  IVetoClientDecoding,
  IVetoClientEncoding,
  IVetoClientEstimation,
  IVetoClientMethods,
  IVetoPluginInstall,
} from './interfaces';
import {VetoClientMethods} from './internal/client/methods';
import {VetoClientEncoding} from './internal/client/encoding';
import {VetoClientDecoding} from './internal/client/decoding';
import {VetoClientEstimation} from './internal/client/estimation';
import {
  SupportedNetworks,
  ClientCore,
  ContextPlugin,
  IPluginInstallItem,
} from '@aragon/sdk-client';

/**
 * Provider a generic client with high level methods to manage and interact a Token Voting plugin installed in a DAO
 */
export class VetoClient extends ClientCore implements IVetoClient {
  private privateMethods: IVetoClientMethods;
  private privateEncoding: IVetoClientEncoding;
  private privateDecoding: IVetoClientDecoding;
  private privateEstimation: IVetoClientEstimation;

  constructor(context: ContextPlugin) {
    super(context);
    this.privateMethods = new VetoClientMethods(context);
    this.privateEncoding = new VetoClientEncoding(context);
    this.privateDecoding = new VetoClientDecoding(context);
    this.privateEstimation = new VetoClientEstimation(context);
    Object.freeze(VetoClient.prototype);
    Object.freeze(this);
  }
  get methods(): IVetoClientMethods {
    return this.privateMethods;
  }
  get encoding(): IVetoClientEncoding {
    return this.privateEncoding;
  }
  get decoding(): IVetoClientDecoding {
    return this.privateDecoding;
  }
  get estimation(): IVetoClientEstimation {
    return this.privateEstimation;
  }

  static encoding = {
    /**
     * Computes the parameters to be given when creating the DAO,
     * so that the plugin is configured
     *
     * @param {IVetoPluginInstall} params
     * @param {SupportedNetworks} [network="mainnet"]
     * @return {*}  {IPluginInstallItem}
     * @memberof VetoClient
     */
    getPluginInstallItem: (
      params: IVetoPluginInstall,
      network: SupportedNetworks = 'matic'
    ): IPluginInstallItem =>
      VetoClientEncoding.getPluginInstallItem(params, network),
  };
}
