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

export const CHILD_COLLEGE_FIELDS = [
    'courseName',
    'courseDuration',
    'currentSemYear',
    'remainingTime',
    'costOfCompleteCourse',
    'isFeePaid',
];

export const CHILD_SCHOOL_FIELDS = ['standard'];

export const CHILD_FEE_FIELDS = ['monthlyEducationExpense', 'annualSchoolFee'];

export function createEmptyChildMember() {
    return {
        name: '',
        dob: '',
        occupation: '',
        relation: 'Child',
        standard: '',
        courseName: '',
        courseDuration: '',
        currentSemYear: '',
        remainingTime: '',
        costOfCompleteCourse: '',
        isFeePaid: '',
        monthlyEducationExpense: '',
    };
}

/** Clear education fields that do not apply after occupation change. */
export function applyChildOccupationFields(child, occupation) {
    const next = { ...child, occupation };
    if (occupation === 'School') {
        CHILD_COLLEGE_FIELDS.forEach((f) => { next[f] = ''; });
    } else if (occupation === 'College') {
        CHILD_SCHOOL_FIELDS.forEach((f) => { next[f] = ''; });
    } else {
        [...CHILD_SCHOOL_FIELDS, ...CHILD_COLLEGE_FIELDS].forEach((f) => { next[f] = ''; });
    }
    return next;
}
