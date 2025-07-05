import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Helper to format currency for comparisons
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(amount || 0));
};

describe('Pension Calculator Integration Test', () => {
    const originalGetFullYear = Date.prototype.getFullYear;

    beforeEach(() => {
        // Mock localStorage
        jest.spyOn(window.localStorage.__proto__, 'getItem').mockReturnValue(null);
        jest.spyOn(window.localStorage.__proto__, 'setItem');
        jest.spyOn(window.localStorage.__proto__, 'removeItem');

        // Mock getFullYear to ensure consistent test data
        Date.prototype.getFullYear = jest.fn(() => 2023);
    });

    afterEach(() => {
        // Restore original functions
        Date.prototype.getFullYear = originalGetFullYear;
        jest.restoreAllMocks();
    });

    test('should correctly calculate tapered allowance and carry forward based on the provided image', async () => {
        const user = userEvent.setup();
        render(<App />);

        // App initializes with 2020, 2021, 2022, 2023. Add 2024 and 2025.
        await user.click(screen.getByRole('button', { name: /Add Later Year/i }));
        await user.click(screen.getByRole('button', { name: /Add Later Year/i }));

        const testData = [
            {
                taxYear: '2020/21',
                thresholdIncome: '200000',
                adjustedIncome: '240000',
                contribution: '25000',
                expected: {
                    taperedAllowance: '£40,000',
                    shortfall: '£0',
                    carryForwardAvailableFromPrevious: '£0',
                    carryForwardUsedFromPrevious: '£0',
                    carryForwardToNextYears: '£15,000',
                    carryForwardRemaining: '£0',
                    totalAllowance: '£40,000',
                    unused: '£15,000',
                    missingWarning: true
                }
            },
            {
                taxYear: '2021/22',
                thresholdIncome: '140000',
                adjustedIncome: '160000',
                contribution: '25000',
                expected: {
                    taperedAllowance: '£40,000',
                    shortfall: '£0',
                    carryForwardAvailableFromPrevious: '£15,000',
                    carryForwardUsedFromPrevious: '£0',
                    carryForwardToNextYears: '£15,000',
                    carryForwardRemaining: '£0',
                    totalAllowance: '£55,000',
                    unused: '£30,000',
                    missingWarning: true
                }
            },
            {
                taxYear: '2022/23',
                thresholdIncome: '160000',
                adjustedIncome: '180000',
                contribution: '20000',
                expected: {
                    taperedAllowance: '£40,000',
                    shortfall: '£0',
                    carryForwardAvailableFromPrevious: '£30,000',
                    carryForwardUsedFromPrevious: '£0',
                    carryForwardToNextYears: '£20,000',
                    carryForwardRemaining: '£2,500',
                    totalAllowance: '£70,000',
                    unused: '£50,000',
                    missingWarning: true
                }
            },
            {
                taxYear: '2023/24',
                thresholdIncome: '290000',
                adjustedIncome: '330000',
                contribution: '44000',
                expected: {
                    taperedAllowance: '£25,000',
                    shortfall: '£19,000',
                    carryForwardAvailableFromPrevious: '£50,000',
                    carryForwardUsedFromPrevious: '£19,000',
                    carryForwardToNextYears: '£0',
                    carryForwardRemaining: '£0',
                    totalAllowance: '£75,000',
                    unused: '£31,000',
                    missingWarning: false
                }
            },
            {
                taxYear: '2024/25',
                thresholdIncome: '480000',
                adjustedIncome: '520000',
                contribution: '38500',
                expected: {
                    taperedAllowance: '£10,000',
                    shortfall: '£28,500',
                    carryForwardAvailableFromPrevious: '£31,000',
                    carryForwardUsedFromPrevious: '£28,500',
                    carryForwardToNextYears: '£0',
                    carryForwardRemaining: '£0',
                    totalAllowance: '£41,000',
                    unused: '£2,500',
                    missingWarning: false
                }
            },
            {
                taxYear: '2025/26',
                thresholdIncome: '400000',
                adjustedIncome: '500000',
                contribution: '0',
                expected: {
                    taperedAllowance: '£10,000',
                    shortfall: '£0',
                    carryForwardAvailableFromPrevious: '£2,500',
                    carryForwardUsedFromPrevious: '£0',
                    carryForwardToNextYears: '£10,000',
                    carryForwardRemaining: '£10,000',
                    totalAllowance: '£12,500',
                    unused: '£12,500',
                    missingWarning: false
                }
            }
        ];

        // Find all table rows
        const rows = screen.getAllByRole('row');

        // Input data for each year
        for (const yearData of testData) {
            const row = screen.getByRole('row', { name: new RegExp(yearData.taxYear) });

            const thresholdInput = within(row).getByPlaceholderText('200000');
            const adjustedInput = within(row).getByPlaceholderText('240000');
            const contributionInput = within(row).getByPlaceholderText('0');

            await user.clear(thresholdInput);
            await user.type(thresholdInput, yearData.thresholdIncome);

            await user.clear(adjustedInput);
            await user.type(adjustedInput, yearData.adjustedIncome);

            await user.clear(contributionInput);
            await user.type(contributionInput, yearData.contribution);
        }

        // Verify calculations for each year
        for (const yearData of testData) {
            const row = screen.getByRole('row', { name: new RegExp(yearData.taxYear) });
            const cells = within(row).getAllByRole('cell');

            // Tapered Allowance (cell 4)
            const taperedAllowanceInput = within(cells[4]).getByRole('textbox');
            expect(taperedAllowanceInput).toHaveValue(yearData.expected.taperedAllowance);

            // Shortfall (cell 6)
            expect(cells[6]).toHaveTextContent(yearData.expected.shortfall);

            // Carry Forward Available from Previous 3 Years (Used) (cell 7)
            const carryForwardAvailableText = yearData.expected.carryForwardAvailableFromPrevious + '(' + yearData.expected.carryForwardUsedFromPrevious + ')';
            expect(cells[7]).toHaveTextContent(carryForwardAvailableText);


            // Carry Forward to Next Years (Remaining) (cell 8)
            const carryForwardToNextYearsText = yearData.expected.carryForwardToNextYears + '(' + yearData.expected.carryForwardRemaining + ')';
            expect(cells[8]).toHaveTextContent(carryForwardToNextYearsText);


            // Total Allowance (Unused) (cell 9)
            const totalAllowanceCell = cells[9];
            expect(totalAllowanceCell).toHaveTextContent(yearData.expected.totalAllowance);
            expect(totalAllowanceCell).toHaveTextContent(`(${yearData.expected.unused})`);

            if (yearData.expected.missingWarning) {
                expect(within(totalAllowanceCell).getByText('⚠️')).toBeInTheDocument();
            } else {
                expect(within(totalAllowanceCell).queryByText('⚠️')).not.toBeInTheDocument();
            }
        }

        // No over-contribution with the new "nice" numbers, so no warning to check for.

    });
}); 