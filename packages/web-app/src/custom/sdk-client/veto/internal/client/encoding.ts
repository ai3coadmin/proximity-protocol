import {
  hexToBytes,
  InvalidAddressError,
  UnsupportedNetworkError,
} from '@aragon/sdk-common';
import {
  ClientCore,
  ContextPlugin,
  DaoAction,
  encodeUpdateVotingSettingsAction,
  IPluginInstallItem,
  SupportedNetworks,
  SupportedNetworksArray,
  VotingSettings,
} from '@aragon/sdk-client';
import {isAddress} from '@ethersproject/address';
import {
  IMintTokenParams,
  IVetoClientEncoding,
  IVetoPluginInstall,
} from '../../interfaces';
import {IERC20MintableUpgradeable__factory} from '@aragon/osx-ethers';
import {
  mintTokenParamsToContract,
  tokenVotingInitParamsToContract,
} from '../utils';
import {defaultAbiCoder} from '@ethersproject/abi';
import {LIVE_CONTRACTS} from '@aragon/sdk-client';

/**
 * Encoding module the SDK Veto Client
 */
export class VetoClientEncoding
  extends ClientCore
  implements IVetoClientEncoding
{
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(VetoClientEncoding.prototype);
    Object.freeze(this);
  }
  /**
   * Computes the parameters to be given when creating the DAO,
   * so that the plugin is configured
   *
   * @param {IVetoPluginInstall} params
   * @param {SupportedNetworks} network
   * @return {*}  {IPluginInstallItem}
   * @memberof VetoClientEncoding
   */
  static getPluginInstallItem(
    params: IVetoPluginInstall,
    network: SupportedNetworks
  ): IPluginInstallItem {
    if (!SupportedNetworksArray.includes(network)) {
      throw new UnsupportedNetworkError(network);
    }
    const args = tokenVotingInitParamsToContract(params);
    const hexBytes = defaultAbiCoder.encode(
      // ["votingMode","supportThreshold", "minParticipation", "minDuration"], ["address","name","symbol"][ "receivers","amount"]
      [
        'address',
        'tuple(uint8 votingMode, uint64 supportThreshold, uint64 minParticipation, uint64 minDuration, uint256 minProposerVotingPower) votingSettings',
      ],
      args
    );
    return {
      id: import.meta.env.VITE_VETO_PLUGIN_ADDRESS,
      data: hexToBytes(hexBytes),
    };
  }
  /**
   * Computes the parameters to be given when creating a proposal that updates the governance configuration
   *
   * @param {string} pluginAddress
   * @param {VotingSettings} params
   * @return {*}  {DaoAction}
   * @memberof VetoClientEncoding
   */
  public updatePluginSettingsAction(
    pluginAddress: string,
    params: VotingSettings
  ): DaoAction {
    if (!isAddress(pluginAddress)) {
      throw new Error('Invalid plugin address');
    }
    // TODO: check if to and value are correct
    return {
      to: pluginAddress,
      value: BigInt(0),
      data: encodeUpdateVotingSettingsAction(params),
    };
  }

  /**
   * Computes the parameters to be given when creating a proposal that mints an amount of ERC-20 tokens to an address
   *
   * @param {string} minterAddress
   * @param {IMintTokenParams} params
   * @return {*}  {DaoAction}
   * @memberof VetoClientEncoding
   */
  public mintTokenAction(
    minterAddress: string,
    params: IMintTokenParams
  ): DaoAction {
    if (!isAddress(minterAddress) || !isAddress(params.address)) {
      throw new InvalidAddressError();
    }
    const votingInterface =
      IERC20MintableUpgradeable__factory.createInterface();
    const args = mintTokenParamsToContract(params);
    // get hex bytes
    const hexBytes = votingInterface.encodeFunctionData('mint', args);
    return {
      to: minterAddress,
      value: BigInt(0),
      data: hexToBytes(hexBytes),
    };
  }
}
