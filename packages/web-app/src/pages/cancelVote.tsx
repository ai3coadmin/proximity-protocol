import {MultisigVotingSettings} from '@aragon/sdk-client';
import {withTransaction} from '@elastic/apm-rum-react';
import React, {useCallback, useMemo, useState} from 'react';
import {
  FieldErrors,
  FormProvider,
  useForm,
  useFormState,
  useWatch,
} from 'react-hook-form';
import {useTranslation} from 'react-i18next';
import {generatePath, useParams} from 'react-router-dom';

import {FullScreenStepper, Step} from 'components/fullScreenStepper';
import {Loading} from 'components/temporary';
import AddAddresses from 'containers/actionBuilder/addAddresses';
import RemoveAddresses from 'containers/actionBuilder/removeAddresses';
import UpdateMinimumApproval from 'containers/actionBuilder/updateMinimumApproval';
import DefineProposal, {
  isValid as defineProposalIsValid,
} from 'containers/defineProposal';
import ReviewProposal from 'containers/reviewProposal';
import SetupVotingForm, {
  isValid as setupVotingIsValid,
} from 'containers/setupVotingForm';
import {ActionsProvider} from 'context/actions';
import {CreateProposalProvider} from 'context/createProposal';
import {useNetwork} from 'context/network';
import {useDaoDetailsQuery} from 'hooks/useDaoDetails';
import {useDaoMembers} from 'hooks/useDaoMembers';
import {PluginTypes} from 'hooks/usePluginClient';
import {usePluginSettings} from 'hooks/usePluginSettings';
import {
  removeUnchangedMinimumApprovalAction,
  toDisplayEns,
} from 'utils/library';
import {Community} from 'utils/paths';
import {
  ActionAddAddress,
  ActionRemoveAddress,
  ActionSCC,
  ActionUpdateMultisigPluginSettings,
  ProposalId,
} from 'utils/types';
import {useDaoProposal} from '../hooks/useDaoProposal';
import {useProposalTransactionContext} from '../context/proposalTransaction';

type CancelVoteActionTypes = Array<ActionSCC>;

