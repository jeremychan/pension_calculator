// UK Pension Rules by Tax Year
export const pensionRules = {
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
export const calculateTaperedAllowance = (thresholdIncome, adjustedIncome, year) => {
    const threshold = Math.round(parseFloat(thresholdIncome) || 0);
    const adjusted = Math.round(parseFloat(adjustedIncome) || 0);

    const yearInt = parseInt(year);
    const rules = pensionRules[yearInt] || pensionRules[2025]; // Default to latest rules

    if (threshold <= rules.thresholdLimit || adjusted <= rules.adjustedLimit) {
        return rules.standardAllowance;
    }

    const reduction = Math.floor((adjusted - rules.adjustedLimit) / 2);
    return Math.max(rules.minimumAllowance, rules.standardAllowance - reduction);
};

// Calculate carry forward for all years
export const calculateCarryForward = (updatedYears) => {
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
}; 