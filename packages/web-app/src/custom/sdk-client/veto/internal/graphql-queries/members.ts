import {gql} from 'graphql-request';

export const QueryVetoMembers = gql`
  query VetoMembers($address: ID!) {
    tokenVotingPlugin(id: $address) {
      members {
        address
      }
    }
  }
`;