const CancelVote: React.FC = () => {
  const {t} = useTranslation();
  const {network} = useNetwork();

  // dao data
  const {data: daoDetails, isLoading} = useDaoDetailsQuery();
  // plugin data
  const {data: pluginSettings} = usePluginSettings(
    daoDetails?.plugins[0].instanceAddress as string,
    daoDetails?.plugins[0].id as PluginTypes
  );
  const {data: daoMembers} = useDaoMembers(
    daoDetails?.plugins?.[0]?.instanceAddress || '',
    (daoDetails?.plugins?.[0]?.id as PluginTypes) || undefined
  );
  const multisigDAOSettings = pluginSettings as MultisigVotingSettings;
  const {dao, id: urlId} = useParams();
  const proposalId = useMemo(
    () => (urlId ? new ProposalId(urlId) : undefined),
    [urlId]
  );
  const {
    isLoading: paramsAreLoading,
    pluginAddress,
    pluginType,
  } = useProposalTransactionContext();
  const {
    data: proposal,
    error: proposalError,
    isLoading: proposalIsLoading,
  } = useDaoProposal(
    daoDetails?.address as string,
    proposalId!,
    pluginType,
    pluginAddress
  );
  console.log('proposal id', urlId, proposal);

  const formMethods = useForm({
    mode: 'onChange',
    defaultValues: {
      links: [{name: '', url: ''}],
      proposalTitle: '',
      startSwitch: 'now',
      durationSwitch: 'duration',
      actions: [
        {
          name: 'external_contract_action',
          contractAddress: proposal?.dao?.address,
          contractName: proposal?.dao?.name,
          functionName: 'cancelVote',
          inputs: [
            {
              name: '_proposalId',
              type: 'uint256',
              value: parseInt(
                urlId?.split('_') ? urlId?.split('_')[1] : '0',
                16
              ).toString(),
            },
          ],
        },
      ] as CancelVoteActionTypes,
    },
  });
  const {errors, dirtyFields} = useFormState({
    control: formMethods.control,
  });

  const [formActions] = useWatch({
    control: formMethods.control,
    name: ['actions'],
  });

  const [showTxModal, setShowTxModal] = useState(false);

  /*************************************************
   *                    Render                     *
   *************************************************/

  if (isLoading) {
    return <Loading />;
  }

  // this should never happen basically because useDaoDetailsQuery
  // will navigate to NotFound page if the api returns null.
  // using this so that typescript doesn't complain about daoDetails
  // being possibly null. Unfortunately, I don't have a more elegant solution.
  if (!daoDetails) return null;

  return (
    <FormProvider {...formMethods}>
      <ActionsProvider daoId={daoDetails.address}>
        <CreateProposalProvider
          showTxModal={showTxModal}
          setShowTxModal={setShowTxModal}
        >
          <FullScreenStepper
            wizardProcessName={t('newProposal.title')}
            navLabel={t('labels.manageMember')}
            processType="ProposalCreation"
            returnPath={generatePath(Community, {
              network,
              dao: toDisplayEns(daoDetails.ensDomain) || daoDetails.address,
            })}
          >
            <Step
              wizardTitle={t('newProposal.cancelVote.title')}
              wizardDescription={t('newProposal.cancelVote.description')}
              isNextButtonDisabled={!setupVotingIsValid(errors)}
            >
              <SetupVotingForm pluginSettings={pluginSettings} />
            </Step>
            <Step
              wizardTitle={t('newWithdraw.defineProposal.heading')}
              wizardDescription={t('newWithdraw.defineProposal.description')}
              isNextButtonDisabled={!defineProposalIsValid(dirtyFields, errors)}
            >
              <DefineProposal />
            </Step>
            <Step
              wizardTitle={t('newWithdraw.reviewProposal.heading')}
              wizardDescription={t('newWithdraw.reviewProposal.description')}
              nextButtonLabel={t('labels.submitProposal')}
              onNextButtonClicked={() => setShowTxModal(true)}
              fullWidth
            >
              <ReviewProposal defineProposalStepNumber={3} />
            </Step>
          </FullScreenStepper>
        </CreateProposalProvider>
      </ActionsProvider>
    </FormProvider>
  );
};

export default withTransaction('CancelVote', 'component')(CancelVote);

// Note: Keeping the following helpers here because they are very specific to this flow
/**
 * Check whether the add/remove actions are valid as a whole
 * @param errors form errors
 * @param formActions add and remove address actions
 * @returns whether the actions are valid
 */
function actionsAreValid(
  errors: FieldErrors,
  formActions: Array<
    ActionAddAddress | ActionRemoveAddress | ActionUpdateMultisigPluginSettings
  >,
  minApprovals: number
) {
  if (errors.actions || !formActions) return false;

  let containsEmptyField = false;
  let removedWallets = 0;
  let minimumApprovalChanged = false;

  for (let i = 0; i < formActions.length; i++) {
    if (formActions[i].name === 'add_address') {
      containsEmptyField = (
        formActions[i] as ActionAddAddress
      ).inputs?.memberWallets.some(w => w.address === '');
      continue;
    }

    if (formActions[i].name === 'remove_address') {
      removedWallets += (formActions[i] as ActionRemoveAddress).inputs
        .memberWallets.length;
      continue;
    }

    if (formActions[i].name === 'modify_multisig_voting_settings') {
      const newMinimumApproval = (
        formActions[i] as ActionUpdateMultisigPluginSettings
      ).inputs.minApprovals;

      minimumApprovalChanged = minApprovals !== newMinimumApproval;
    }
  }

  return (
    !containsEmptyField ||
    minimumApprovalChanged ||
    (containsEmptyField && removedWallets > 0)
  );
}
