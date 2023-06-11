import {
  ButtonText,
  IconChevronRight,
  IconCommunity,
  ListItemHeader,
} from '@aragon/ui-components';
import React, {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {generatePath, useNavigate} from 'react-router-dom';
import styled from 'styled-components';

import {MembersList} from 'components/membersList';
import {Loading} from 'components/temporary';
import {useNetwork} from 'context/network';
import {useDaoMembers} from 'hooks/useDaoMembers';
import {PluginTypes} from 'hooks/usePluginClient';
import useScreen from 'hooks/useScreen';
import {
  Community,
  ManageMembersProposal,
  MintTokensProposal, NotFound
} from 'utils/paths';
import {useClient} from '../../hooks/useClient';

type Props = {
  daoAddressOrEns: string;
  pluginType: PluginTypes;
  pluginAddress: string;
  horizontal?: boolean;
};

export const MembershipSnapshot: React.FC<Props> = ({
  daoAddressOrEns,
  pluginType,
  pluginAddress,
  horizontal,
}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {network} = useNetwork(); // TODO ensure this is the dao network
  const {isDesktop} = useScreen();

  const {
    data: {members, daoToken},
    isLoading,
  } = useDaoMembers(pluginAddress, pluginType);
  const {context} = useClient();

  useEffect(() => {
    console.log('pluginAddress', daoAddressOrEns, members, isLoading);
    if (context?.signer) {
      context?.signer?.getAddress().then(address => {
        if (
          daoAddressOrEns.toLowerCase() ===
          import.meta.env?.VITE_GOVERNANCE_ADDRESS_MUMBAI?.toLowerCase() &&
          members.find(a => a.address.toLowerCase() === address.toLowerCase())
        ) {
          return;
        }
        if(!isLoading) {
          // TODO: BA Uncomment when going live
          // navigate(NotFound, {
          //   replace: true,
          //   state: {incorrectDao: ''},
          // });
        }
      });
    } else {
      console.log('YAY', import.meta.env.VITE_GOVERNANCE_ADDRESS_MUMBAI);
      if (
        daoAddressOrEns.toLowerCase() ===
        import.meta.env.VITE_GOVERNANCE_ADDRESS_MUMBAI?.toLowerCase()
      ) {
        console.log('YAY YAYAY');
        navigate(NotFound, {
          replace: true,
        });
      }
    }
  }, [context?.signer, isLoading, members, navigate, daoAddressOrEns]);
  const totalMemberCount = members.length;

  const walletBased = pluginType === 'multisig.plugin.dao.eth';

  const headerButtonHandler = () => {
    walletBased
      ? navigate(
          generatePath(ManageMembersProposal, {network, dao: daoAddressOrEns})
        )
      : navigate(
          generatePath(MintTokensProposal, {network, dao: daoAddressOrEns})
        );
  };

  if (isLoading) return <Loading />;

  if (horizontal && isDesktop) {
    return (
      <div className="flex space-x-3">
        <div className="w-1/3">
          <ListItemHeader
            icon={<IconCommunity />}
            value={`${totalMemberCount} ${t('labels.members')}`}
            label={
              walletBased
                ? t('explore.explorer.walletBased')
                : t('explore.explorer.tokenBased')
            }
            buttonText={
              walletBased ? t('labels.manageMember') : t('labels.addMember')
            }
            orientation="vertical"
            onClick={headerButtonHandler}
          />
        </div>
        <div className="space-y-2 w-2/3">
          <ListItemGrid>
            <MembersList token={daoToken} members={members} />
          </ListItemGrid>
          <ButtonText
            mode="secondary"
            size="large"
            iconRight={<IconChevronRight />}
            label={t('labels.seeAll')}
            onClick={() =>
              navigate(generatePath(Community, {network, dao: daoAddressOrEns}))
            }
          />
        </div>
      </div>
    );
  }

  return (
    <VerticalContainer>
      <ListItemHeader
        icon={<IconCommunity />}
        value={`${totalMemberCount} ${t('labels.members')}`}
        label={
          walletBased
            ? t('explore.explorer.walletBased')
            : t('explore.explorer.tokenBased')
        }
        buttonText={
          walletBased ? t('labels.manageMember') : t('labels.addMember')
        }
        orientation="vertical"
        onClick={headerButtonHandler}
      />
      <MembersList token={daoToken} members={members.slice(0, 3)} />
      <ButtonText
        mode="secondary"
        size="large"
        iconRight={<IconChevronRight />}
        label={t('labels.seeAll')}
        onClick={() =>
          navigate(generatePath(Community, {network, dao: daoAddressOrEns}))
        }
      />
    </VerticalContainer>
  );
};

const VerticalContainer = styled.div.attrs({
  className: 'space-y-1.5 desktop:space-y-2',
})``;

const ListItemGrid = styled.div.attrs({
  className:
    'desktop:grid desktop:grid-cols-2 desktop:grid-flow-row desktop:gap-2',
})``;
