// This file contains the definitions of the Veto client
import {BigNumber} from '@ethersproject/bignumber';
import {
  ContractVotingSettings,
  CreateMajorityVotingProposalParams,
  DaoAction,
  ExecuteProposalStepValue,
  GasFeeEstimation,
  CanVoteParams,
  IClientCore,
  IInterfaceParams,
  IProposalQueryParams,
  IVoteProposalParams,
  MajorityVotingProposalSettings,
  ProposalBase,
  ProposalCreationStepValue,
  ProposalListItemBase,
  ProposalMetadata,
  SubgraphAction,
  SubgraphProposalBase,
  SubgraphVoterListItemBase,
  VoteProposalStepValue,
  VoteValues,
  VotingMode,
  VotingSettings,
  IDaoQueryParams,
  DaoListItem,
  ITokenVotingPluginInstall,
} from '@aragon/sdk-client';
import {TokenType} from '@aragon/sdk-client';

// Veto
export interface IVetoDaoQueryParams extends IDaoQueryParams {
  address?: string[];
}
export interface IVetoClientMethods extends IClientCore {
  createProposal: (
    params: CreateMajorityVotingProposalParams
  ) => AsyncGenerator<ProposalCreationStepValue>;
  pinMetadata: (params: ProposalMetadata) => Promise<string>;
  voteProposal: (
    params: IVoteProposalParams
  ) => AsyncGenerator<VoteProposalStepValue>;
  executeProposal: (
    proposalId: string
  ) => AsyncGenerator<ExecuteProposalStepValue>;
  canVote: (params: CanVoteParams) => Promise<boolean>;
  canExecute: (proposalId: string) => Promise<boolean>;
  getMembers: (addressOrEns: string) => Promise<string[]>;
  getProposal: (propoosalId: string) => Promise<VetoProposal | null>;
  getProposals: (
    params: IProposalQueryParams
  ) => Promise<VetoProposalListItem[]>;
  getDaos: (params: IVetoDaoQueryParams) => Promise<DaoListItem[]>;
  getVotingSettings: (pluginAddress: string) => Promise<VotingSettings | null>;
  getToken: (
    pluginAddress: string
  ) => Promise<Erc20TokenDetails | Erc721TokenDetails | null>;
  deposit: (
    pluginAddress: string,
    amount: string,
    reference: string
  ) => Promise<void>;
}

export interface IVetoClientEncoding extends IClientCore {
  updatePluginSettingsAction: (
    pluginAddress: string,
    params: VotingSettings
  ) => DaoAction;
  mintTokenAction: (
    minterAddress: string,
    params: IMintTokenParams
  ) => DaoAction;
}
export interface IVetoClientDecoding extends IClientCore {
  updatePluginSettingsAction: (data: Uint8Array) => VotingSettings;
  mintTokenAction: (data: Uint8Array) => IMintTokenParams;
  findInterface: (data: Uint8Array) => IInterfaceParams | null;
}
export interface IVetoClientEstimation extends IClientCore {
  createProposal: (
    params: CreateMajorityVotingProposalParams
  ) => Promise<GasFeeEstimation>;
  voteProposal: (params: IVoteProposalParams) => Promise<GasFeeEstimation>;
  executeProposal: (proposalId: string) => Promise<GasFeeEstimation>;
}

/** Defines the shape of the Token client class */
export interface IVetoClient {
  methods: IVetoClientMethods;
  encoding: IVetoClientEncoding;
  decoding: IVetoClientDecoding;
  estimation: IVetoClientEstimation;
}
// Factory init params

export type IVetoPluginInstall = {
  votingSettings: VotingSettings;
  useToken?: ITokenVotingPluginInstall['useToken'];
};

type ExistingTokenParams = {
  address: string;
};

type NewTokenParams = {
  name: string;
  symbol: string;
  decimals: number;
  minter?: string;
  balances: {address: string; balance: bigint}[];
};

// PROPOSAL RETRIEVAL
export type VetoProposal = ProposalBase & {
  result: VetoProposalResult;
  settings: MajorityVotingProposalSettings;
  token: Erc20TokenDetails | Erc721TokenDetails | null;
  usedVotingWeight: bigint;
  votes: Array<{
    address: string;
    vote: VoteValues;
    weight: bigint;
    voteReplaced: boolean;
  }>;
  totalVotingWeight: bigint;
  creationBlockNumber: number;
  executionDate: Date | null;
  executionBlockNumber: number | null;
  executionTxHash: string | null;
};

export type VetoProposalListItem = ProposalListItemBase & {
  token: Erc20TokenDetails | Erc721TokenDetails | null;
  result: VetoProposalResult;
  totalVotingWeight: bigint;
};

export type VetoProposalResult = {
  yes: bigint;
  no: bigint;
  abstain: bigint;
};

export type Erc20TokenDetails = TokenBaseDetails & {
  decimals: number;
  type: TokenType.ERC20;
};
export type Erc721TokenDetails = TokenBaseDetails & {
  type: TokenType.ERC721;
};

export type TokenBaseDetails = {
  address: string;
  name: string;
  symbol: string;
};

export type SubgraphVetoVoterListItem = SubgraphVoterListItemBase & {
  votingPower: string;
};

export type SubgraphVetoProposalListItem = SubgraphProposalBase & {
  plugin: {
    token: SubgraphErc20Token | SubgraphErc721Token;
  };
  totalVotingPower: string;
};

type SubgraphBaseToken = {
  symbol: string;
  name: string;
  id: string;
};
export enum SubgraphTokenType {
  ERC20 = 'ERC20Token',
  ERC721 = 'ERC721Token',
}
export enum SubgraphContractType {
  ERC20 = 'ERC20Contract',
  ERC721 = 'ERC721Contract',
}

export type SubgraphErc20Token = SubgraphBaseToken & {
  __typename: SubgraphContractType.ERC20;
  decimals: number;
};
export type SubgraphErc721Token = SubgraphBaseToken & {
  __typename: SubgraphContractType.ERC721;
};

export type SubgraphVetoProposal = SubgraphVetoProposalListItem & {
  createdAt: string;
  actions: SubgraphAction[];
  supportThreshold: string;
  voters: SubgraphVetoVoterListItem[];
  minVotingPower: bigint;
  totalVotingPower: string;
  votingMode: VotingMode;
  creationBlockNumber: string;
  executionDate: string;
  executionTxHash: string;
  executionBlockNumber: string;
};

export interface IMintTokenParams {
  address: string;
  amount: bigint;
}

export type ContractMintTokenParams = [string, BigNumber];
export type ContractVetoInitParams = [
  string,
  ContractVotingSettings
  // [
  //   string, // address
  //   string, // name
  //   string // symbol
  // ],
  // [
  //   string[], // receivers,
  //   BigNumber[] // amounts
  // ]
];
