import React, { useCallback, useState } from 'react';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import InvestmentDetailsModal from '../CashFlowModule/InvestmentDetailsModal';
import { useWealthSnapshotQuestions } from './useWealthSnapshotQuestions';
import { useSmartEditActivation } from '../FinancialWorkspace/smartEdit/activationChannel';
import SmartEditInstancePicker from '../FinancialWorkspace/smartEdit/SmartEditInstancePicker';
import { resolveInstanceActivation } from '../../experienceRegistry';

const DetailedMyWealthSnapshot = () => {
    const {
        questions,
        activeFdModal,
        setActiveFdModal,
        handleFdSave,
        activeFdInitialData,
        fdInstances,
        openFd,
        addFd,
    } = useWealthSnapshotQuestions();

    const [fdPickerOpen, setFdPickerOpen] = useState(false);

    const onActivate = useCallback((request) => {
        if (request.channel !== 'fdCollection') return false;
        // A known entity carries the exact index — open it directly (no picker).
        if (request.index != null) {
            openFd(request.index);
            return true;
        }
        const strategy = resolveInstanceActivation(fdInstances);
        if (strategy === 'openAddFlow') addFd();
        else if (strategy === 'openExistingInstance') openFd(0);
        else setFdPickerOpen(true);
        return true;
    }, [fdInstances, addFd, openFd]);

    useSmartEditActivation(onActivate);

    return (
        <>
            <DetailedProgressiveLayout
                currentStepId="mywealth"
                questions={questions}
                narrative="Thank you. I now have a clear picture of what you've built — and what you're committed to."
                nextSectionLabel="My Dreams & Goals"
                contentWidth="wide"
            />
            {activeFdModal && (
                <InvestmentDetailsModal
                    isOpen={!!activeFdModal}
                    onClose={() => setActiveFdModal(null)}
                    onSave={handleFdSave}
                    initialData={activeFdInitialData}
                    investmentTypeTitle="Fixed Deposit (FD)"
                />
            )}
            <SmartEditInstancePicker
                open={fdPickerOpen}
                title="Which Fixed Deposit?"
                instances={fdInstances}
                getLabel={(fd, i) => `FD #${i + 1}`}
                getSublabel={(fd) => (fd && typeof fd === 'object' && fd.amount ? `₹${fd.amount}` : null)}
                addLabel="Add a new FD"
                onSelect={(index) => { setFdPickerOpen(false); openFd(index); }}
                onAdd={() => { setFdPickerOpen(false); addFd(); }}
                onClose={() => setFdPickerOpen(false)}
            />
        </>
    );
};

export default DetailedMyWealthSnapshot;
