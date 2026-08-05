import React from 'react';
import NumericInput from './NumericInput';

/** Whole-number fields (counts, months, calendar years, etc.). */
const IntegerInput = ({
    value,
    onValueChange,
    min,
    max,
    placeholder = '0',
    ...props
}) => (
    <NumericInput
        value={value}
        onValueChange={onValueChange}
        allowDecimal={false}
        min={min}
        max={max}
        placeholder={placeholder}
        inputMode="numeric"
        {...props}
    />
);

export default IntegerInput;
