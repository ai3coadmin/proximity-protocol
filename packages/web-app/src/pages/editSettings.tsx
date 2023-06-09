import {withTransaction} from '@elastic/apm-rum-react';
import React from 'react';

import {Loading} from 'components/temporary';
import {EditMvSettings} from 'containers/editSettings/majorityVoting';
import {EditMsSettings} from 'containers/editSettings/multisig';
import {useDaoDetailsQuery} from 'hooks/useDaoDetails';
import {PluginTypes} from 'hooks/usePluginClient';

const EditSettings: React.FC = () => {
  const {data: daoDetails, isLoading: detailsAreLoading} = useDaoDetailsQuery();

  const pluginType = daoDetails?.plugins[0].id as PluginTypes;

  if (detailsAreLoading) {
    return <Loading />;
  } else if (daoDetails && pluginType?.includes('multisig')) {
    return <EditMsSettings daoDetails={daoDetails} />;
  } else if (
    daoDetails &&
    [
      'token-voting.plugin.dao.eth',
      'capitaldaomumbai.plugin.dao.eth',
      'veto.plugin.dao.eth',
      'veto-v2.plugin.dao.eth',
    ].includes(pluginType || '')
  ) {
    return <EditMvSettings daoDetails={daoDetails} />;
  } else {
    return <></>;
  }
};

export default withTransaction('EditSettings', 'component')(EditSettings);
