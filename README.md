# UK Pension Calculator

A React web application for calculating UK pension contributions with tapered annual allowance rules and carry forward calculations.

## Features

- **Accurate UK Pension Rules**: Uses correct annual allowance and tapered limits for each tax year (2016-2025)
- **Tapered Annual Allowance Calculation**: Automatically calculates your tapered annual allowance based on threshold income and adjusted income
- **Carry Forward Management**: Tracks and calculates carry forward from previous years (up to 3 years)
- **Interactive Table**: Add/remove financial years (past or future) with real-time calculations
- **"Can Use This Year" Column**: Shows total potential contribution including carry forward from previous 3 years
- **Missing Year Detection**: Warns when years are missing and shows assumptions being made
- **Detailed Tooltips**: Hover over amounts to see breakdown of calculations
- **Local Storage**: Data persists between sessions
- **Responsive Design**: Works on desktop and mobile devices

## UK Pension Rules Implemented

### Annual Allowance by Tax Year
- **2023/24 - 2025/26**: £60,000 standard, £10,000 minimum tapered
- **2016/17 - 2022/23**: £40,000 standard, varies minimum (£4,000 for 2020-2022, £10,000 others)

### Tapered Annual Allowance 
- **2023/24 onwards**: Taper when threshold > £200k AND adjusted > £260k
- **2020/21 - 2022/23**: Taper when threshold > £200k AND adjusted > £240k  
- **2016/17 - 2019/20**: Taper when threshold > £110k AND adjusted > £150k
- Reduction: £1 for every £2 of adjusted income over the limit

### Carry Forward Rules
- Can carry forward unused allowance from previous 3 years
- Oldest carry forward is used first
- Shows detailed breakdown when hovering over amounts

## How to Use

1. **Add Financial Years**: 
   - Click "Add Earlier Year" to add years before your data range
   - Click "Add Later Year" to add years after your data range
2. **Input Data**: 
   - Enter threshold income and adjusted income (tapered allowance calculates automatically)
   - Enter your pension contribution for each year
3. **View Results**: 
   - See shortfalls, carry forward available, used, and remaining
   - Check "Can Use This Year" to see total potential contribution
   - Hover over any amount for detailed breakdowns
   - Look for ⚠️ warnings indicating missing year assumptions
4. **Summary**: View total potential contribution for current year including carry forward

## Installation & Running

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Data Storage

- Data is automatically saved to browser's localStorage
- Use "Clear All Data" button to reset
- Ready for Firebase integration (data structure supports cloud storage)

## Column Descriptions

- **Tax Year**: Financial year (e.g., 2023/24)
- **Threshold Income**: Your threshold income for pension purposes
- **Adjusted Income**: Your adjusted income (usually total income + pension contributions)
- **Tapered Allowance**: Calculated annual allowance (may be reduced if high earner)
- **Contribution**: Amount you've contributed to pension this year
- **Shortfall**: Amount over your allowance (if any)
- **Carry Forward Available**: Unused allowance available for future years
- **Carry Forward Used**: Amount of previous years' allowance used this year (hover for breakdown)
- **Carry Forward Remaining**: Available carry forward after usage (hover for breakdown)
- **Can Use This Year**: Total potential contribution = allowance + available carry forward from previous 3 years (⚠️ if missing years)

## Future Enhancements

- Firebase authentication and cloud storage
- Export to PDF/Excel
- Multiple pension scheme support
- Historical rule changes for different tax years
- Pension input period tracking

## Technical Details

- Built with React 18
- Uses modern hooks (useState, useEffect, useCallback)
- Responsive CSS Grid and Flexbox layout
- Webpack build system
- ES6+ JavaScript 