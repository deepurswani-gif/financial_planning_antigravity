import { User, Calendar, Target, Briefcase, Plus, Trash2, GraduationCap, Phone } from 'lucide-react';
import { calculateRetirementYear, calculateAge } from './ProfileLogic';
import { EDUCATION_STANDARDS } from '../JourneyModule/ProjectionLogic';
import CurrencyInput from '../common/CurrencyInput';
import DateInput from '../common/DateInput';
import YearsInput from '../common/YearsInput';
import IntegerInput from '../common/IntegerInput';

const toStored = (v) => (v == null ? '' : String(v));

const ProfileInput = ({ members, setMembers, onCalculate }) => {
    const handleMemberChange = (index, e) => {
        let { name, value } = e.target;

        if (name === 'mobile') {
            value = value.replace(/\D/g, '').slice(0, 10);
        }

        const updatedMembers = [...members];
        let member = { ...updatedMembers[index], [name]: value };

        // Clear stale education data when switching status for children
        if (member.relation === 'Child' && name === 'occupation') {
            if (value === 'College') {
                member.standard = '';
                member.annualSchoolFee = '';
            } else if (value === 'School') {
                member.courseName = '';
                member.courseDuration = '';
                member.currentSemYear = '';
                member.remainingTime = '';
                member.costOfCompleteCourse = '';
                member.isFeePaid = '';
            }
        }

        updatedMembers[index] = member;
        setMembers(updatedMembers);
    };

    const addMember = (relation) => {
        setMembers([...members, {
            name: '',
            dob: '',
            occupation: relation === 'Child' ? '' : 'Salaried',
            natureOfBusiness: '',
            organizationName: '',
            educationalQualification: '',
            retirementAge: 60,
            relation: relation,
            standard: relation === 'Child' ? '' : undefined,
            mobile: ''
        }]);
    };

    const removeMember = (index) => {
        if (members.length > 1) {
            setMembers(members.filter((_, i) => i !== index));
        }
    };

    return (
        <div className="profile-input-container">
            {members.map((member, index) => {
                const colors = member.relation === 'Self' 
                    ? { border: 'var(--primary)' } 
                    : member.relation === 'Spouse' 
                        ? { border: 'var(--accent)' } 
                        : { border: 'var(--tertiary)' };

                return (
                <div key={index} className="card member-card fade-in" style={{ border: `2px solid ${colors.border}` }}>
                    <div className="profile-card-header">
                        <h3>
                            <span className="circle-badge" style={{ background: colors.border }}>{index + 1}</span>
                            {member.relation} Details
                        </h3>
                        {index !== 0 && (
                            <button className="btn" onClick={() => removeMember(index)} style={{ color: 'var(--negative)', padding: '0.25rem', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Trash2 size={16} /> Remove
                            </button>
                        )}
                    </div>

                    <div className="grid-cols-3">
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><User size={14} /> Name <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={member.name}
                                onChange={(e) => handleMemberChange(index, e)}
                                placeholder="Name"
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Date of Birth <span style={{ color: '#ef4444' }}>*</span></label>
                            <DateInput
                                name="dob"
                                value={member.dob}
                                required
                                onChange={(iso) => handleMemberChange(index, { target: { name: 'dob', value: iso } })}
                            />
                            {member.dob && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem', fontWeight: 600 }}>
                                    Current Age: {calculateAge(member.dob)} Years
                                </div>
                            )}
                        </div>

                        {(member.relation === 'Self' || member.relation === 'Spouse') && (
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Phone size={14} /> Mobile Number <span style={{ color: '#ef4444' }}>*</span></label>
                                <input
                                    type="tel"
                                    name="mobile"
                                    value={member.mobile || ''}
                                    onChange={(e) => handleMemberChange(index, e)}
                                    placeholder="Enter 10-digit mobile number"
                                    maxLength="10"
                                    pattern="[0-9]*"
                                    required
                                />
                            </div>
                        )}

                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Briefcase size={14} /> {member.relation === 'Child' ? 'Studying at' : 'Occupation'}</label>
                            {member.relation === 'Child' ? (
                                <select
                                    name="occupation"
                                    value={member.occupation || ''}
                                    onChange={(e) => handleMemberChange(index, e)}
                                >
                                    <option value="">Select Option</option>
                                    <option value="School">School</option>
                                    <option value="College">College</option>
                                </select>
                            ) : (
                                <select
                                    name="occupation"
                                    value={member.occupation}
                                    onChange={(e) => handleMemberChange(index, e)}
                                >
                                    <option value="Salaried">Salaried</option>
                                    <option value="Business / Profession">Business / Profession</option>
                                    <option value="Housewife">Housewife</option>
                                </select>
                            )}
                        </div>

                        {(member.relation === 'Self' || member.relation === 'Spouse') && (
                            <>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Briefcase size={14} /> Nature of Business / Profession</label>
                                    <input
                                        type="text"
                                        name="natureOfBusiness"
                                        value={member.natureOfBusiness || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. IT Consulting"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Briefcase size={14} /> Name of Business / Organization</label>
                                    <input
                                        type="text"
                                        name="organizationName"
                                        value={member.organizationName || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><GraduationCap size={14} /> Educational Qualification</label>
                                    <input
                                        type="text"
                                        name="educationalQualification"
                                        value={member.educationalQualification || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. MBA"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Retirement Age</label>
                                    <YearsInput
                                        name="retirementAge"
                                        value={member.retirementAge}
                                        onValueChange={(v) => handleMemberChange(index, { target: { name: 'retirementAge', value: toStored(v) } })}
                                        min={40}
                                        max={70}
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Target size={14} /> Retirement Year</label>
                                    <input
                                        type="text"
                                        value={calculateRetirementYear(member.dob, member.retirementAge) || '-'}
                                        readOnly
                                        className="read-only-field"
                                        style={{ background: 'var(--bg-main)', cursor: 'not-allowed', opacity: 0.8 }}
                                    />
                                </div>
                            </>
                        )}

                        {member.relation === 'Child' && member.occupation === 'School' && (
                            <>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><GraduationCap size={14} /> Studying in Standard</label>
                                    <select
                                        name="standard"
                                        value={member.standard || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                    >
                                        <option value="">Select Standard</option>
                                        {EDUCATION_STANDARDS.map((std, i) => (
                                            <option key={i} value={std}>{std}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><GraduationCap size={14} /> Annual School fee (₹)</label>
                                    <CurrencyInput
                                        name="annualSchoolFee"
                                        value={member.annualSchoolFee || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. 50000"
                                    />
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', gridColumn: '1 / -1', fontStyle: 'italic' }}>
                                        Note: Higher education (College) planning will be done in Goals Section.
                                    </div>
                                </div>
                            </>
                        )}

                        {member.relation === 'Child' && member.occupation === 'College' && (
                            <>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><GraduationCap size={14} /> Name of course</label>
                                    <input
                                        type="text"
                                        name="courseName"
                                        value={member.courseName || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. B.Tech"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Duration of the course (Years)</label>
                                    <YearsInput
                                        name="courseDuration"
                                        value={member.courseDuration || ''}
                                        onValueChange={(v) => handleMemberChange(index, { target: { name: 'courseDuration', value: toStored(v) } })}
                                        placeholder="e.g. 4"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Current Semester / Year</label>
                                    <input
                                        type="text"
                                        name="currentSemYear"
                                        value={member.currentSemYear || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. 2nd Year"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Remaining Time to Complete (Years)</label>
                                    <IntegerInput
                                        name="remainingTime"
                                        value={member.remainingTime || ''}
                                        onValueChange={(v) => handleMemberChange(index, { target: { name: 'remainingTime', value: toStored(v) } })}
                                        placeholder="e.g. 2"
                                        min={0}
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Target size={14} /> Cost of Complete Course (₹)</label>
                                    <CurrencyInput
                                        name="costOfCompleteCourse"
                                        value={member.costOfCompleteCourse || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                        placeholder="e.g. 400000"
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Briefcase size={14} /> Is {member.currentSemYear || 'current year'} fee paid?</label>
                                    <select
                                        name="isFeePaid"
                                        value={member.isFeePaid || ''}
                                        onChange={(e) => handleMemberChange(index, e)}
                                    >
                                        <option value="">Select Option</option>
                                        <option value="YES">YES</option>
                                        <option value="NO">NO</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                );
            })}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => addMember('Spouse')} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <Plus size={18} style={{ marginRight: '0.5rem' }} /> Add Spouse
                </button>
                <button className="btn" onClick={() => addMember('Child')} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <Plus size={18} style={{ marginRight: '0.5rem' }} /> Add Child
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={onCalculate}>
                    Generate Family Analysis
                </button>
            </div>

            <style jsx>{`
        .member-card {
          margin-bottom: 1.5rem;
          padding: 1.25rem;
        }
      `}</style>
        </div>
    );
};

export default ProfileInput;
