import React from 'react';
import NumericInput from './NumericInput';

/** Percentage / rate fields (allows decimals). */
const PercentageInput = ({
    value,
    onValueChange,
    min = 0,
    max,
    placeholder = '0',
    showSuffix = false,
    ...props
}) => (
    <NumericInput
        value={value}
        onValueChange={onValueChange}
        allowDecimal
        min={min}
        max={max}
        placeholder={placeholder}
        inputMode="decimal"
        suffix={showSuffix ? '%' : undefined}
        {...props}
    />
);

export default PercentageInput;
