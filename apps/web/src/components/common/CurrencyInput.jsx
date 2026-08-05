import React, { useCallback } from 'react';
import NumericInput from './NumericInput';
import { formatIntegerInr } from './numericInputUtils';

/**
 * INR money input — integer rupees, Indian grouping, ₹ prefix.
 *
 * Preferred API: onValueChange(number | null)
 * Legacy API: onChange({ target: { name, value: string } }) with '' when empty
 *   (keeps existing module handlers working during migration)
 */
const CurrencyInput = ({
    value,
    onValueChange,
    onChange,
    name,
    placeholder = '0',
    className,
    required,
    id,
    readOnly,
    disabled,
    style,
    min = 0,
    max,
    selectOnFocus = true,
    ...props
}) => {
    const formatDisplay = useCallback((n) => formatIntegerInr(n), []);

    const handleValueChange = (next) => {
        onValueChange?.(next);
        // Legacy event-shaped API: digit string or ''
        if (onChange) {
            onChange({
                target: {
                    name,
                    value: next == null ? '' : String(Math.trunc(next)),
                },
            });
        }
    };

    return (
        <NumericInput
            id={id}
            name={name}
            value={value}
            onValueChange={handleValueChange}
            allowDecimal={false}
            min={min}
            max={max}
            prefix="₹"
            formatDisplay={formatDisplay}
            placeholder={placeholder}
            className={className}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            style={style}
            selectOnFocus={selectOnFocus}
            inputMode="numeric"
            {...props}
        />
    );
};

export default CurrencyInput;
