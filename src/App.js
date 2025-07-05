import React, { useState, useEffect, useCallback } from 'react';

const App = () => {
    const [years, setYears] = useState([]);
    const [expandedRows, setExpandedRows] = useState(new Set());

    // Initialize with current year and 3 previous years
    useEffect(() => {
        const savedData = localStorage.getItem('pensionCalculatorData');
        if (savedData) {
            const loadedYears = JSON.parse(savedData);
            // Ensure backward compatibility by adding missing fields
            const updatedYears = loadedYears.map(year => ({
                ...year,
                carryForwardUsedBreakdown: year.carryForwardUsedBreakdown || [],
                canUseThisYear: year.canUseThisYear || year.taperedAllowance || 40000,
                missingYearWarning: year.missingYearWarning || false,
                missingYears: year.missingYears || []
            }));
            setYears(calculateCarryForward(updatedYears));
        } else {
            const currentYear = new Date().getFullYear();
            const initialYears = [];
            for (let i = 3; i >= 0; i--) {
                const year = currentYear - i;
                const rules = pensionRules[year] || pensionRules[2025];
                initialYears.push({
                    id: year,
                    taxYear: `${year}/${String(year + 1).slice(-2)}`,
                    thresholdIncome: '',
                    adjustedIncome: '',
                    taperedAllowance: rules.standardAllowance,
                    contribution: '',
                    shortfall: 0,
                    carryForwardAvailable: 0,
                    carryForwardUsed: 0,
                    carryForwardRemaining: 0,
                    carryForwardBreakdown: [],
                    carryForwardUsedBreakdown: [],
                    carryForwardUsedByFuture: [],
                    canUseThisYear: rules.standardAllowance,
                    missingYearWarning: false
                });
            }
            setYears(initialYears);
        }
    }, []);

    // Save to localStorage whenever years change
    useEffect(() => {
        if (years.length > 0) {
            localStorage.setItem('pensionCalculatorData', JSON.stringify(years));
        }
    }, [years]);

    // UK Pension Rules by Tax Year
    const pensionRules = {
        2025: { standardAllowance: 60000, minimumAllowance: 10000, thresholdLimit: 200000, adjustedLimit: 260000 },
        2024: { standardAllowance: 60000, minimumAllowance: 10000, thresholdLimit: 200000, adjustedLimit: 260000 },
        2023: { standardAllowance: 60000, minimumAllowance: 10000, thresholdLimit: 200000, adjustedLimit: 260000 },
        2022: { standardAllowance: 40000, minimumAllowance: 4000, thresholdLimit: 200000, adjustedLimit: 240000 },
        2021: { standardAllowance: 40000, minimumAllowance: 4000, thresholdLimit: 200000, adjustedLimit: 240000 },
        2020: { standardAllowance: 40000, minimumAllowance: 4000, thresholdLimit: 200000, adjustedLimit: 240000 },
        2019: { standardAllowance: 40000, minimumAllowance: 10000, thresholdLimit: 110000, adjustedLimit: 150000 },
        2018: { standardAllowance: 40000, minimumAllowance: 10000, thresholdLimit: 110000, adjustedLimit: 150000 },
        2017: { standardAllowance: 40000, minimumAllowance: 10000, thresholdLimit: 110000, adjustedLimit: 150000 },
        2016: { standardAllowance: 40000, minimumAllowance: 10000, thresholdLimit: 110000, adjustedLimit: 150000 }
    };

    // Calculate tapered annual allowance based on UK rules by year
    const calculateTaperedAllowance = useCallback((thresholdIncome, adjustedIncome, year) => {
        const threshold = Math.round(parseFloat(thresholdIncome) || 0);
        const adjusted = Math.round(parseFloat(adjustedIncome) || 0);

        const yearInt = parseInt(year);
        const rules = pensionRules[yearInt] || pensionRules[2025]; // Default to latest rules

        if (threshold <= rules.thresholdLimit || adjusted <= rules.adjustedLimit) {
            return rules.standardAllowance;
        }

        const reduction = Math.floor((adjusted - rules.adjustedLimit) / 2);
        return Math.max(rules.minimumAllowance, rules.standardAllowance - reduction);
    }, []);

    // Calculate carry forward for all years
    const calculateCarryForward = useCallback((updatedYears) => {
        const processedYears = [...updatedYears];

        // Reset carry forward calculations
        processedYears.forEach(year => {
            const contribution = Math.round(parseFloat(year.contribution) || 0);
            year.shortfall = Math.round(Math.max(0, contribution - year.taperedAllowance));
            year.carryForwardAvailable = Math.round(Math.max(0, year.taperedAllowance - contribution));
            year.carryForwardUsed = 0;
            year.carryForwardRemaining = year.carryForwardAvailable;
            year.carryForwardBreakdown = []; // What this year used FROM previous years
            year.carryForwardUsedBreakdown = []; // What this year used FROM previous years (detailed)
            year.carryForwardUsedByFuture = []; // What future years used FROM this year
            year.canUseThisYear = year.taperedAllowance;
            year.missingYearWarning = false;
            year.originalCarryForward = year.carryForwardAvailable; // Store original amount before any is used
            year.carryForwardAvailableFromPrevious = 0; // Store what was available from previous years when processing this year
        });

        // Process each year's shortfall using carry forward from previous years
        for (let i = 0; i < processedYears.length; i++) {
            const currentYear = processedYears[i];
            let remainingShortfall = currentYear.shortfall;
            const usedBreakdown = [];

            // First, capture what carry forward is available from previous years for this year
            let availableFromPrevious = 0;
            for (let j = 1; j <= 3; j++) {
                const prevIndex = i - j;
                if (prevIndex >= 0) {
                    const prevYear = processedYears[prevIndex];
                    availableFromPrevious += prevYear.carryForwardRemaining;
                }
            }
            currentYear.carryForwardAvailableFromPrevious = Math.round(availableFromPrevious);

            if (remainingShortfall > 0) {
                // Use carry forward from up to 3 previous years (oldest first: Y-3, Y-2, Y-1)
                for (let j = 3; j >= 1 && remainingShortfall > 0; j--) {
                    const prevIndex = i - j;
                    if (prevIndex >= 0) {
                        const prevYear = processedYears[prevIndex];
                        const availableCarryForward = prevYear.carryForwardRemaining;
                        const toUse = Math.min(remainingShortfall, availableCarryForward);

                        if (toUse > 0) {
                            // Don't modify prevYear.carryForwardUsed - that tracks what prevYear used from ITS previous years
                            prevYear.carryForwardRemaining -= toUse;
                            currentYear.carryForwardUsed += toUse;
                            remainingShortfall -= toUse;

                            // Track what current year used from previous years
                            currentYear.carryForwardBreakdown.push({
                                fromYear: prevYear.taxYear,
                                amount: toUse,
                                remainingAfter: prevYear.carryForwardRemaining
                            });

                            usedBreakdown.push({
                                fromYear: prevYear.taxYear,
                                amount: toUse,
                                yearsAgo: j
                            });

                            // Track what future years used from this previous year
                            prevYear.carryForwardUsedByFuture.push({
                                usedByYear: currentYear.taxYear,
                                amount: toUse
                            });
                        }
                    }
                }
            }

            currentYear.carryForwardUsedBreakdown = usedBreakdown;
        }

        // Calculate "Can Use This Year" for all years after carry forward processing is complete
        for (let i = 0; i < processedYears.length; i++) {
            const currentYear = processedYears[i];
            let totalCanUse = currentYear.taperedAllowance;
            let missingYears = [];

            // Use the stored snapshot of available carry forward for this year
            let availableCarryForward = currentYear.carryForwardAvailableFromPrevious || 0;

            // Check for missing years to set warning
            for (let j = 1; j <= 3; j++) {
                const prevIndex = i - j;
                const expectedYear = currentYear.id - j;

                if (!(prevIndex >= 0 && processedYears[prevIndex].id === expectedYear)) {
                    // Year is missing
                    missingYears.push(expectedYear);
                }
            }

            currentYear.canUseThisYear = Math.round(totalCanUse + availableCarryForward);
            currentYear.missingYearWarning = missingYears.length > 0;
            currentYear.missingYears = missingYears;
        }

        return processedYears;
    }, []);

    // Update a specific field for a year
    const updateYear = useCallback((yearId, field, value) => {
        setYears(prevYears => {
            const updatedYears = prevYears.map(year => {
                if (year.id === yearId) {
                    const updated = { ...year, [field]: value };

                    // Recalculate tapered allowance if threshold or adjusted income changes
                    if (field === 'thresholdIncome' || field === 'adjustedIncome') {
                        updated.taperedAllowance = calculateTaperedAllowance(
                            field === 'thresholdIncome' ? value : year.thresholdIncome,
                            field === 'adjustedIncome' ? value : year.adjustedIncome,
                            year.id
                        );
                    }

                    return updated;
                }
                return year;
            });

            return calculateCarryForward(updatedYears);
        });
    }, [calculateTaperedAllowance, calculateCarryForward]);

    // Add a new year (either future or past)
    const addYear = useCallback((yearType = 'future') => {
        let newYearId;

        if (yearType === 'future') {
            const lastYear = years[years.length - 1];
            newYearId = lastYear ? lastYear.id + 1 : new Date().getFullYear();
        } else {
            const firstYear = years[0];
            newYearId = firstYear ? firstYear.id - 1 : new Date().getFullYear() - 4;
        }

        const rules = pensionRules[newYearId] || pensionRules[2025];
        const newYear = {
            id: newYearId,
            taxYear: `${newYearId}/${String(newYearId + 1).slice(-2)}`,
            thresholdIncome: '',
            adjustedIncome: '',
            taperedAllowance: rules.standardAllowance,
            contribution: '',
            shortfall: 0,
            carryForwardAvailable: 0,
            carryForwardUsed: 0,
            carryForwardRemaining: 0,
            carryForwardBreakdown: [],
            carryForwardUsedBreakdown: [],
            carryForwardUsedByFuture: [],
            canUseThisYear: rules.standardAllowance,
            missingYearWarning: false
        };

        setYears(prevYears => {
            const newYears = yearType === 'future'
                ? [...prevYears, newYear]
                : [newYear, ...prevYears];
            return calculateCarryForward(newYears.sort((a, b) => a.id - b.id));
        });
    }, [years, calculateCarryForward]);

    // Remove a year
    const removeYear = useCallback((yearId) => {
        if (years.length <= 1) return; // Keep at least one year
        setYears(prevYears => calculateCarryForward(prevYears.filter(year => year.id !== yearId)));
    }, [years.length, calculateCarryForward]);

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(amount || 0));
    };

    // Get amount class for styling
    const getAmountClass = (amount) => {
        if (amount > 0) return 'amount-positive';
        if (amount < 0) return 'amount-negative';
        return 'amount-neutral';
    };

    // Check if contribution exceeds total allowance
    const isOverContribution = (year) => {
        const contribution = Math.round(parseFloat(year.contribution) || 0);
        return contribution > year.canUseThisYear;
    };

    // Toggle row expansion
    const toggleRowExpansion = (yearId) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(yearId)) {
                newSet.delete(yearId);
            } else {
                newSet.add(yearId);
            }
            return newSet;
        });
    };

    // Calculate carry forward available from previous 3 years
    const getCarryForwardFromPrevious = (year) => {
        // Use the stored snapshot of what was available when this year was processed
        return year.carryForwardAvailableFromPrevious || 0;
    };

    // Calculate carry forward used from previous years for this year
    const getCarryForwardUsedFromPrevious = (year) => {
        // This should be the amount this year used from previous years
        // which is stored in year.carryForwardUsed
        return year.carryForwardUsed || 0;
    };

    // Calculate carry forward used by future years from this year
    const getCarryForwardUsedByFuture = (year) => {
        // This should be the amount future years have used from this year
        // which is carryForwardAvailable - carryForwardRemaining
        return year.carryForwardAvailable - year.carryForwardRemaining;
    };

    // Generate tooltip for carry forward from previous years (combined with used)
    const getCarryForwardFromPreviousTooltip = (year) => {
        let tooltip = `Carry Forward from Previous 3 Years:\n\n`;

        // Available section - show what was available when this year was processed
        tooltip += `Available when ${year.taxYear} was processed:\n`;
        let totalAvailableAtTime = 0;
        for (let j = 3; j >= 1; j--) {
            const prevYear = years.find(y => y.id === year.id - j);
            if (prevYear) {
                // Calculate what was available from this previous year when current year was processed
                let availableAtTime = prevYear.carryForwardAvailable;
                // Subtract what was used by years between prevYear and currentYear
                for (let k = prevYear.id + 1; k < year.id; k++) {
                    const intermediateYear = years.find(y => y.id === k);
                    if (intermediateYear && intermediateYear.carryForwardUsedBreakdown) {
                        const usedFromPrevYear = intermediateYear.carryForwardUsedBreakdown.find(u => u.fromYear === prevYear.taxYear);
                        if (usedFromPrevYear) {
                            availableAtTime -= usedFromPrevYear.amount;
                        }
                    }
                }
                tooltip += `${prevYear.taxYear}: ${formatCurrency(availableAtTime)} (originally ${formatCurrency(prevYear.carryForwardAvailable)})\n`;
                totalAvailableAtTime += availableAtTime;
            } else {
                tooltip += `${year.id - j}/${String(year.id - j + 1).slice(-2)} Missing: £0 (assumed)\n`;
            }
        }

        tooltip += `\nTotal Available: ${formatCurrency(totalAvailableAtTime)}\n`;
        tooltip += `Used: ${formatCurrency(year.carryForwardUsed || 0)}\n`;

        if (year.carryForwardUsedBreakdown && year.carryForwardUsedBreakdown.length > 0) {
            tooltip += `\nUsed from:\n`;
            const sortedBreakdown = year.carryForwardUsedBreakdown.sort((a, b) => b.yearsAgo - a.yearsAgo);
            sortedBreakdown.forEach(item => {
                tooltip += `• ${item.fromYear}: ${formatCurrency(item.amount)}\n`;
            });
        }

        return tooltip;
    };

    // Calculate total available carry forward for current year
    const getCurrentYearCarryForward = () => {
        if (years.length === 0) return 0;

        const currentYear = years[years.length - 1];
        return currentYear.canUseThisYear - currentYear.taperedAllowance;
    };

    // Generate tooltip content for carry forward to next years (with remaining)
    const getCarryForwardToNextYearsTooltip = (year) => {
        let tooltip = `${year.taxYear} Carry Forward to Next Years:\n\n`;
        tooltip += `Calculation:\n`;
        tooltip += `Tapered Allowance: ${formatCurrency(year.taperedAllowance)}\n`;
        tooltip += `Contribution: ${formatCurrency(Math.round(parseFloat(year.contribution) || 0))}\n`;

        const rawCalculation = year.taperedAllowance - Math.round(parseFloat(year.contribution) || 0);
        const contribution = Math.round(parseFloat(year.contribution) || 0);

        if (rawCalculation >= 0) {
            tooltip += `Carry Forward Available: ${formatCurrency(year.carryForwardAvailable)}\n`;
            tooltip += `(Allowance - Contribution = ${formatCurrency(year.taperedAllowance)} - ${formatCurrency(contribution)} = ${formatCurrency(rawCalculation)})\n\n`;
        } else {
            tooltip += `Carry Forward Available: ${formatCurrency(year.carryForwardAvailable)}\n`;
            tooltip += `(Allowance - Contribution = ${formatCurrency(year.taperedAllowance)} - ${formatCurrency(contribution)} = ${formatCurrency(rawCalculation)}, capped at £0)\n\n`;
        }

        tooltip += `Usage by future years:\n`;
        tooltip += `Used by future years: ${formatCurrency(getCarryForwardUsedByFuture(year))}\n`;
        tooltip += `Remaining for future years: ${formatCurrency(year.carryForwardRemaining)}\n`;

        if (year.carryForwardUsedByFuture && year.carryForwardUsedByFuture.length > 0) {
            tooltip += `\nBreakdown of usage:\n`;
            year.carryForwardUsedByFuture.forEach(item => {
                tooltip += `• ${item.usedByYear}: ${formatCurrency(item.amount)}\n`;
            });
        }

        return tooltip;
    };

    // Generate tooltip content for carry forward used
    const getCarryForwardUsedTooltip = (year) => {
        if (!year.carryForwardUsedBreakdown || year.carryForwardUsedBreakdown.length === 0) {
            return `No carry forward used in ${year.taxYear}`;
        }

        let tooltip = `Carry Forward Used in ${year.taxYear}:\n\n`;

        // Sort by years ago (oldest first)
        const sortedBreakdown = year.carryForwardUsedBreakdown.sort((a, b) => b.yearsAgo - a.yearsAgo);

        sortedBreakdown.forEach(item => {
            tooltip += `• ${formatCurrency(item.amount)} from ${item.fromYear} (Y-${item.yearsAgo})\n`;
        });

        return tooltip.trim();
    };

    // Generate tooltip content for "Total Allowance"
    const getTotalAllowanceTooltip = (year) => {
        let tooltip = `Total Allowance for ${year.taxYear}:\n\n`;
        tooltip += `Current Year Allowance: ${formatCurrency(year.taperedAllowance)}\n\n`;

        // Create array of previous 3 years with amounts available when this year was processed
        let prevYears = [];
        for (let j = 3; j >= 1; j--) {
            const prevYear = years.find(y => y.id === year.id - j);
            if (prevYear) {
                // Calculate what was available from this previous year when current year was processed
                let availableAtTime = prevYear.carryForwardAvailable;
                // Subtract what was used by years between prevYear and currentYear
                for (let k = prevYear.id + 1; k < year.id; k++) {
                    const intermediateYear = years.find(y => y.id === k);
                    if (intermediateYear && intermediateYear.carryForwardUsedBreakdown) {
                        const usedFromPrevYear = intermediateYear.carryForwardUsedBreakdown.find(u => u.fromYear === prevYear.taxYear);
                        if (usedFromPrevYear) {
                            availableAtTime -= usedFromPrevYear.amount;
                        }
                    }
                }
                prevYears.push({
                    taxYear: prevYear.taxYear,
                    amount: availableAtTime
                });
            } else {
                prevYears.push({
                    taxYear: `${year.id - j}/${String(year.id - j + 1).slice(-2)} Missing`,
                    amount: 0
                });
            }
        }

        // Sort by tax year (chronological order)
        prevYears.sort((a, b) => a.taxYear.localeCompare(b.taxYear));

        // Add each year to tooltip
        let carryForwardTotal = 0;
        prevYears.forEach(prevYear => {
            if (prevYear.taxYear.includes('Missing')) {
                tooltip += `${prevYear.taxYear}: £0 (assumed)\n`;
            } else {
                tooltip += `${prevYear.taxYear} Carry Forward: ${formatCurrency(prevYear.amount)}\n`;
                carryForwardTotal += prevYear.amount;
            }
        });

        tooltip += `\nTotal Carry Forward: ${formatCurrency(carryForwardTotal)}\n`;
        tooltip += `\nTotal Allowance: ${formatCurrency(year.taperedAllowance + carryForwardTotal)}`;

        if (year.missingYearWarning) {
            tooltip += `\n\n⚠️ Warning: Missing years ${year.missingYears.map(y => `${y}/${String(y + 1).slice(-2)}`).join(', ')}`;
            tooltip += `\nAssuming £0 carry forward from missing years`;
        }

        return tooltip;
    };

    return (
        <div className="app">
            <div className="header">
                <h1>UK Pension Calculator</h1>
                <p>Calculate your tapered annual allowance and carry forward with ease</p>
            </div>

            <div className="controls">
                <button className="btn btn-primary" onClick={() => addYear('past')}>
                    Add Earlier Year
                </button>
                <button className="btn btn-primary" onClick={() => addYear('future')}>
                    Add Later Year
                </button>
                <button className="btn btn-secondary" onClick={() => localStorage.removeItem('pensionCalculatorData')}>
                    Clear All Data
                </button>
            </div>

            <div className="table-container">
                <table className="pension-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Tax Year</th>
                            <th>Threshold Income</th>
                            <th>Adjusted Income</th>
                            <th>Tapered Allowance</th>
                            <th>Contribution</th>
                            <th>Shortfall</th>
                            <th>Carry Forward Available from Previous 3 Years (Used)</th>
                            <th>Carry Forward to Next Years (Remaining)</th>
                            <th>Total Allowance (Unused)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {years.map((year) => (
                            <React.Fragment key={year.id}>
                                <tr>
                                    <td className="expand-cell">
                                        <button
                                            className="expand-btn"
                                            onClick={() => toggleRowExpansion(year.id)}
                                            aria-label={expandedRows.has(year.id) ? "Collapse details" : "Expand details"}
                                        >
                                            {expandedRows.has(year.id) ? '▼' : '▶'}
                                        </button>
                                    </td>
                                    <td><strong>{year.taxYear}</strong></td>
                                    <td>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={year.thresholdIncome}
                                            onChange={(e) => updateYear(year.id, 'thresholdIncome', e.target.value)}
                                            placeholder="200000"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={year.adjustedIncome}
                                            onChange={(e) => updateYear(year.id, 'adjustedIncome', e.target.value)}
                                            placeholder="240000"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            className="calculated-field"
                                            value={formatCurrency(year.taperedAllowance)}
                                            readOnly
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={year.contribution}
                                            onChange={(e) => updateYear(year.id, 'contribution', e.target.value)}
                                            placeholder="0"
                                        />
                                    </td>
                                    <td>
                                        <span className={getAmountClass(year.shortfall)}>
                                            {formatCurrency(year.shortfall)}
                                        </span>
                                    </td>
                                    <td>
                                        <div>
                                            <span className={getAmountClass(getCarryForwardFromPrevious(year))}>
                                                {formatCurrency(getCarryForwardFromPrevious(year))}
                                            </span>
                                            <br />
                                            <span style={{ color: '#666', fontSize: '0.9em' }}>
                                                ({formatCurrency(getCarryForwardUsedFromPrevious(year))})
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <span className={getAmountClass(year.carryForwardAvailable)}>
                                                {formatCurrency(year.carryForwardAvailable)}
                                            </span>
                                            <br />
                                            <span style={{ color: '#666', fontSize: '0.9em' }}>
                                                ({formatCurrency(year.carryForwardRemaining)})
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <span className={`${isOverContribution(year) ? 'amount-negative' : getAmountClass(year.canUseThisYear)}`}>
                                                {formatCurrency(year.canUseThisYear)}
                                                {year.missingYearWarning && (
                                                    <span className="tooltip" style={{ marginLeft: '5px' }}>
                                                        <span style={{ color: '#ff9800', cursor: 'help' }}>⚠️</span>
                                                        <div className="tooltip-content">
                                                            Missing years: {year.missingYears.map(y => `${y}/${String(y + 1).slice(-2)}`).join(', ')}. Assuming £0 carry forward from missing years.
                                                        </div>
                                                    </span>
                                                )}
                                                {isOverContribution(year) && (
                                                    <span className="tooltip" style={{ marginLeft: '5px' }}>
                                                        <span style={{ color: '#f44336', cursor: 'help' }}>🚨</span>
                                                        <div className="tooltip-content">
                                                            Contribution ({formatCurrency(Math.round(parseFloat(year.contribution) || 0))}) exceeds total allowance ({formatCurrency(year.canUseThisYear)}). Excess contribution: {formatCurrency(Math.round(parseFloat(year.contribution) || 0) - year.canUseThisYear)}
                                                        </div>
                                                    </span>
                                                )}
                                            </span>
                                            <br />
                                            <span style={{ color: '#666', fontSize: '0.9em' }}>
                                                ({formatCurrency(year.canUseThisYear - Math.round(parseFloat(year.contribution) || 0))})
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        {years.length > 1 && (
                                            <button
                                                className="delete-btn"
                                                onClick={() => removeYear(year.id)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedRows.has(year.id) && (
                                    <tr className="expanded-row">
                                        <td colSpan="11" className="expanded-content">
                                            <div className="calculation-details">
                                                <div className="calculation-section">
                                                    <h4>Carry Forward from Previous 3 Years</h4>
                                                    <pre>{getCarryForwardFromPreviousTooltip(year)}</pre>
                                                </div>
                                                <div className="calculation-section">
                                                    <h4>Carry Forward to Next Years</h4>
                                                    <pre>{getCarryForwardToNextYearsTooltip(year)}</pre>
                                                </div>
                                                <div className="calculation-section">
                                                    <h4>Total Allowance Calculation</h4>
                                                    <pre>{getTotalAllowanceTooltip(year)}</pre>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {years.length > 0 && (
                <div className="summary-section">
                    <h3>Summary</h3>
                    <div className="summary-grid">
                        <div className="summary-item">
                            <div className="label">Current Year Available Carry Forward</div>
                            <div className="value">{formatCurrency(getCurrentYearCarryForward())}</div>
                        </div>
                        <div className="summary-item">
                            <div className="label">Current Year Allowance</div>
                            <div className="value">{formatCurrency(years[years.length - 1]?.taperedAllowance || 0)}</div>
                        </div>
                        <div className="summary-item">
                            <div className="label">Total Potential Contribution</div>
                            <div className="value">
                                {formatCurrency(years[years.length - 1]?.canUseThisYear || 0)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App; 