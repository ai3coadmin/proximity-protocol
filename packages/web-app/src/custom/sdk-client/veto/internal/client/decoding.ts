import {bytesToHex} from '@aragon/sdk-common';
import {
  ClientCore,
  ContextPlugin,
  decodeUpdatePluginSettingsAction,
  getFunctionFragment,
  IInterfaceParams,
  VotingSettings,
} from '@aragon/sdk-client';
import {AVAILABLE_FUNCTION_SIGNATURES} from '../constants';
import {IMintTokenParams, IVetoClientDecoding} from '../../interfaces';
import {IERC20MintableUpgradeable__factory} from '@aragon/osx-ethers';
import {mintTokenParamsFromContract} from '../utils';

/**
 * Decoding module the SDK Veto Client
 */
export class VetoClientDecoding
  extends ClientCore
  implements IVetoClientDecoding
{
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(VetoClientDecoding.prototype);
    Object.freeze(this);
  }
  /**
   * Decodes a dao metadata from an encoded update metadata action
   *
   * @param {Uint8Array} data
   * @return {*}  {VotingSettings}
   * @memberof VetoClientDecoding
   */
  public updatePluginSettingsAction(data: Uint8Array): VotingSettings {
    return decodeUpdatePluginSettingsAction(data);
  }
  /**
   * Decodes the mint token params from an encoded mint token action
   *
   * @param {Uint8Array} data
   * @return {*}  {IMintTokenParams}
   * @memberof VetoClientDecoding
   */
  public mintTokenAction(data: Uint8Array): IMintTokenParams {
    const votingInterface =
      IERC20MintableUpgradeable__factory.createInterface();
    const hexBytes = bytesToHex(data);
    const expectedfunction = votingInterface.getFunction('mint');
    const result = votingInterface.decodeFunctionData(
      expectedfunction,
      hexBytes
    );
    return mintTokenParamsFromContract(result);
  }
  /**
   * Returns the decoded function info given the encoded data of an action
   *
   * @param {Uint8Array} data
   * @return {*}  {(IInterfaceParams | null)}
   * @memberof VetoClientDecoding
   */
  public findInterface(data: Uint8Array): IInterfaceParams | null {
    try {
      const func = getFunctionFragment(data, AVAILABLE_FUNCTION_SIGNATURES);
      return {
        id: func.format('minimal'),
        functionName: func.name,
        hash: bytesToHex(data).substring(0, 10),
      };
    } catch {
      return null;
    }
  }
}
