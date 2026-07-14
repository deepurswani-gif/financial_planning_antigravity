import React from 'react';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import InvestmentDetailsModal from '../CashFlowModule/InvestmentDetailsModal';
import { useWealthSnapshotQuestions } from './useWealthSnapshotQuestions';

const DetailedMyWealthSnapshot = () => {
    const {
        questions,
        activeFdModal,
        setActiveFdModal,
        handleFdSave,
        activeFdInitialData,
    } = useWealthSnapshotQuestions();

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
        </>
    );
};

export default DetailedMyWealthSnapshot;
