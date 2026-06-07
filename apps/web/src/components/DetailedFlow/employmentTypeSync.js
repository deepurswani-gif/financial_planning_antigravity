export const EMPLOYMENT_TYPES = [
    'Government Sector',
    'Private Sector',
    'Business Owner',
    'Professional',
    'Pensioner',
];

/** Maps detailed Employment Type to legacy occupation for tax / cash-flow logic. */
export function syncOccupationFromEmploymentType(employmentType) {
    switch (employmentType) {
        case 'Government Sector':
        case 'Private Sector':
        case 'Pensioner':
            return 'Salaried';
        case 'Business Owner':
        case 'Professional':
            return 'Business / Profession';
        default:
            return 'Salaried';
    }
}

/** Best-effort guess when loading plans that only have summary occupation. */
export function guessEmploymentTypeFromSummaryOccupation(occupation) {
    if (occupation === 'Business / Profession') return 'Business Owner';
    if (occupation === 'Salaried') return 'Private Sector';
    return '';
}

export function createEmptySpouseMember() {
    return {
        name: '',
        dob: '',
        occupation: 'Salaried',
        employmentType: '',
        retirementAge: 60,
        relation: 'Spouse',
        natureOfBusiness: '',
        organizationName: '',
        educationalQualification: '',
        mobile: '',
        isSpouseWorking: null,
    };
}

export function createEmptyChildMember() {
    return {
        name: '',
        dob: '',
        occupation: '',
        relation: 'Child',
    };
}
