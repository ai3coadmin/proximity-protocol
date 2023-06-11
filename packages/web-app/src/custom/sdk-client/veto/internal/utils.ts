import {
  computeProposalStatus,
  ContractVotingSettings,
  DaoAction,
  DaoListItem,
  DaoMetadata,
  InstalledPluginListItem,
  ProposalMetadata,
  SubgraphAction,
  SubgraphVoteValuesMap,
  VoteValues,
  votingSettingsToContract,
} from '@aragon/sdk-client';
import {
  ContractMintTokenParams,
  ContractVetoInitParams,
  Erc20TokenDetails,
  Erc721TokenDetails,
  IMintTokenParams,
  IVetoPluginInstall,
  SubgraphContractType,
  SubgraphErc20Token,
  SubgraphErc721Token,
  SubgraphVetoProposal,
  SubgraphVetoProposalListItem,
  SubgraphVetoVoterListItem,
  VetoProposal,
  VetoProposalListItem,
} from '../interfaces';
import {BigNumber} from '@ethersproject/bignumber';
import {Result} from '@ethersproject/abi';
import {
  decodeRatio,
  getCompactProposalId,
  hexToBytes,
} from '@aragon/sdk-common';
import {TokenType} from '@aragon/sdk-client';
import {
  SubgraphDaoListItem,
  SubgraphPluginListItem,
} from '@aragon/sdk-client/dist/interfaces';

export function toDaoListItem(
  dao: SubgraphDaoListItem,
  metadata: DaoMetadata
): DaoListItem {
  return {
    address: dao.id,
    ensDomain: dao.subdomain + '.dao.eth',
    metadata: {
      name: metadata.name,
      description: metadata.description,
      avatar: metadata.avatar || undefined,
    },
    plugins: dao.plugins
      .map((plugin: SubgraphPluginListItem): InstalledPluginListItem[] => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return plugin?.installations?.map(installation => {
          return {
            instanceAddress: plugin.id,
            id: `${installation.appliedVersion.pluginRepo.subdomain}.plugin.dao.eth`,
            release: installation.appliedVersion.release.release,
            build: installation.appliedVersion.build,
          };
        });
      })
      .flat(),
  };
}

export function toVetoProposal(
  proposal: SubgraphVetoProposal,
  metadata: ProposalMetadata
): VetoProposal {
  const startDate = new Date(parseInt(proposal.startDate) * 1000);
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  const creationDate = new Date(parseInt(proposal.createdAt) * 1000);
  const executionDate = proposal.executionDate
    ? new Date(parseInt(proposal.executionDate) * 1000)
    : null;
  let usedVotingWeight = BigInt(0);
  for (const voter of proposal.voters) {
    usedVotingWeight += BigInt(voter.votingPower);
  }
  const token = parseToken(proposal.plugin.token);
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.subdomain,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
      description: metadata.description,
      resources: metadata.resources,
      media: metadata.media,
    },
    startDate,
    endDate,
    creationDate,
    creationBlockNumber: parseInt(proposal.creationBlockNumber),
    executionDate,
    executionBlockNumber: parseInt(proposal.executionBlockNumber) || null,
    executionTxHash: proposal.executionTxHash || null,
    actions: proposal.actions.map((action: SubgraphAction): DaoAction => {
      return {
        data: hexToBytes(action.data),
        to: action.to,
        value: BigInt(action.value),
      };
    }),
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? BigInt(proposal.yes) : BigInt(0),
      no: proposal.no ? BigInt(proposal.no) : BigInt(0),
      abstain: proposal.abstain ? BigInt(proposal.abstain) : BigInt(0),
    },
    settings: {
      supportThreshold: decodeRatio(BigInt(proposal.supportThreshold), 6),
      duration: parseInt(proposal.endDate) - parseInt(proposal.startDate),
      minParticipation: decodeRatio(
        (BigInt(proposal.minVotingPower) * BigInt(1000000)) /
          BigInt(proposal.totalVotingPower),
        6
      ),
    },
    token,
    usedVotingWeight,
    totalVotingWeight: BigInt(proposal.totalVotingPower),
    votes: proposal.voters.map((voter: SubgraphVetoVoterListItem) => {
      return {
        voteReplaced: voter.voteReplaced,
        address: voter.voter.address,
        vote: SubgraphVoteValuesMap.get(voter.voteOption) as VoteValues,
        weight: BigInt(voter.votingPower),
      };
    }),
  };
}

export function toVetoProposalListItem(
  proposal: SubgraphVetoProposalListItem,
  metadata: ProposalMetadata
): VetoProposalListItem {
  const startDate = new Date(parseInt(proposal.startDate) * 1000);
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  const token = parseToken(proposal.plugin.token);
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
      name: proposal.dao.subdomain,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
    },
    totalVotingWeight: BigInt(proposal.totalVotingPower),
    startDate,
    endDate,
    status: computeProposalStatus(proposal),
    result: {
      yes: proposal.yes ? BigInt(proposal.yes) : BigInt(0),
      no: proposal.no ? BigInt(proposal.no) : BigInt(0),
      abstain: proposal.abstain ? BigInt(proposal.abstain) : BigInt(0),
    },
    token,
  };
}

export function mintTokenParamsToContract(
  params: IMintTokenParams
): ContractMintTokenParams {
  return [params.address, BigNumber.from(params.amount)];
}

export function mintTokenParamsFromContract(result: Result): IMintTokenParams {
  return {
    address: result[0],
    amount: BigInt(result[1]),
  };
}

export function tokenVotingInitParamsToContract(
  params: IVetoPluginInstall
): ContractVetoInitParams {
  let token = '';
  // const balances: [string[], BigNumber[]] = [[], []];
  // if (params.newToken) {
  //   token = [AddressZero, params.newToken.name, params.newToken.symbol];
  //   balances = [
  //     params.newToken.balances.map(balance => balance.address),
  //     params.newToken.balances.map(({balance}) => BigNumber.from(balance)),
  //   ];
  // } else
  if (params.useToken) {
    token = params.useToken?.tokenAddress;
  }
  return [
    token,
    Object.values(
      votingSettingsToContract(params.votingSettings)
    ) as ContractVotingSettings,
  ];
}

function parseToken(
  subgraphToken: SubgraphErc20Token | SubgraphErc721Token
): Erc20TokenDetails | Erc721TokenDetails | null {
  let token: Erc721TokenDetails | Erc20TokenDetails | null = null;
  if (subgraphToken.__typename === SubgraphContractType.ERC20) {
    token = {
      address: subgraphToken.id,
      symbol: subgraphToken.symbol,
      name: subgraphToken.name,
      decimals: subgraphToken.decimals,
      type: TokenType.ERC20,
    };
  } else if (subgraphToken.__typename === SubgraphContractType.ERC721) {
    token = {
      address: subgraphToken.id,
      symbol: subgraphToken.symbol,
      name: subgraphToken.name,
      type: TokenType.ERC721,
    };
  }
  return token;
}
