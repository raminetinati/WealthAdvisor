document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const FORECAST_YEARS = 20;

    // --- State Management ---
    const state = {
        annualIncome: 120000,
        currentSavings: 50000,
        stockPortfolio: 25000,
        stockReturn: 7.0, // Percentage
        dividendYield: 1.5, // Percentage
        annualRaise: 3.0, // Percentage
        annualBonus: 10,  // Percentage of income
        expenses: [ // Monthly expenses
            { id: 1, name: 'Rent/Mortgage', amount: 2500 },
            { id: 2, name: 'Food', amount: 600 },
            { id: 3, name: 'Utilities', amount: 200 },
            { id: 4, name: 'Transport', amount: 400 }
        ]
    };

    // --- DOM Elements ---
    const elements = {
        annualIncome: document.getElementById('annualIncome'),
        annualIncomeRange: document.getElementById('annualIncomeRange'),
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

        // Expenses Elements
        expensesList: document.getElementById('expensesList'),
        newExpenseName: document.getElementById('newExpenseName'),
        newExpenseAmount: document.getElementById('newExpenseAmount'),
        addExpenseBtn: document.getElementById('addExpenseBtn'),
        totalExpensesDisplay: document.getElementById('totalExpensesDisplay'),

        taxDisplay: document.getElementById('taxDisplay'), // New Element

        netWorth10y: document.getElementById('netWorth10y'),
        totalPrincipal: document.getElementById('totalPrincipal'),
        totalInterest: document.getElementById('totalInterest'),

        chartCanvas: document.getElementById('wealthChart')
    };

    // --- Chart Initialization ---
    let wealthChart;

    function initChart() {
        const ctx = elements.chartCanvas.getContext('2d');

        // Gradient for lines
        const gradientMain = ctx.createLinearGradient(0, 0, 0, 400);
        gradientMain.addColorStop(0, 'rgba(6, 182, 212, 0.5)'); // Cyan
        gradientMain.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        wealthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: FORECAST_YEARS + 1 }, (_, i) => `Year ${i}`),
                datasets: [{
                    label: 'Net Worth',
                    data: [],
                    borderColor: '#06b6d4',
                    backgroundColor: gradientMain,
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#06b6d4',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
                                return ' ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
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
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // --- Logic & Forecasting ---

    // Simplified Progressive Tax Bracket (Singapore Resident YA 2024+)
    function calculateTax(income) {
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

    function calculateTotalMonthlyExpenses() {
        return state.expenses.reduce((sum, item) => sum + item.amount, 0);
    }

    function calculateForecast() {
        const dataPoints = [];
        let currentBaseIncome = state.annualIncome;
        let totalWealth = state.currentSavings + state.stockPortfolio;

        let accumulatedPrincipal = totalWealth;
        let currentAnnualTax = 0;

        dataPoints.push(totalWealth);

        for (let year = 1; year <= FORECAST_YEARS; year++) {
            // Apply Growth (Appreciation + Dividends Reinvested)
            const totalReturnRate = (state.stockReturn + state.dividendYield) / 100;
            const growthAmount = totalWealth * totalReturnRate;

            // Calculate Total Income for Year (Base + Bonus)
            const bonusAmount = currentBaseIncome * (state.annualBonus / 100);
            const totalAnnualIncome = currentBaseIncome + bonusAmount;

            // Calculate Tax
            const tax = calculateTax(totalAnnualIncome);
            if (year === 1) currentAnnualTax = tax; // Store Year 1 tax for display

            // Expenses
            const annualExpenses = calculateTotalMonthlyExpenses() * 12;

            // Investable Savings (Surplus)
            let contribution = totalAnnualIncome - tax - annualExpenses;
            if (contribution < 0) contribution = 0; // Cannot contribute negative

            totalWealth += growthAmount + contribution;
            accumulatedPrincipal += contribution;

            // Apply Raise to Base Income for next year
            currentBaseIncome = currentBaseIncome * (1 + (state.annualRaise / 100));

            dataPoints.push(totalWealth);
        }

        return {
            points: dataPoints,
            finalWealth: totalWealth,
            totalPrincipal: accumulatedPrincipal,
            totalGrowth: totalWealth - accumulatedPrincipal,
            year1Tax: currentAnnualTax
        };
    }

    function renderExpenses() {
        if (!elements.expensesList) return;

        elements.expensesList.innerHTML = '';
        state.expenses.forEach(exp => {
            const row = document.createElement('div');
            row.className = 'expense-row';
            row.innerHTML = `
                <div class="expense-info">
                    <span class="ex-name">${exp.name}</span>
                    <span class="ex-amount">$${exp.amount.toLocaleString()}</span>
                </div>
                <button class="btn-delete" data-id="${exp.id}">&times;</button>
            `;
            elements.expensesList.appendChild(row);
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

    function updateUI() {
        const results = calculateForecast();

        // Update Chart
        wealthChart.data.datasets[0].data = results.points;
        wealthChart.update();

        // Update Stats
        // 10Y is index 10
        const statYear = 10;
        const val10y = results.points[statYear] || 0;

        elements.netWorth10y.innerText = formatCurrency(val10y);
        elements.totalPrincipal.innerText = formatCurrency(results.totalPrincipal); // This is total principal by end of 20y currently, let's fix to match 20y or show 10y?
        // Let's make the stat card say "Net Worth (Year 20)" or just "Final Net Worth"? 
        // The label says 10Y. Let's show 10Y value.

        // Actually, let's update Total Saved/Interest to be based on the TOTAL forecast period (20y) for impact, 
        // but label the first box as "Net Worth (10y)"? That's confusing.
        // Let's change the logic to show the Final Result (20y) in the other boxes.

        elements.totalPrincipal.textContent = formatCurrency(results.totalPrincipal); // Logic above calculates total for full period
        elements.totalInterest.textContent = formatCurrency(results.totalGrowth);

        // Update the 10Y specific text just in case user cares about mid-term
        elements.netWorth10y.textContent = formatCurrency(val10y);

        // Update Tax Display
        elements.taxDisplay.textContent = formatCurrency(results.year1Tax);
        elements.taxDisplay.style.color = 'rgba(255, 99, 132, 1)'; // Reddish for tax

        // Update Total Expenses Display (Monthly)
        if (elements.totalExpensesDisplay) {
            const monthly = calculateTotalMonthlyExpenses();
            elements.totalExpensesDisplay.textContent = formatCurrency(monthly) + '/mo';
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
        elInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 0;

            state[key] = val;

            // Sync Range
            if (elRange) elRange.value = val;

            // Sync Display
            if (elDisplay) elDisplay.textContent = val + (isPercentage ? '%' : '');

            updateUI();
        });

        // Range -> State
        if (elRange) {
            elRange.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                state[key] = val;

                // Sync Input
                elInput.value = val;

                // Sync Display
                if (elDisplay) elDisplay.textContent = val + (isPercentage ? '%' : '');

                updateUI();
            });
        }
    }

    function setupListeners() {
        bindInput('annualIncome', elements.annualIncome, elements.annualIncomeRange);
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
    }

    // --- Boot ---
    initChart();
    setupListeners();
    renderExpenses();
    updateUI();
});
