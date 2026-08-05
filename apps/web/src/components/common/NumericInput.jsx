import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    clampNumber,
    coerceExternalValue,
    displayToNumber,
    normalizePastedNumeric,
    numberToDisplayString,
    sanitizeNumericString,
} from './numericInputUtils';

/**
 * Dual-state numeric text input for financial UX.
 *
 * - displayValue (string) for typing (supports "12.")
 * - emits number | null via onValueChange (blank ≠ zero)
 * - type="text" + inputMode → no spinners, no wheel stepping
 * - select-on-focus, paste normalization, clamp on blur only
 */
const NumericInput = ({
    value,
    onValueChange,
    allowDecimal = true,
    allowNegative = false,
    min,
    max,
    inputMode,
    selectOnFocus = true,
    formatDisplay,
    name,
    id,
    className,
    placeholder,
    required,
    readOnly,
    disabled,
    style,
    prefix,
    suffix,
    prefixStyle,
    suffixStyle,
    onFocus,
    onBlur,
    onClick,
    'aria-label': ariaLabel,
    ...rest
}) => {
    const inputRef = useRef(null);
    const focusedRef = useRef(false);
    const [displayValue, setDisplayValue] = useState(() =>
        formatExternal(value, { allowDecimal, formatDisplay })
    );

    useEffect(() => {
        if (focusedRef.current) return;
        setDisplayValue(formatExternal(value, { allowDecimal, formatDisplay }));
    }, [value, allowDecimal, formatDisplay]);

    const emit = useCallback(
        (next) => {
            if (onValueChange) onValueChange(next);
        },
        [onValueChange]
    );

    const handleChange = (e) => {
        if (readOnly || disabled) return;
        const sanitized = sanitizeNumericString(e.target.value, { allowDecimal, allowNegative });
        setDisplayValue(sanitized);
        emit(displayToNumber(sanitized));
    };

    const handlePaste = (e) => {
        if (readOnly || disabled) return;
        e.preventDefault();
        const pasted = e.clipboardData?.getData('text') ?? '';
        const normalized = normalizePastedNumeric(pasted);
        const sanitized = sanitizeNumericString(normalized, { allowDecimal, allowNegative });
        setDisplayValue(sanitized);
        emit(displayToNumber(sanitized));
    };

    const handleFocus = (e) => {
        focusedRef.current = true;

        // While editing, show raw digits (no commas) so blur/parse never
        // treats a formatted string as empty, and select-all is clean.
        if (formatDisplay && !readOnly && !disabled) {
            const fromValue = coerceExternalValue(value);
            const fromDisplay = displayToNumber(
                sanitizeNumericString(displayValue, { allowDecimal, allowNegative })
            );
            const numeric = fromValue ?? fromDisplay;
            setDisplayValue(numberToDisplayString(numeric, { allowDecimal }));
        }

        if (selectOnFocus && !readOnly && !disabled) {
            // Defer so the unformatted value is committed to the DOM first.
            requestAnimationFrame(() => {
                if (document.activeElement === e.target) {
                    e.target.select();
                }
            });
        }
        onFocus?.(e);
    };

    const handleBlur = (e) => {
        focusedRef.current = false;
        // Always sanitize first — formatted INR strings must not become null.
        const sanitized = sanitizeNumericString(displayValue, { allowDecimal, allowNegative });
        let numeric = displayToNumber(sanitized);
        numeric = clampNumber(numeric, min, max);

        const nextDisplay = formatDisplay
            ? formatDisplay(numeric)
            : numberToDisplayString(numeric, { allowDecimal });

        setDisplayValue(nextDisplay);

        const currentExternal = coerceExternalValue(value);
        if (numeric !== currentExternal) {
            emit(numeric);
        }

        onBlur?.(e);
    };

    const handleWheel = (e) => {
        // Prevent accidental value changes while scrolling the page.
        if (document.activeElement === e.currentTarget) {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

    const resolvedInputMode = inputMode ?? (allowDecimal ? 'decimal' : 'numeric');
    const hasAffix = Boolean(prefix || suffix);

    const input = (
        <input
            ref={inputRef}
            id={id}
            name={name}
            type="text"
            inputMode={resolvedInputMode}
            autoComplete="off"
            value={displayValue}
            onChange={handleChange}
            onPaste={handlePaste}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onWheel={handleWheel}
            onClick={onClick}
            placeholder={placeholder}
            className={className}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            aria-label={ariaLabel}
            style={{
                width: '100%',
                ...(prefix ? { paddingLeft: '2.2rem' } : null),
                ...(suffix ? { paddingRight: '2.2rem' } : null),
                ...style,
            }}
            {...rest}
        />
    );

    if (!hasAffix) return input;

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
            {prefix ? (
                <span
                    style={{
                        position: 'absolute',
                        left: '1rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        zIndex: 1,
                        ...prefixStyle,
                    }}
                >
                    {prefix}
                </span>
            ) : null}
            {input}
            {suffix ? (
                <span
                    style={{
                        position: 'absolute',
                        right: '1rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        zIndex: 1,
                        ...suffixStyle,
                    }}
                >
                    {suffix}
                </span>
            ) : null}
        </div>
    );
};

function formatExternal(value, { allowDecimal, formatDisplay }) {
    const n = coerceExternalValue(value);
    if (formatDisplay) return formatDisplay(n);
    return numberToDisplayString(n, { allowDecimal });
}

export default NumericInput;
