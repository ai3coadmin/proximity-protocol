import {gql} from 'graphql-request';

export const QueryVetoSettings = gql`
  query VetoSettings($address: ID!) {
    tokenVotingPlugin(id: $address) {
      minDuration
      minProposerVotingPower
      minParticipation
      supportThreshold
      votingMode
    }
  }
`;
