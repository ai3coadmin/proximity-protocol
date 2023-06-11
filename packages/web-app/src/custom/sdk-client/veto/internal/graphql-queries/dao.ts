import {gql} from 'graphql-request';

export const QueryDaos = gql`
  query Daos(
    $limit: Int!
    $skip: Int!
    $direction: OrderDirection!
    $sortBy: Dao_orderBy!
    $address: String!
  ) {
    pluginRepo(id: $address) {
      installations(first: $limit, skip: $skip, orderDirection: $direction) {
        dao {
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
    }
  }
`;
