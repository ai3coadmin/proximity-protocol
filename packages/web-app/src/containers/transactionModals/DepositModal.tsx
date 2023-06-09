import {
  ButtonText,
  IconLinkExternal,
  Link,
  WalletInputLegacy,
  shortenAddress,
} from '@aragon/ui-components';
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {generatePath, useNavigate} from 'react-router-dom';
import styled from 'styled-components';

import ModalBottomSheetSwitcher from 'components/modalBottomSheetSwitcher';
import {useAlertContext} from 'context/alert';
import {useGlobalModalContext} from 'context/globalModals';
import {useNetwork} from 'context/network';
import {useDaoDetailsQuery} from 'hooks/useDaoDetails';
import {CHAIN_METADATA} from 'utils/constants';
import {toDisplayEns} from 'utils/library';
import {AllTransfers} from 'utils/paths';
import {PluginTypes, usePluginClient} from '../../hooks/usePluginClient';
import {InstalledPluginListItem} from '@aragon/sdk-client';
import {VetoClient} from '../../custom/sdk-client/veto';

const DepositModal: React.FC = () => {
  const {t} = useTranslation();
  const {isDepositOpen, close} = useGlobalModalContext();
  const {data: daoDetails} = useDaoDetailsQuery();
  const {network} = useNetwork();
  const {alert} = useAlertContext();
  const navigate = useNavigate();
  const {id: pluginType, instanceAddress: pluginAddress} =
    daoDetails?.plugins[0] || ({} as InstalledPluginListItem);
  const pluginClient = usePluginClient(pluginType as PluginTypes);
  const [depositAmount, setDepositAmount] = useState<string>();
  const [depositLoading, setDepositLoading] = useState<boolean>(false);
  const copyToClipboard = (value: string | undefined) => {
    navigator.clipboard.writeText(value || '');
    alert(t('alert.chip.inputCopied'));
  };

  const handleDepositClicked = useCallback(async () => {
    console.log('handleDepositClicked', pluginAddress, pluginType);
    setDepositLoading(true);
    try {
      if (
        pluginClient instanceof VetoClient &&
        depositAmount &&
        parseFloat(depositAmount) > 0
      ) {
        await pluginClient?.methods.deposit(pluginAddress, depositAmount, '');
      }
    } catch (e) {
      console.log('handleDepositClicked error', e);
    }
    setDepositLoading(false);
    close('deposit');
  }, [depositAmount, pluginAddress, pluginClient, pluginType]);

  const handleCtaClicked = useCallback(() => {
    close('deposit');
    navigate(
      generatePath(AllTransfers, {
        network,
        dao: toDisplayEns(daoDetails?.ensDomain) || daoDetails?.address,
      })
    );
  }, [close, daoDetails?.address, daoDetails?.ensDomain, navigate, network]);

  const Divider: React.FC = () => {
    return (
      <DividerWrapper>
        <hr className="w-full h-px bg-ui-200" />
        <span className="px-1 font-semibold text-ui-400">
          {t('modal.deposit.dividerLabel')}
        </span>
        <hr className="w-full h-px bg-ui-200" />
      </DividerWrapper>
    );
  };

  return (
    <ModalBottomSheetSwitcher
      isOpen={isDepositOpen}
      onClose={() => close('deposit')}
      title={t('modal.deposit.headerTitle')}
      subtitle={t('modal.deposit.headerDescription')}
    >
      <Container>
        {toDisplayEns(daoDetails?.ensDomain) !== '' && (
          <>
            <EnsHeaderWrapper>
              <EnsTitle>{t('modal.deposit.inputLabelEns')}</EnsTitle>
              <EnsSubtitle>{t('modal.deposit.inputHelptextEns')}</EnsSubtitle>
            </EnsHeaderWrapper>
            <WalletInputLegacy
              adornmentText={t('labels.copy')}
              value={daoDetails?.ensDomain}
              onAdornmentClick={() => copyToClipboard(daoDetails?.ensDomain)}
              disabledFilled
            />
            <Divider />
          </>
        )}
        <AddressHeaderWrapper>
          <EnsTitle>{t('modal.deposit.inputLabelContract')}</EnsTitle>
        </AddressHeaderWrapper>
        <BodyWrapper>
          <WalletInputLegacy
            adornmentText={t('labels.copy')}
            value={shortenAddress(daoDetails?.address as string)}
            onAdornmentClick={() => copyToClipboard(daoDetails?.address)}
            disabledFilled
          />
          {pluginClient instanceof VetoClient && (
            <WalletInputLegacy
              placeholder={'Deposit Amount'}
              onChange={e => setDepositAmount(e.target.value)}
              value={depositAmount}
            />
          )}
          <Link
            href={
              CHAIN_METADATA[network].explorer +
              '/address/' +
              daoDetails?.address
            }
            label={t('modal.deposit.linkLabelBlockExplorer')}
            iconRight={<IconLinkExternal />}
          />
          <ActionWrapper>
            <ButtonText
              mode="primary"
              size="large"
              label={t('modal.deposit.depositLabel')}
              onClick={handleDepositClicked}
              disabled={depositLoading || parseFloat(depositAmount || '0') <= 0}
            />
            <ButtonText
              mode="ghost"
              size="large"
              label={t('modal.deposit.ctaLabel')}
              onClick={handleCtaClicked}
              disabled={depositLoading}
            />
            <ButtonText
              mode="secondary"
              size="large"
              label={t('modal.deposit.cancelLabel')}
              onClick={() => close('deposit')}
              disabled={depositLoading}
            />
          </ActionWrapper>
        </BodyWrapper>
      </Container>
    </ModalBottomSheetSwitcher>
  );
};

const Container = styled.div.attrs({
  className: 'p-3',
})``;

const EnsHeaderWrapper = styled.div.attrs({
  className: 'space-y-0.5 mb-1.5',
})``;

const EnsTitle = styled.h2.attrs({
  className: 'ft-text-base font-bold text-ui-800',
})``;

const EnsSubtitle = styled.p.attrs({
  className: 'text-ui-600 ft-text-sm',
})``;

const AddressHeaderWrapper = styled.div.attrs({
  className: 'mb-1',
})``;

const BodyWrapper = styled.div.attrs({
  className: 'space-y-3',
})``;

const ActionWrapper = styled.div.attrs({
  className: 'flex space-x-1.5',
})``;

const DividerWrapper = styled.div.attrs({
  className: 'flex items-center my-1',
})``;

export default DepositModal;
