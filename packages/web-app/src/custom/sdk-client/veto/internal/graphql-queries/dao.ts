import {gql} from 'graphql-request';

export const QueryDaos = gql`
  query Daos(
    $limit: Int!
    $skip: Int!
    $direction: OrderDirection!
    $sortBy: Dao_orderBy!
    $address: String!
  ) {
    daos(
      first: $limit
      skip: $skip
      orderDirection: $direction
      orderBy: $sortBy
      where: {plugins_: {id: $address}}
    ) {
      id
      subdomain
      metadata
      plugins {
        id
        installations {
          appliedVersion {
            build
            pluginRepo {
              subdomain
            }
            release {
              release
            }
          }
        }
      }
    }
  }
`;
