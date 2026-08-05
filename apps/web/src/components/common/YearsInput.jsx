import React from 'react';
import IntegerInput from './IntegerInput';

/** Duration / tenure in years (non-negative integers by default). */
const YearsInput = ({
    value,
    onValueChange,
    min = 0,
    max,
    placeholder = '0',
    ...props
}) => (
    <IntegerInput
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        placeholder={placeholder}
        {...props}
    />
);

export default YearsInput;
