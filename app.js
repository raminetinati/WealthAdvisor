document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const FORECAST_YEARS = 20;

    // --- State Management ---
    const state = {
        annualIncome: 120000,
        monthlyInvestment: 3000, // New user input
        currentSavings: 50000,
        stockPortfolio: 25000,
        stockReturn: 7.0, // Percentage
        dividendYield: 1.5, // Percentage
        annualRaise: 3.0, // Percentage
        annualBonus: 10,  // Percentage of income
        cashInterest: 3.0, // New Percentage
        expenses: [ // Monthly expenses
            { id: 1, name: 'Rent/Mortgage', amount: 2500 },
            { id: 2, name: 'Food', amount: 600 },
            { id: 3, name: 'Utilities', amount: 200 },
            { id: 4, name: 'Transport', amount: 400 }
        ],
        residencyStatus: 'citizen' // citizen, pr1, pr2, foreigner_resident, foreigner_non_resident, director
    };

    // --- DOM Elements ---
    const elements = {
        annualIncome: document.getElementById('annualIncome'),
        annualIncomeRange: document.getElementById('annualIncomeRange'),
        monthlyInvestment: document.getElementById('monthlyInvestment'),
        monthlyInvestmentRange: document.getElementById('monthlyInvestmentRange'),
        currentSavings: document.getElementById('currentSavings'),
        currentSavingsRange: document.getElementById('currentSavingsRange'),
        stockPortfolio: document.getElementById('stockPortfolio'),
        stockPortfolioRange: document.getElementById('stockPortfolioRange'),

        stockReturn: document.getElementById('stockReturn'),
        stockReturnVal: document.getElementById('stockReturnVal'),
        dividendYield: document.getElementById('dividendYield'),
        dividendYieldVal: document.getElementById('dividendYieldVal'),
        annualRaise: document.getElementById('annualRaise'),
        annualRaiseVal: document.getElementById('annualRaiseVal'),
        annualBonus: document.getElementById('annualBonus'),
        annualBonusVal: document.getElementById('annualBonusVal'),
        cashInterest: document.getElementById('cashInterest'), // New Input
        cashInterestVal: document.getElementById('cashInterestVal'), // New Display

        // Expenses Elements
        expensesList: document.getElementById('expensesList'),
        newExpenseName: document.getElementById('newExpenseName'),
        newExpenseAmount: document.getElementById('newExpenseAmount'),
        addExpenseBtn: document.getElementById('addExpenseBtn'),
        totalExpensesDisplay: document.getElementById('totalExpensesDisplay'),
        exportBtn: document.getElementById('exportBtn'),

        // Tax & Residency Elements
        residencySelect: document.getElementById('residencyStatus'),
        estTaxDisplay: document.getElementById('estTaxDisplay'),
        cpfDisplay: document.getElementById('cpfDisplay'),
        effectiveRateDisplay: document.getElementById('effectiveRateDisplay'),

        netWorth10y: document.getElementById('netWorth10y'),
        cashBalanceDisplay: document.getElementById('cashBalanceDisplay'), // Renamed
        totalPrincipal: document.getElementById('totalPrincipal'),
        totalInterest: document.getElementById('totalInterest'),

        chartCanvas: document.getElementById('wealthChart')
    };

    // --- Chart Initialization ---
    let wealthChart;

    // --- Logic & Forecasting ---

    // Calculate Employee CPF Contribution (Annual)
    function calculateAnnualCPF(annualGross, bonusPercent, status) {
        if (['foreigner_resident', 'foreigner_non_resident', 'director'].includes(status)) {
            return 0;
        }

        // Simplification: Assume constant monthly income
        // CPF Wages = Ordinary Wages (capped) + Additional Wages (capped)
        // OW Ceiling 2024: $6,800. AW Ceiling: ($102,000 - Total OW).

        const monthlyGross = annualGross / 12; // Assuming base

        let cpfRate = 0.20; // Citizen / PR 3rd Year
        if (status === 'pr1') cpfRate = 0.05;
        if (status === 'pr2') cpfRate = 0.15;

        const owCeiling = 6800;
        const cappedOW = Math.min(monthlyGross, owCeiling);

        const annualOWCPF = (cappedOW * cpfRate) * 12;

        // Additional Wages (Bonus)
        const annualBonusAmount = annualGross * (bonusPercent / 100);
        const totalOW = Math.min(monthlyGross, owCeiling) * 12; // Used for AW Cap calc
        const awCeiling = Math.max(0, 102000 - totalOW);
        const cappedAW = Math.min(annualBonusAmount, awCeiling);

        const annualAWCPF = cappedAW * cpfRate;

        return annualOWCPF + annualAWCPF;
    }

    // Simplified Progressive Tax Bracket (Singapore Resident YA 2024+)
    function calculateResidentTax(income) {
        // No Standard Deduction applied automatically for simplicity (Chargeable Income assumed)
        let taxableIncome = Math.max(0, income);
        let tax = 0;

        const brackets = [
            { limit: 20000, rate: 0.00 },
            { limit: 30000, rate: 0.02 },
            { limit: 40000, rate: 0.035 },
            { limit: 80000, rate: 0.07 },
            { limit: 120000, rate: 0.115 },
            { limit: 160000, rate: 0.15 },
            { limit: 200000, rate: 0.18 },
            { limit: 240000, rate: 0.19 },
            { limit: 280000, rate: 0.195 },
            { limit: 320000, rate: 0.20 },
            { limit: 500000, rate: 0.22 },
            { limit: 1000000, rate: 0.23 },
            { limit: Infinity, rate: 0.24 }
        ];

        let previousLimit = 0;

        for (const bracket of brackets) {
            if (taxableIncome > previousLimit) {
                // Determine the portion of income in this bracket
                const upper = bracket.limit;
                const portion = Math.min(taxableIncome, upper) - previousLimit;

                tax += portion * bracket.rate;
                previousLimit = upper;
            } else {
                break;
            }
        }

        return tax;
    }

    function calculateTax(grossIncome, cpfAmount, status) {
        if (status === 'director') {
            // Flat 24% on Gross (No CPF ded)
            return grossIncome * 0.24;
        }

        if (status === 'foreigner_non_resident') {
            // Employment: Higher of Flat 15% OR Resident Rates (on Gross)
            const flatTax = grossIncome * 0.15;
            const residentTax = calculateResidentTax(grossIncome);
            return Math.max(flatTax, residentTax);
        }

        // Residents (Citizen, PR, Foreigner Tax Resident)
        // Chargeable Income = Gross - CPF
        const chargeableIncome = Math.max(0, grossIncome - cpfAmount);
        return calculateResidentTax(chargeableIncome);
    }

    function calculateTotalMonthlyExpenses() {
        return state.expenses.reduce((sum, item) => sum + item.amount, 0);
    }

    function calculateForecast() {
        const labels = [];
        const stockData = [];
        const cashData = [];
        const cpfData = [];
        const netWorthData = []; // Total

        let currentBaseIncome = state.annualIncome;

        // Initial Pots
        let currentStockWealth = state.stockPortfolio;
        let currentCashWealth = state.currentSavings;
        let currentCPFWealth = 0; // Assessing from today onwards for simplicity? Or should we ask for current CPF? 
        // Let's assume 0 or ask user later. For now 0.

        let totalWealth = currentStockWealth + currentCashWealth + currentCPFWealth;
        let accumulatedPrincipal = currentStockWealth + currentCashWealth;

        // Year 0
        const currentYear = new Date().getFullYear();
        labels.push(String(currentYear));
        stockData.push(currentStockWealth);
        cashData.push(currentCashWealth);
        cpfData.push(currentCPFWealth);
        netWorthData.push(totalWealth);

        let results = {
            year1Tax: 0,
            year1CPF: 0
        };

        for (let year = 1; year <= FORECAST_YEARS; year++) {
            labels.push(String(currentYear + year));

            // 1. Grow existing wealth
            const stockGrowthRate = (state.stockReturn + state.dividendYield) / 100;
            const cashGrowthRate = state.cashInterest / 100;
            const cpfGrowthRate = 0.025; // OA Rate approx

            const stockGrowth = currentStockWealth * stockGrowthRate;
            const cashGrowth = currentCashWealth * cashGrowthRate;
            const cpfGrowth = currentCPFWealth * cpfGrowthRate; // Interest on CPF

            currentStockWealth += stockGrowth;
            currentCashWealth += cashGrowth;
            currentCPFWealth += cpfGrowth;

            // 2. Add Inflows
            const bonusAmount = currentBaseIncome * (state.annualBonus / 100);
            const totalAnnualIncome = currentBaseIncome + bonusAmount;

            // Tax & CPF
            const cpf = calculateAnnualCPF(currentBaseIncome, state.annualBonus, state.residencyStatus);
            const tax = calculateTax(totalAnnualIncome, cpf, state.residencyStatus);
            if (year === 1) {
                results.year1Tax = tax;
                results.year1CPF = cpf;
            }

            // Inflow Logic
            // A. Monthly Investment -> Stocks
            const annualInvestment = state.monthlyInvestment * 12;
            currentStockWealth += annualInvestment;

            // B. Cash Balance -> Cash
            // Balance = Income - Tax - CPF - Expenses - (Investment)
            // Note: Expenses logic needs to be pulled here to be accurate, 
            // BUT UI depends on `calculateTotalMonthlyExpenses`.
            const annualExpenses = calculateTotalMonthlyExpenses() * 12;
            const netAnnualIncome = totalAnnualIncome - tax - cpf;
            const annualCashBalance = netAnnualIncome - annualExpenses - annualInvestment;

            // Allow negative cash balance to reduce cash wealth (burning savings)
            // Fix: track actual change to ensure Principal logic matches Wealth floor
            const previousCashWealth = currentCashWealth;
            currentCashWealth += annualCashBalance;

            let actualCashFlow = annualCashBalance;
            if (currentCashWealth < 0) {
                currentCashWealth = 0;
                actualCashFlow = -previousCashWealth; // You only lost what you had
            }

            // C. CPF Contribution -> CPF
            currentCPFWealth += cpf;

            // 3. Totals
            totalWealth = currentStockWealth + currentCashWealth + currentCPFWealth;
            const totalContribution = annualInvestment + actualCashFlow + cpf;
            accumulatedPrincipal += totalContribution;

            // Next Year Income
            currentBaseIncome = currentBaseIncome * (1 + (state.annualRaise / 100));

            // Push Data
            stockData.push(currentStockWealth);
            cashData.push(currentCashWealth);
            cpfData.push(currentCPFWealth);
            netWorthData.push(totalWealth);
        }

        results.labels = labels;
        results.stockData = stockData;
        results.cashData = cashData;
        results.cpfData = cpfData;
        results.netWorthData = netWorthData;
        results.totalWealth = totalWealth;
        results.totalPrincipal = accumulatedPrincipal;
        results.totalInterest = totalWealth - accumulatedPrincipal;

        return results;
    }

    function renderExpenses() {
        if (!elements.expensesList) return;

        elements.expensesList.innerHTML = '';
        state.expenses.forEach(exp => {
            const row = document.createElement('div');
            row.className = 'expense-row';
            row.innerHTML = `
                <div class="expense-info">
                    <span class="ex-name" contenteditable="true" data-id="${exp.id}" data-type="name">${exp.name}</span>
                    <span class="ex-amount" contenteditable="true" data-id="${exp.id}" data-type="amount">$${exp.amount.toLocaleString()}</span>
                </div>
                <button class="btn-delete" data-id="${exp.id}">&times;</button>
            `;
            elements.expensesList.appendChild(row);
        });

        // Add Edit Listeners (Blur and Enter)
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            const saveEdit = (target) => {
                const id = parseInt(target.dataset.id);
                const type = target.dataset.type;
                const val = target.innerText.replace(/[^0-9a-zA-Z\s.]/g, ''); // Simple cleanup

                const expense = state.expenses.find(e => e.id === id);
                if (expense) {
                    if (type === 'name') expense.name = target.innerText; // Keep raw text for name
                    if (type === 'amount') {
                        const num = parseFloat(val);
                        expense.amount = isNaN(num) ? 0 : num;
                    }
                    updateUI(); // Recalc stats
                    // Don't re-render list on blur to avoid losing focus if tabbing, 
                    // but for amount formatting we might want to?
                    // Let's re-render only if amount changed to format it back to $
                    if (type === 'amount') renderExpenses();
                }
            };

            el.addEventListener('blur', (e) => saveEdit(e.target));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });

        // Add Delete Listeners
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                state.expenses = state.expenses.filter(ex => ex.id !== id);
                updateUI();
                renderExpenses();
            });
        });
    }

    // --- Charting ---
    function updateChart(data) {
        const ctx = document.getElementById('wealthChart').getContext('2d');

        if (wealthChart) {
            wealthChart.destroy();
        }

        const gradientStocks = ctx.createLinearGradient(0, 0, 0, 400);
        gradientStocks.addColorStop(0, 'rgba(6, 182, 212, 0.5)'); // Cyan
        gradientStocks.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        const gradientCash = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCash.addColorStop(0, 'rgba(34, 197, 94, 0.5)'); // Green
        gradientCash.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

        const gradientCPF = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCPF.addColorStop(0, 'rgba(234, 179, 8, 0.5)'); // Yellow/Gold
        gradientCPF.addColorStop(1, 'rgba(234, 179, 8, 0.0)');

        wealthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Total Net Worth',
                        data: data.netWorthData,
                        borderColor: '#f8fafc', // Slate 50 (White-ish)
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0,
                        stack: 'total', // Separate stack so it overlays
                        order: 0 // Draw on top
                    },
                    {
                        label: 'Stocks',
                        data: data.stockData,
                        borderColor: '#06b6d4', // Cyan
                        backgroundColor: gradientStocks,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        stack: 'wealth', // Group components
                        order: 1
                    },
                    {
                        label: 'Cash Savings',
                        data: data.cashData,
                        borderColor: '#22c55e', // Green
                        backgroundColor: gradientCash,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        stack: 'wealth', // Group components
                        order: 2
                    },
                    {
                        label: 'CPF',
                        data: data.cpfData,
                        borderColor: '#eab308', // Yellow
                        backgroundColor: gradientCPF,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        stack: 'wealth', // Group components
                        order: 3
                    }
                ]

            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#94a3b8' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#94a3b8',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return label;
                            },
                            footer: function (tooltipItems) {
                                let sum = 0;
                                tooltipItems.forEach(function (tooltipItem) {
                                    // Only sum the components, ignore the Total line to avoid double counting
                                    if (tooltipItem.dataset.label !== 'Total Net Worth') {
                                        sum += tooltipItem.parsed.y;
                                    }
                                });
                                return 'Total: ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(sum);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category', // Explicitly set category to avoid linear interpolation of years
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        stacked: true, // Enable Stacking
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", compactDisplay: "short" }).format(value);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index', // Tooltip always shows data for the x-axis index closest to cursor
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    function exportToCSV() {
        const results = calculateForecast();

        let csv = 'Year,Stocks,Cash Savings,CPF,Total Net Worth\n';

        for (let i = 0; i < results.labels.length; i++) {
            csv += `${results.labels[i]},${results.stockData[i].toFixed(2)},${results.cashData[i].toFixed(2)},${results.cpfData[i].toFixed(2)},${(results.stockData[i] + results.cashData[i] + results.cpfData[i]).toFixed(2)}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'wealth_forecast.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function updateUI() {
        const results = calculateForecast();

        // Update Stats
        // The label says 10Y. Let's show 10Y value.
        // Actually, let's update Total Saved/Interest to be based on the TOTAL forecast period (20y) for impact, 
        // but label the first box as "Net Worth (10y)"? That's confusing.
        // Let's change the logic to show the Final Result (20y) in the other boxes.

        if (elements.residencySelect) state.residencyStatus = elements.residencySelect.value; // Init

        // --- Stats Updates ---
        // Update Net Worth (10Y)
        if (elements.netWorth10y) {
            // Index 10 is Year 10 (Year 0 is index 0)
            const netWorth10Val = results.netWorthData[10];
            elements.netWorth10y.textContent = formatCurrency(netWorth10Val);
        }

        // Total Saved & Interest remain as Final Totals (20Y)
        if (elements.totalPrincipal) elements.totalPrincipal.textContent = formatCurrency(results.totalPrincipal);
        if (elements.totalInterest) elements.totalInterest.textContent = formatCurrency(results.totalInterest);

        // Update Chart
        updateChart({
            labels: results.labels,
            stockData: results.stockData,
            cashData: results.cashData,
            cpfData: results.cpfData,
            netWorthData: results.netWorthData // Added
        });

        // Update Tax logic display
        if (elements.estTaxDisplay) elements.estTaxDisplay.textContent = formatCurrency(results.year1Tax);
        if (elements.cpfDisplay) elements.cpfDisplay.textContent = formatCurrency(results.year1CPF);

        // Effective Rate
        const totalIncomeRaw = state.annualIncome * (1 + state.annualBonus / 100);
        const rate = totalIncomeRaw > 0 ? (results.year1Tax / totalIncomeRaw) * 100 : 0;
        if (elements.effectiveRateDisplay) elements.effectiveRateDisplay.textContent = rate.toFixed(1) + '%';

        // Update Total Expenses Display (Monthly)
        let monthlyExpenses = 0;
        if (elements.totalExpensesDisplay) {
            monthlyExpenses = calculateTotalMonthlyExpenses();
            elements.totalExpensesDisplay.textContent = formatCurrency(monthlyExpenses) + '/mo';
        }

        // Monthly Investment Display (Now Cash Balance)
        if (elements.cashBalanceDisplay) {
            // Formula: (Total Income - Tax - CPF - Annual Expenses - Annual Investment) / 12
            const annualExpenses = monthlyExpenses * 12;
            const annualInvestment = state.monthlyInvestment * 12;

            // Net Annual Income = Gross + Bonus - Tax - CPF
            const netAnnualIncome = totalIncomeRaw - results.year1Tax - results.year1CPF;
            const netMonthlyIncome = netAnnualIncome / 12;

            // Balance = Net Monthly - Monthly Expenses - Monthly Investment
            const monthlyBalance = netMonthlyIncome - monthlyExpenses - state.monthlyInvestment;

            elements.cashBalanceDisplay.textContent = formatCurrency(monthlyBalance);

            // Styling
            elements.cashBalanceDisplay.classList.remove('balance-positive', 'balance-negative');
            if (monthlyBalance >= 0) {
                elements.cashBalanceDisplay.classList.add('balance-positive');
            } else {
                elements.cashBalanceDisplay.classList.add('balance-negative');
            }
        }
    }

    function formatCurrency(num) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(num);
    }

    // --- Input Handling ---
    function bindInput(key, elInput, elRange, elDisplay = null, isPercentage = false) {
        // Input -> State
        if (elInput) {
            elInput.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;

                state[key] = val;

                if (elRange) elRange.value = val;
                if (elDisplay) elDisplay.textContent = val + (isPercentage ? '%' : '');

                updateUI();
            });
        }

        // Range -> State
        if (elRange) {
            elRange.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                state[key] = val;

                if (elInput) elInput.value = val;
                if (elDisplay) elDisplay.textContent = val + (isPercentage ? '%' : '');

                updateUI();
            });
        }
    }

    function setupListeners() {
        bindInput('annualIncome', elements.annualIncome, elements.annualIncomeRange);
        bindInput('monthlyInvestment', elements.monthlyInvestment, elements.monthlyInvestmentRange);
        bindInput('currentSavings', elements.currentSavings, elements.currentSavingsRange);
        bindInput('stockPortfolio', elements.stockPortfolio, elements.stockPortfolioRange);

        bindInput('stockReturn', elements.stockReturn, elements.stockReturn, elements.stockReturnVal, true);
        bindInput('dividendYield', elements.dividendYield, elements.dividendYield, elements.dividendYieldVal, true);
        bindInput('annualRaise', elements.annualRaise, elements.annualRaise, elements.annualRaiseVal, true);
        bindInput('annualBonus', elements.annualBonus, elements.annualBonus, elements.annualBonusVal, true);

        // Expense Add
        if (elements.addExpenseBtn) {
            elements.addExpenseBtn.addEventListener('click', () => {
                const name = elements.newExpenseName.value.trim();
                const amount = parseFloat(elements.newExpenseAmount.value);

                if (name && amount > 0) {
                    const newId = state.expenses.length > 0 ? Math.max(...state.expenses.map(e => e.id)) + 1 : 1;
                    state.expenses.push({ id: newId, name, amount });
                    elements.newExpenseName.value = '';
                    elements.newExpenseAmount.value = '';
                    updateUI();
                    renderExpenses();
                }
            });
        }

        bindInput('cashInterest', elements.cashInterest, null, elements.cashInterestVal, true);

        // Residency Select
        if (elements.residencySelect) {
            elements.residencySelect.addEventListener('change', (e) => {
                state.residencyStatus = e.target.value;
                updateUI();
            });
        }

        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportToCSV);
        }
    }

    // --- Boot ---
    // initChart(); // Removed undefined function call
    setupListeners();
    renderExpenses();
    updateUI();
});
