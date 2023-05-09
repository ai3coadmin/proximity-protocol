import {gql} from 'graphql-request';

export const QueryVetoPlugin = gql`
  query VetoPlugin($address: ID!) {
    tokenVotingPlugin(id: $address) {
      token {
        id
        name
        symbol
        __typename
        ... on ERC20Contract {
          decimals
        }
      }
    }
  }
`;
