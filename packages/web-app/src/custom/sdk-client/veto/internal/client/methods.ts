import {isAddress} from '@ethersproject/address';
import {
  boolArrayToBitmap,
  decodeProposalId,
  decodeRatio,
  encodeProposalId,
  getExtendedProposalId,
  GraphQLError,
  InvalidAddressError,
  InvalidAddressOrEnsError,
  InvalidCidError,
  InvalidProposalIdError,
  IpfsPinError,
  isProposalId,
  NoProviderError,
  NoSignerError,
  ProposalCreationError,
  resolveIpfsCid,
} from '@aragon/sdk-common';
import {
  CanVoteParams,
  ClientCore,
  computeProposalStatusFilter,
  ContextPlugin,
  CreateMajorityVotingProposalParams,
  DaoListItem,
  DaoMetadata,
  DaoSortBy,
  ExecuteProposalStep,
  ExecuteProposalStepValue,
  findLog,
  IDaoQueryParams,
  IProposalQueryParams,
  IVoteProposalParams,
  ProposalCreationSteps,
  ProposalCreationStepValue,
  ProposalMetadata,
  ProposalSortBy,
  SortDirection,
  SubgraphVotingSettings,
  VoteProposalStep,
  VoteProposalStepValue,
  VotingSettings,
} from '@aragon/sdk-client';
import {
  Erc20TokenDetails,
  Erc721TokenDetails,
  IVetoClientMethods,
  IVetoDaoQueryParams,
  SubgraphContractType,
  SubgraphErc20Token,
  SubgraphErc721Token,
  SubgraphVetoProposal,
  SubgraphVetoProposalListItem,
  VetoProposal,
  VetoProposalListItem,
} from '../../interfaces';
import {
  QueryVetoMembers,
  QueryVetoPlugin,
  QueryVetoProposal,
  QueryVetoProposals,
  QueryVetoSettings,
} from '../graphql-queries';
import {toDaoListItem, toVetoProposal, toVetoProposalListItem} from '../utils';
import {VetoPlugin__factory} from './VetoPlugin__factory';
import {toUtf8Bytes} from '@ethersproject/strings';
import {
  UNAVAILABLE_PROPOSAL_METADATA,
  UNSUPPORTED_PROPOSAL_METADATA_LINK,
} from '@aragon/sdk-client';
import {TokenType} from '@aragon/sdk-client';
import {SubgraphDaoListItem} from '@aragon/sdk-client/dist/interfaces';
import {QueryDaos} from '../graphql-queries/dao';
import {TestVotingToken__factory} from './TestVotingToken__factory';
import {BigNumber} from 'ethers';
export const UNSUPPORTED_DAO_METADATA_LINK: DaoMetadata = {
  name: '(unsupported metadata link)',
  description: '(the metadata link is not supported)',
  links: [],
};
export const EMPTY_DAO_METADATA_LINK: DaoMetadata = {
  name: '(the DAO has no metadata)',
  description: '(the DAO did not define any content)',
  links: [],
};

export const UNAVAILABLE_DAO_METADATA: DaoMetadata = {
  name: '(unavailable metadata)',
  description: '(the DAO metadata is not available)',
  links: [],
};

/**
 * Methods module the SDK Veto Client
 */
