import {VetoPlugin__factory} from './VetoPlugin__factory';
import {
  ClientCore,
  ContextPlugin,
  GasFeeEstimation,
  CreateMajorityVotingProposalParams,
  IVoteProposalParams,
} from '@aragon/sdk-client';
import {IVetoClientEstimation} from '../../interfaces';
import {toUtf8Bytes} from '@ethersproject/strings';
import {
  boolArrayToBitmap,
  decodeProposalId,
  NoProviderError,
  NoSignerError,
} from '@aragon/sdk-common';
/**
 * Estimation module the SDK Veto Client
 */
export class VetoClientEstimation
  extends ClientCore
  implements IVetoClientEstimation
{
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(VetoClientEstimation.prototype);
    Object.freeze(this);
  }
  /**
   * Estimates the gas fee of creating a proposal on the plugin
   *
   * @param {CreateMajorityVotingProposalParams} params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof VetoClientEstimation
   */
  public async createProposal(
    params: CreateMajorityVotingProposalParams
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }

    const tokenVotingContract = VetoPlugin__factory.connect(
      params.pluginAddress,
      signer
    );

    if (
      params.failSafeActions?.length &&
      params.failSafeActions.length !== params.actions?.length
    ) {
      throw new Error(
        'Size mismatch: actions and failSafeActions should match'
      );
    }
    const allowFailureMap = boolArrayToBitmap(params.failSafeActions);

    const startTimestamp = params.startDate?.getTime() || 0;
    const endTimestamp = params.endDate?.getTime() || 0;

    const estimatedGasFee =
      await tokenVotingContract.estimateGas.createProposal(
        toUtf8Bytes(params.metadataUri),
        params.actions || [],
        allowFailureMap,
        Math.round(startTimestamp / 1000),
        Math.round(endTimestamp / 1000),
        params.creatorVote || 0,
        params.executeOnPass || false
      );
    return this.web3.getApproximateGasFee(estimatedGasFee.toBigInt());
  }
  /**
   * Estimates the gas fee of casting a vote on a proposal
   *
   * @param {IVoteProposalParams} params
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof VetoClientEstimation
   */
  public async voteProposal(
    params: IVoteProposalParams
  ): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }

    const {pluginAddress, id} = decodeProposalId(params.proposalId);

    const tokenVotingContract = VetoPlugin__factory.connect(
      pluginAddress,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signer
    );

    const estimation = await tokenVotingContract.estimateGas.vote(
      id,
      params.vote,
      false
    );
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }

  /**
   * Estimates the gas fee of executing a Veto proposal
   *
   * @param {string} proposalId
   * @return {*}  {Promise<GasFeeEstimation>}
   * @memberof VetoClientEstimation
   */
  public async executeProposal(proposalId: string): Promise<GasFeeEstimation> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }

    const {pluginAddress, id} = decodeProposalId(proposalId);

    const tokenVotingContract = VetoPlugin__factory.connect(
      pluginAddress,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signer
    );
    const estimation = await tokenVotingContract.estimateGas.execute(id);
    return this.web3.getApproximateGasFee(estimation.toBigInt());
  }
}
