import {
  ContextPlugin,
  MultisigClient,
  TokenVotingClient,
} from '@aragon/sdk-client';
import {useEffect, useState} from 'react';

import {useClient} from './useClient';
import {VetoClient} from '../custom/sdk-client/veto';
import {VetoMultisigClient} from '../custom/sdk-client/veto-multisig';

export type PluginTypes =
  | 'capitaldaomumbai.plugin.dao.eth'
  | 'veto.plugin.dao.eth'
  | 'veto-v2.plugin.dao.eth'
  | 'token-voting.plugin.dao.eth'
  | 'veto-multisig-v1.plugin.dao.eth'
  | 'veto-multisig-v2.plugin.dao.eth'
  | 'multisig.plugin.dao.eth';

type PluginType<T> = T extends 'token-voting.plugin.dao.eth'
  ? TokenVotingClient
  : T extends 'multisig.plugin.dao.eth'
  ? MultisigClient
  : T extends 'veto-multisig-v1.plugin.dao.eth'
  ? VetoMultisigClient
  : T extends 'veto-multisig-v2.plugin.dao.eth'
  ? VetoMultisigClient
  : T extends 'veto.plugin.dao.eth'
  ? VetoClient
  : T extends 'veto-v2.plugin.dao.eth'
  ? VetoClient
  : T extends 'capitaldaomumbai.plugin.dao.eth'
  ? VetoClient
  : never;

export function isTokenVotingClient(
  client: TokenVotingClient | MultisigClient | VetoClient | VetoMultisigClient
): client is TokenVotingClient {
  if (!client || Object.keys(client).length === 0) return false;
  return client instanceof TokenVotingClient;
}
export function isVetoVotingClient(
  client: TokenVotingClient | MultisigClient | VetoClient | VetoMultisigClient
): client is TokenVotingClient {
  if (!client || Object.keys(client).length === 0) return false;
  return client instanceof VetoClient;
}

export function isVetoMultisigClient(
  client: TokenVotingClient | MultisigClient | VetoClient | VetoMultisigClient
): client is VetoMultisigClient {
  if (!client || Object.keys(client).length === 0) return false;
  return client instanceof VetoMultisigClient;
}

export function isMultisigClient(
  client: TokenVotingClient | MultisigClient | VetoClient | VetoMultisigClient
): client is MultisigClient {
  if (!client || Object.keys(client).length === 0) return false;
  return client instanceof MultisigClient;
}

/**
 * This hook can be used to build ERC20 or whitelist clients
 * @param pluginType Type of plugin for which a client is to be built. Note that
 * this is information that must be fetched. I.e., it might be unavailable on
 * first render. Therefore, it is typed as potentially undefined.
 * @returns The corresponding Client
 */
export const usePluginClient = <T extends PluginTypes = PluginTypes>(
  pluginType?: T
): PluginType<T> | undefined => {
  const [pluginClient, setPluginClient] = useState<PluginType<PluginTypes>>();

  const {client, context} = useClient();

  useEffect(() => {
    if (!client || !context) return;

    if (!pluginType) {
      setPluginClient(undefined);
    } else {
      console.log('pluginType', pluginType);
      switch (pluginType as PluginTypes) {
        case 'multisig.plugin.dao.eth':
          setPluginClient(
            new MultisigClient(ContextPlugin.fromContext(context))
          );
          break;
        case 'veto-multisig-v1.plugin.dao.eth':
        case 'veto-multisig-v2.plugin.dao.eth':
          setPluginClient(
            new VetoMultisigClient(ContextPlugin.fromContext(context))
          );
          break;
        case 'token-voting.plugin.dao.eth':
        case 'veto.plugin.dao.eth':
        case 'veto-v2.plugin.dao.eth':
        case 'capitaldaomumbai.plugin.dao.eth':
          setPluginClient(new VetoClient(ContextPlugin.fromContext(context)));
          break;
        default:
          throw new Error('The requested plugin type is invalid');
      }
    }
  }, [client, context, pluginType]);

  return pluginClient as PluginType<T>;
};