export class VetoClientMethods
  extends ClientCore
  implements IVetoClientMethods
{
  constructor(context: ContextPlugin) {
    super(context);
    Object.freeze(VetoClientMethods.prototype);
    Object.freeze(this);
  }

  public async getDaos({
    limit = 10,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = DaoSortBy.CREATED_AT,
    address = [],
  }: IVetoDaoQueryParams): Promise<DaoListItem[]> {
    const query = QueryDaos;
    const params = {
      limit,
      skip,
      direction,
      sortBy,
      address,
    };
    const name = 'DAOs';
    type T = {
      pluginRepos: {
        installations: {
          dao: SubgraphDaoListItem;
        }[];
      }[];
    };
    const {pluginRepos} = await this.graphql.request<T>({query, params, name});
    const pluginRepo: SubgraphDaoListItem[] = [];
    pluginRepos.forEach(p =>
      p.installations.forEach(({dao}) => {
        pluginRepo.push(dao);
      })
    );
    return Promise.all(
      pluginRepo.map(async (dao): Promise<DaoListItem> => {
        if (!dao.metadata) {
          return toDaoListItem(dao, EMPTY_DAO_METADATA_LINK);
        }
        try {
          const metadataCid = resolveIpfsCid(dao.metadata);
          const stringMetadata = await this.ipfs.fetchString(metadataCid);
          const metadata = JSON.parse(stringMetadata);
          return toDaoListItem(dao, metadata);
        } catch (err) {
          if (err instanceof InvalidCidError) {
            return toDaoListItem(dao, UNSUPPORTED_DAO_METADATA_LINK);
          }
          return toDaoListItem(dao, UNAVAILABLE_DAO_METADATA);
        }
      })
    );
  }

  /**
   * Creates a new proposal on the given Veto plugin contract
   *
   * @param {CreateMajorityVotingProposalParams} params
   * @return {*}  {AsyncGenerator<ProposalCreationStepValue>}
   * @memberof VetoClient
   */
  public async *createProposal(
    params: CreateMajorityVotingProposalParams
  ): AsyncGenerator<ProposalCreationStepValue> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }

    const tokenVotingContract = VetoPlugin__factory.connect(
      params.pluginAddress,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
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

    const tx = await tokenVotingContract.createProposal(
      toUtf8Bytes(params.metadataUri),
      params.actions || [],
      allowFailureMap,
      Math.round(startTimestamp / 1000),
      Math.round(endTimestamp / 1000),
      params.creatorVote || 0,
      params.executeOnPass || false
    );

    yield {
      key: ProposalCreationSteps.CREATING,
      txHash: tx.hash,
    };

    const receipt = await tx.wait();
    const tokenVotingContractInterface = VetoPlugin__factory.createInterface();
    const log = findLog(
      receipt,
      tokenVotingContractInterface,
      'ProposalCreated'
    );
    if (!log) {
      throw new ProposalCreationError();
    }

    const parsedLog = tokenVotingContractInterface.parseLog(log);
    const proposalId = parsedLog.args['proposalId'];
    if (!proposalId) {
      throw new ProposalCreationError();
    }

    yield {
      key: ProposalCreationSteps.DONE,
      proposalId: encodeProposalId(params.pluginAddress, Number(proposalId)),
    };
  }

  /**
   * Pins a metadata object into IPFS and retruns the generated hash
   *
   * @param {ProposalMetadata} params
   * @return {*}  {Promise<string>}
   * @memberof ClientMethods
   */
  public async pinMetadata(params: ProposalMetadata): Promise<string> {
    try {
      const cid = await this.ipfs.add(JSON.stringify(params));
      await this.ipfs.pin(cid);
      return `ipfs://${cid}`;
    } catch {
      throw new IpfsPinError();
    }
  }
  /**
   * Cast a vote on the given proposal using the client's wallet. Depending on the proposal settings, an affirmative vote may execute the proposal's actions on the DAO.
   *
   * @param {IVoteProposalParams} params
   * @param {VoteValues} vote
   * @return {*}  {AsyncGenerator<VoteProposalStepValue>}
   * @memberof VetoClient
   */
  public async *voteProposal(
    params: IVoteProposalParams
  ): AsyncGenerator<VoteProposalStepValue> {
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

    const tx = await tokenVotingContract.vote(id, params.vote, false);

    yield {
      key: VoteProposalStep.VOTING,
      txHash: tx.hash,
    };
    await tx.wait();
    yield {
      key: VoteProposalStep.DONE,
    };
  }
  /**
   * Executes the given proposal, provided that it has already passed
   *
   * @param {string} proposalId
   * @return {*}  {AsyncGenerator<ExecuteProposalStepValue>}
   * @memberof VetoClient
   */
  public async *executeProposal(
    proposalId: string
  ): AsyncGenerator<ExecuteProposalStepValue> {
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
    const tx = await tokenVotingContract.execute(id);

    yield {
      key: ExecuteProposalStep.EXECUTING,
      txHash: tx.hash,
    };
    await tx.wait();
    yield {
      key: ExecuteProposalStep.DONE,
    };
  }

  /**
   * Checks if an user can vote in a proposal
   *
   * @param {CanVoteParams} params
   * @returns {*}  {Promise<boolean>}
   */
  public async canVote(params: CanVoteParams): Promise<boolean> {
    const signer = this.web3.getConnectedSigner();
    if (!signer.provider) {
      throw new NoProviderError();
    } else if (!isAddress(params.voterAddressOrEns)) {
      throw new InvalidAddressError();
    }

    const {pluginAddress, id} = decodeProposalId(params.proposalId);

    const tokenVotingContract = VetoPlugin__factory.connect(
      pluginAddress,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signer
    );
    return tokenVotingContract.callStatic.canVote(
      id,
      params.voterAddressOrEns,
      params.vote
    );
  }

  /**
   * Checks whether the current proposal can be executed
   *
   * @param {string} proposalId
   * @return {*}  {Promise<boolean>}
   * @memberof VetoClientMethods
   */
  public async canExecute(proposalId: string): Promise<boolean> {
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

    return tokenVotingContract.canExecute(id);
  }
  /**
   * Returns the list of wallet addresses holding tokens from the underlying Token contract used by the plugin
   *
   * @async
   * @param {string} pluginAddress
   * @return {*}  {Promise<string[]>}
   * @memberof VetoClient
   */
  public async getMembers(pluginAddress: string): Promise<string[]> {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }

    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const response = await client.request(QueryVetoMembers, {
        address: pluginAddress,
      });
      return response.tokenVotingPlugin.members.map(
        (member: {address: string}) => member.address
      );
    } catch {
      throw new GraphQLError('Veto members');
    }
  }

  /**
   * Returns the details of the given proposal
   *
   * @param {string} proposalId
   * @return {*}  {Promise<VetoProposal>}
   * @memberof VetoClient
   */
  public async getProposal(proposalId: string): Promise<VetoProposal | null> {
    if (!isProposalId(proposalId)) {
      throw new InvalidProposalIdError();
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const extendedProposalId = getExtendedProposalId(proposalId);
      const {
        tokenVotingProposal,
      }: {
        tokenVotingProposal: SubgraphVetoProposal;
      } = await client.request(QueryVetoProposal, {
        proposalId: extendedProposalId,
      });
      if (!tokenVotingProposal) {
        return null;
      }
      // format in the metadata field
      try {
        const metadataCid = resolveIpfsCid(tokenVotingProposal.metadata);
        const metadataString = await this.ipfs.fetchString(metadataCid);
        const metadata = JSON.parse(metadataString) as ProposalMetadata;
        return toVetoProposal(tokenVotingProposal, metadata);
        // TODO: Parse and validate schema
      } catch (err) {
        if (err instanceof InvalidCidError) {
          return toVetoProposal(
            tokenVotingProposal,
            UNSUPPORTED_PROPOSAL_METADATA_LINK
          );
        }
        return toVetoProposal(
          tokenVotingProposal,
          UNAVAILABLE_PROPOSAL_METADATA
        );
      }
    } catch (err) {
      throw new GraphQLError('Veto proposal');
    }
  }
  /**
   * Returns a list of proposals on the Plugin, filtered by the given criteria
   *
   * @param {IProposalQueryParams} params
   * @return {*}  {Promise<VetoProposalListItem[]>}
   * @memberof VetoClient
   */
  public async getProposals({
    daoAddressOrEns,
    limit = 10,
    status,
    skip = 0,
    direction = SortDirection.ASC,
    sortBy = ProposalSortBy.CREATED_AT,
  }: IProposalQueryParams): Promise<VetoProposalListItem[]> {
    let where = {};
    let address = daoAddressOrEns;
    if (address) {
      if (!isAddress(address)) {
        await this.web3.ensureOnline();
        const provider = this.web3.getProvider();
        if (!provider) {
          throw new NoProviderError();
        }
        const resolvedAddress = await provider.resolveName(address);
        if (!resolvedAddress) {
          throw new InvalidAddressOrEnsError();
        }
        address = resolvedAddress;
      }
      where = {dao: address};
    }
    if (status) {
      where = {...where, ...computeProposalStatusFilter(status)};
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const {
        tokenVotingProposals,
      }: {
        tokenVotingProposals: SubgraphVetoProposalListItem[];
      } = await client.request(QueryVetoProposals, {
        where,
        limit,
        skip,
        direction,
        sortBy,
      });
      await this.ipfs.ensureOnline();
      return Promise.all(
        tokenVotingProposals.map(
          async (
            proposal: SubgraphVetoProposalListItem
          ): Promise<VetoProposalListItem> => {
            // format in the metadata field
            try {
              const metadataCid = resolveIpfsCid(proposal.metadata);
              const stringMetadata = await this.ipfs.fetchString(metadataCid);
              const metadata = JSON.parse(stringMetadata) as ProposalMetadata;
              return toVetoProposalListItem(proposal, metadata);
            } catch (err) {
              if (err instanceof InvalidCidError) {
                return toVetoProposalListItem(
                  proposal,
                  UNSUPPORTED_PROPOSAL_METADATA_LINK
                );
              }
              return toVetoProposalListItem(
                proposal,
                UNAVAILABLE_PROPOSAL_METADATA
              );
            }
          }
        )
      );
    } catch {
      throw new GraphQLError('Veto proposals');
    }
  }

  /**
   * Returns the settings of a plugin given the address of the plugin instance
   *
   * @param {string} pluginAddress
   * @return {*}  {Promise<VotingSettings>}
   * @memberof VetoClient
   */
  public async getVotingSettings(
    pluginAddress: string
  ): Promise<VotingSettings | null> {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const {
        tokenVotingPlugin,
      }: {
        tokenVotingPlugin: SubgraphVotingSettings;
      } = await client.request(QueryVetoSettings, {
        address: pluginAddress,
      });
      if (!tokenVotingPlugin) {
        return null;
      }
      return {
        minDuration: parseInt(tokenVotingPlugin.minDuration),
        supportThreshold: decodeRatio(
          BigInt(tokenVotingPlugin.supportThreshold),
          6
        ),
        minParticipation: decodeRatio(
          BigInt(tokenVotingPlugin.minParticipation),
          6
        ),
        minProposerVotingPower: BigInt(
          tokenVotingPlugin.minProposerVotingPower
        ),
        votingMode: tokenVotingPlugin.votingMode,
      };
    } catch {
      throw new GraphQLError('plugin settings');
    }
  }

  /**
   * Returns the details of the token used in a specific plugin instance
   *
   * @param {string} pluginAddress
   * @return {*}  {Promise<Erc20TokenDetails | null>}
   * @memberof VetoClient
   */
  public async getToken(
    pluginAddress: string
  ): Promise<Erc20TokenDetails | Erc721TokenDetails | null> {
    if (!isAddress(pluginAddress)) {
      throw new InvalidAddressError();
    }
    try {
      await this.graphql.ensureOnline();
      const client = this.graphql.getClient();
      const {tokenVotingPlugin} = await client.request(QueryVetoPlugin, {
        address: pluginAddress,
      });
      if (!tokenVotingPlugin) {
        return null;
      }
      const token: SubgraphErc20Token | SubgraphErc721Token =
        tokenVotingPlugin.token;
      // type erc20
      if (token.__typename === SubgraphContractType.ERC20) {
        return {
          address: token.id,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          type: TokenType.ERC20,
        };
        // type erc721
      } else if (token.__typename === SubgraphContractType.ERC721) {
        return {
          address: token.id,
          name: token.name,
          symbol: token.symbol,
          type: TokenType.ERC721,
        };
      }
      return null;
    } catch (err) {
      throw new GraphQLError('token');
    }
  }

  public async deposit(
    pluginAddress: string,
    amount: string,
    reference: string
  ): Promise<void> {
    const signer = this.web3.getConnectedSigner();
    if (!signer) {
      throw new NoSignerError();
    } else if (!signer.provider) {
      throw new NoProviderError();
    }

    const tokenVotingContract = VetoPlugin__factory.connect(
      pluginAddress,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signer
    );
    console.log('handleDepositClicked veto', pluginAddress);
    const token = await tokenVotingContract.getVotingToken();
    const erc20 = TestVotingToken__factory.connect(
      token,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signer
    );
    const decimals = await erc20.decimals();
    const nativeAmount = BigNumber.from(amount).mul(
      BigNumber.from('10').pow(decimals)
    );
    // const nativeAmount = (parseFloat(amount) * 10 ** decimals).toString();
    const erc20Tx = await erc20.approve(pluginAddress, nativeAmount);
    await erc20Tx.wait();
    const tx = await tokenVotingContract.deposit(nativeAmount, reference);

    await tx.wait();
  }
}
