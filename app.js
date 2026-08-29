document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // TAB NAVIGATION CONTROLLER
    // =========================================================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPane = document.getElementById(targetTabId);
            if (targetPane) {
                targetPane.classList.add('active');
            }

            // Trigger chart redraw on tab switch to avoid rendering glitches
            if (targetTabId === 'wealth-tab' && wealthChart) {
                wealthChart.resize();
            } else if (targetTabId === 'property-tab' && propertyChart) {
                propertyChart.resize();
            }
        });
    });

    // Helper: Currency Formatter
    function formatCurrency(num) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(num);
    }

    // =========================================================================
    // MODULE 1: WEALTH FORECASTER (ORIGINAL)
    // =========================================================================
    const FORECAST_YEARS = 20;

    const wealthState = {
        annualIncome: 120000,
        monthlyInvestment: 3000,
        currentSavings: 50000,
        stockPortfolio: 25000,
        stockReturn: 7.0,
        dividendYield: 1.5,
        annualRaise: 3.0,
        annualBonus: 10,
        cashInterest: 3.0,
        expenses: [
            { id: 1, name: 'Rent/Mortgage', amount: 2500 },
            { id: 2, name: 'Food', amount: 600 },
            { id: 3, name: 'Utilities', amount: 200 },
            { id: 4, name: 'Transport', amount: 400 }
        ],
        residencyStatus: 'citizen'
    };

    const wealthElements = {
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
        cashInterest: document.getElementById('cashInterest'),
        cashInterestVal: document.getElementById('cashInterestVal'),

        expensesList: document.getElementById('expensesList'),
        newExpenseName: document.getElementById('newExpenseName'),
        newExpenseAmount: document.getElementById('newExpenseAmount'),
        addExpenseBtn: document.getElementById('addExpenseBtn'),
        totalExpensesDisplay: document.getElementById('totalExpensesDisplay'),
        exportBtn: document.getElementById('exportBtn'),

        residencySelect: document.getElementById('residencyStatus'),
        estTaxDisplay: document.getElementById('estTaxDisplay'),
        cpfDisplay: document.getElementById('cpfDisplay'),
        effectiveRateDisplay: document.getElementById('effectiveRateDisplay'),

        netWorth10y: document.getElementById('netWorth10y'),
        cashBalanceDisplay: document.getElementById('cashBalanceDisplay'),
        totalPrincipal: document.getElementById('totalPrincipal'),
        totalInterest: document.getElementById('totalInterest'),

        chartCanvas: document.getElementById('wealthChart')
    };

    let wealthChart = null;

    function calculateAnnualCPF(annualGross, bonusPercent, status) {
        if (['foreigner', 'foreigner_resident', 'foreigner_non_resident', 'director', 'fta'].includes(status)) {
            return 0;
        }

        const monthlyGross = annualGross / 12;
        let cpfRate = 0.20;
        if (status === 'pr1') cpfRate = 0.05;
        if (status === 'pr2') cpfRate = 0.15;

        const owCeiling = 6800;
        const cappedOW = Math.min(monthlyGross, owCeiling);
        const annualOWCPF = (cappedOW * cpfRate) * 12;

        const annualBonusAmount = annualGross * (bonusPercent / 100);
        const totalOW = Math.min(monthlyGross, owCeiling) * 12;
        const awCeiling = Math.max(0, 102000 - totalOW);
        const cappedAW = Math.min(annualBonusAmount, awCeiling);
        const annualAWCPF = cappedAW * cpfRate;

        return annualOWCPF + annualAWCPF;
    }

    function calculateResidentTax(income) {
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
            return grossIncome * 0.24;
        }
        if (status === 'foreigner_non_resident') {
            const flatTax = grossIncome * 0.15;
            const residentTax = calculateResidentTax(grossIncome);
            return Math.max(flatTax, residentTax);
        }
        const chargeableIncome = Math.max(0, grossIncome - cpfAmount);
        return calculateResidentTax(chargeableIncome);
    }

    function calculateTotalMonthlyExpenses() {
        return wealthState.expenses.reduce((sum, item) => sum + item.amount, 0);
    }

    function calculateWealthForecast() {
        const labels = [];
        const stockData = [];
        const cashData = [];
        const cpfData = [];
        const netWorthData = [];

        let currentBaseIncome = wealthState.annualIncome;
        let currentStockWealth = wealthState.stockPortfolio;
        let currentCashWealth = wealthState.currentSavings;
        let currentCPFWealth = 0;

        let totalWealth = currentStockWealth + currentCashWealth + currentCPFWealth;
        let accumulatedPrincipal = currentStockWealth + currentCashWealth;

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

            const stockGrowthRate = (wealthState.stockReturn + wealthState.dividendYield) / 100;
            const cashGrowthRate = wealthState.cashInterest / 100;
            const cpfGrowthRate = 0.025;

            const stockGrowth = currentStockWealth * stockGrowthRate;
            const cashGrowth = currentCashWealth * cashGrowthRate;
            const cpfGrowth = currentCPFWealth * cpfGrowthRate;

            currentStockWealth += stockGrowth;
            currentCashWealth += cashGrowth;
            currentCPFWealth += cpfGrowth;

            const bonusAmount = currentBaseIncome * (wealthState.annualBonus / 100);
            const totalAnnualIncome = currentBaseIncome + bonusAmount;

            const cpf = calculateAnnualCPF(currentBaseIncome, wealthState.annualBonus, wealthState.residencyStatus);
            const tax = calculateTax(totalAnnualIncome, cpf, wealthState.residencyStatus);
            if (year === 1) {
                results.year1Tax = tax;
                results.year1CPF = cpf;
            }

            const annualInvestment = wealthState.monthlyInvestment * 12;
            currentStockWealth += annualInvestment;

            const annualExpenses = calculateTotalMonthlyExpenses() * 12;
            const netAnnualIncome = totalAnnualIncome - tax - cpf;
            const annualCashBalance = netAnnualIncome - annualExpenses - annualInvestment;

            const previousCashWealth = currentCashWealth;
            currentCashWealth += annualCashBalance;

            let actualCashFlow = annualCashBalance;
            if (currentCashWealth < 0) {
                currentCashWealth = 0;
                actualCashFlow = -previousCashWealth;
            }

            currentCPFWealth += cpf;
            totalWealth = currentStockWealth + currentCashWealth + currentCPFWealth;
            const totalContribution = annualInvestment + actualCashFlow + cpf;
            accumulatedPrincipal += totalContribution;

            currentBaseIncome = currentBaseIncome * (1 + (wealthState.annualRaise / 100));

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
        if (!wealthElements.expensesList) return;

        wealthElements.expensesList.innerHTML = '';
        wealthState.expenses.forEach(exp => {
            const row = document.createElement('div');
            row.className = 'expense-row';
            row.innerHTML = `
                <div class="expense-info">
                    <span class="ex-name" contenteditable="true" data-id="${exp.id}" data-type="name">${exp.name}</span>
                    <span class="ex-amount" contenteditable="true" data-id="${exp.id}" data-type="amount">$${exp.amount.toLocaleString()}</span>
                </div>
                <button class="btn-delete" data-id="${exp.id}">&times;</button>
            `;
            wealthElements.expensesList.appendChild(row);
        });

        document.querySelectorAll('#expensesList [contenteditable="true"]').forEach(el => {
            const saveEdit = (target) => {
                const id = parseInt(target.dataset.id);
                const type = target.dataset.type;
                const val = target.innerText.replace(/[^0-9a-zA-Z\s.]/g, '');

                const expense = wealthState.expenses.find(e => e.id === id);
                if (expense) {
                    if (type === 'name') expense.name = target.innerText;
                    if (type === 'amount') {
                        const num = parseFloat(val);
                        expense.amount = isNaN(num) ? 0 : num;
                    }
                    updateWealthUI();
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

        document.querySelectorAll('#expensesList .btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                wealthState.expenses = wealthState.expenses.filter(ex => ex.id !== id);
                updateWealthUI();
                renderExpenses();
            });
        });
    }

    function updateWealthChart(data) {
        const canvas = document.getElementById('wealthChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (wealthChart) {
            wealthChart.destroy();
        }

        const gradientStocks = ctx.createLinearGradient(0, 0, 0, 400);
        gradientStocks.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
        gradientStocks.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        const gradientCash = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCash.addColorStop(0, 'rgba(34, 197, 94, 0.45)');
        gradientCash.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

        const gradientCPF = ctx.createLinearGradient(0, 0, 0, 400);
        gradientCPF.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
        gradientCPF.addColorStop(1, 'rgba(234, 179, 8, 0.0)');

        wealthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Total Net Worth',
                        data: data.netWorthData,
                        borderColor: '#f8fafc',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        fill: false,
                        pointRadius: 0,
                        stack: 'total',
                        order: 0
                    },
                    {
                        label: 'Stocks',
                        data: data.stockData,
                        borderColor: '#06b6d4',
                        backgroundColor: gradientStocks,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        stack: 'wealth',
                        order: 1
                    },
                    {
                        label: 'Cash Savings',
                        data: data.cashData,
                        borderColor: '#22c55e',
                        backgroundColor: gradientCash,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        stack: 'wealth',
                        order: 2
                    },
                    {
                        label: 'CPF',
                        data: data.cpfData,
                        borderColor: '#eab308',
                        backgroundColor: gradientCPF,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        stack: 'wealth',
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
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += formatCurrency(context.parsed.y);
                                }
                                return label;
                            },
                            footer: function (tooltipItems) {
                                let sum = 0;
                                tooltipItems.forEach(function (tooltipItem) {
                                    if (tooltipItem.dataset.label !== 'Total Net Worth') {
                                        sum += tooltipItem.parsed.y;
                                    }
                                });
                                return 'Total: ' + formatCurrency(sum);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (value) {
                                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", compactDisplay: "short" }).format(value);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    function exportWealthCSV() {
        const results = calculateWealthForecast();
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

    function updateWealthUI() {
        const results = calculateWealthForecast();

        if (wealthElements.residencySelect) {
            wealthState.residencyStatus = wealthElements.residencySelect.value;
        }

        if (wealthElements.netWorth10y) {
            const netWorth10Val = results.netWorthData[10];
            wealthElements.netWorth10y.textContent = formatCurrency(netWorth10Val);
        }

        if (wealthElements.totalPrincipal) wealthElements.totalPrincipal.textContent = formatCurrency(results.totalPrincipal);
        if (wealthElements.totalInterest) wealthElements.totalInterest.textContent = formatCurrency(results.totalInterest);

        updateWealthChart({
            labels: results.labels,
            stockData: results.stockData,
            cashData: results.cashData,
            cpfData: results.cpfData,
            netWorthData: results.netWorthData
        });

        if (wealthElements.estTaxDisplay) wealthElements.estTaxDisplay.textContent = formatCurrency(results.year1Tax);
        if (wealthElements.cpfDisplay) wealthElements.cpfDisplay.textContent = formatCurrency(results.year1CPF);

        const totalIncomeRaw = wealthState.annualIncome * (1 + wealthState.annualBonus / 100);
        const rate = totalIncomeRaw > 0 ? (results.year1Tax / totalIncomeRaw) * 100 : 0;
        if (wealthElements.effectiveRateDisplay) wealthElements.effectiveRateDisplay.textContent = rate.toFixed(1) + '%';

        let monthlyExpenses = 0;
        if (wealthElements.totalExpensesDisplay) {
            monthlyExpenses = calculateTotalMonthlyExpenses();
            wealthElements.totalExpensesDisplay.textContent = formatCurrency(monthlyExpenses) + '/mo';
        }

        if (wealthElements.cashBalanceDisplay) {
            const netAnnualIncome = totalIncomeRaw - results.year1Tax - results.year1CPF;
            const netMonthlyIncome = netAnnualIncome / 12;
            const monthlyBalance = netMonthlyIncome - monthlyExpenses - wealthState.monthlyInvestment;

            wealthElements.cashBalanceDisplay.textContent = formatCurrency(monthlyBalance);
            wealthElements.cashBalanceDisplay.classList.remove('balance-positive', 'balance-negative');
            if (monthlyBalance >= 0) {
                wealthElements.cashBalanceDisplay.classList.add('balance-positive');
            } else {
                wealthElements.cashBalanceDisplay.classList.add('balance-negative');
            }
        }
    }

    function bindWealthInput(key, elInput, elRange, elDisplay = null, isPercentage = false) {
        if (elInput) {
            elInput.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                wealthState[key] = val;
                if (elRange) elRange.value = val;
                if (elDisplay) elDisplay.textContent = val + (isPercentage ? '%' : '');
                updateWealthUI();
            });
        }
        if (elRange) {
            elRange.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                wealthState[key] = val;
                if (elInput) elInput.value = val;
                if (elDisplay) elDisplay.textContent = val + (isPercentage ? '%' : '');
                updateWealthUI();
            });
        }
    }

    function setupWealthListeners() {
        bindWealthInput('annualIncome', wealthElements.annualIncome, wealthElements.annualIncomeRange);
        bindWealthInput('monthlyInvestment', wealthElements.monthlyInvestment, wealthElements.monthlyInvestmentRange);
        bindWealthInput('currentSavings', wealthElements.currentSavings, wealthElements.currentSavingsRange);
        bindWealthInput('stockPortfolio', wealthElements.stockPortfolio, wealthElements.stockPortfolioRange);

        bindWealthInput('stockReturn', wealthElements.stockReturn, wealthElements.stockReturn, wealthElements.stockReturnVal, true);
        bindWealthInput('dividendYield', wealthElements.dividendYield, wealthElements.dividendYield, wealthElements.dividendYieldVal, true);
        bindWealthInput('annualRaise', wealthElements.annualRaise, wealthElements.annualRaise, wealthElements.annualRaiseVal, true);
        bindWealthInput('annualBonus', wealthElements.annualBonus, wealthElements.annualBonus, wealthElements.annualBonusVal, true);
        bindWealthInput('cashInterest', wealthElements.cashInterest, null, wealthElements.cashInterestVal, true);

        if (wealthElements.addExpenseBtn) {
            wealthElements.addExpenseBtn.addEventListener('click', () => {
                const name = wealthElements.newExpenseName.value.trim();
                const amount = parseFloat(wealthElements.newExpenseAmount.value);
                if (name && amount > 0) {
                    const newId = wealthState.expenses.length > 0 ? Math.max(...wealthState.expenses.map(e => e.id)) + 1 : 1;
                    wealthState.expenses.push({ id: newId, name, amount });
                    wealthElements.newExpenseName.value = '';
                    wealthElements.newExpenseAmount.value = '';
                    updateWealthUI();
                    renderExpenses();
                }
            });
        }

        if (wealthElements.residencySelect) {
            wealthElements.residencySelect.addEventListener('change', (e) => {
                wealthState.residencyStatus = e.target.value;
                updateWealthUI();
            });
        }

        if (wealthElements.exportBtn) {
            wealthElements.exportBtn.addEventListener('click', exportWealthCSV);
        }
    }

    // =========================================================================
    // MODULE 2: SINGAPORE PROPERTY VS. STOCKS SIMULATOR
    // =========================================================================
    const propertyState = {
        startingCash: 300000, // Starting Cash ($)
        startingStocks: 700000, // Starting Stock Portfolio ($)
        monthlySalary: 12000, // Monthly Salary ($)
        monthlyInvestment: 3000, // Monthly Contribution to Stocks ($)
        price: 1800000,
        residency: 'sc', // sc, spr, foreigner, fta
        propertyCount: 1, // 1, 2, 3
        usage: 'own_stay', // own_stay, investment
        growthRate: 3.0, // % p.a.
        ltv: 75, // %
        loanTenure: 30, // years
        interestRate: 3.5, // % p.a.
        av: 48000, // Annual Value for property tax ($/yr)
        mcst: 400, // $/month
        maintenance: 150, // $/month
        insurance: 300, // $/year
        rentalIncome: 5500, // $/month (if investment)
        vacancyRate: 4.0, // % (if investment)
        agentFeePct: 4.17, // % (if investment)
        altRentCost: 4200, // $/month (Strategy B Living Rent)
        stockCagr: 8.0, // % p.a.
        stockDivYield: 2.0, // % p.a.
        cashInterest: 3.0, // % p.a.
        simTimeline: 30 // years
    };

    const propElements = {
        startingCash: document.getElementById('startingCash'),
        startingCashRange: document.getElementById('startingCashRange'),
        startingCashVal: document.getElementById('startingCashVal'),
        startingStocks: document.getElementById('startingStocks'),
        startingStocksRange: document.getElementById('startingStocksRange'),
        startingStocksVal: document.getElementById('startingStocksVal'),
        propMonthlySalary: document.getElementById('propMonthlySalary'),
        propMonthlySalaryRange: document.getElementById('propMonthlySalaryRange'),
        propMonthlySalaryVal: document.getElementById('propMonthlySalaryVal'),
        propMonthlyInvestment: document.getElementById('propMonthlyInvestment'),
        propMonthlyInvestmentRange: document.getElementById('propMonthlyInvestmentRange'),
        propMonthlyInvestmentVal: document.getElementById('propMonthlyInvestmentVal'),
        totalStartingAumDisplay: document.getElementById('totalStartingAumDisplay'),
        monthlyTakeHomeDisplay: document.getElementById('monthlyTakeHomeDisplay'),
        monthlySalaryTaxCpfDisplay: document.getElementById('monthlySalaryTaxCpfDisplay'),

        propPrice: document.getElementById('propPrice'),
        propPriceRange: document.getElementById('propPriceRange'),
        propPriceVal: document.getElementById('propPriceVal'),
        propResidency: document.getElementById('propResidency'),
        propCount: document.getElementById('propCount'),
        btnUsageOwnStay: document.getElementById('btnUsageOwnStay'),
        btnUsageInvestment: document.getElementById('btnUsageInvestment'),
        propGrowthRate: document.getElementById('propGrowthRate'),
        propGrowthRateVal: document.getElementById('propGrowthRateVal'),

        propLtv: document.getElementById('propLtv'),
        propLtvVal: document.getElementById('propLtvVal'),
        propLoanTenure: document.getElementById('propLoanTenure'),
        propLoanTenureVal: document.getElementById('propLoanTenureVal'),
        propInterestRate: document.getElementById('propInterestRate'),
        propInterestRateVal: document.getElementById('propInterestRateVal'),

        downpaymentPctDisplay: document.getElementById('downpaymentPctDisplay'),
        downpaymentDisplay: document.getElementById('downpaymentDisplay'),
        bsdDisplay: document.getElementById('bsdDisplay'),
        absdDisplay: document.getElementById('absdDisplay'),
        totalUpfrontDisplay: document.getElementById('totalUpfrontDisplay'),
        cashUsedDisplay: document.getElementById('cashUsedDisplay'),
        stocksSoldDisplay: document.getElementById('stocksSoldDisplay'),
        remainingCashDisplay: document.getElementById('remainingCashDisplay'),
        remainingStocksDisplay: document.getElementById('remainingStocksDisplay'),
        shortfallWarning: document.getElementById('shortfallWarning'),
        shortfallAmtDisplay: document.getElementById('shortfallAmtDisplay'),

        propAv: document.getElementById('propAv'),
        propAvVal: document.getElementById('propAvVal'),
        propMcst: document.getElementById('propMcst'),
        propMcstVal: document.getElementById('propMcstVal'),
        propMaintenance: document.getElementById('propMaintenance'),
        propMaintenanceVal: document.getElementById('propMaintenanceVal'),
        propInsurance: document.getElementById('propInsurance'),
        propInsuranceVal: document.getElementById('propInsuranceVal'),

        investmentFields: document.getElementById('investmentFields'),
        rentalIncome: document.getElementById('rentalIncome'),
        rentalIncomeVal: document.getElementById('rentalIncomeVal'),
        vacancyRate: document.getElementById('vacancyRate'),
        vacancyRateVal: document.getElementById('vacancyRateVal'),
        agentFeePct: document.getElementById('agentFeePct'),
        agentFeePctVal: document.getElementById('agentFeePctVal'),
        altRentCost: document.getElementById('altRentCost'),
        altRentCostVal: document.getElementById('altRentCostVal'),

        strategyATakeHomeDisplay: document.getElementById('strategyATakeHomeDisplay'),
        monthlyMortgageDisplay: document.getElementById('monthlyMortgageDisplay'),
        propTaxMonthlyDisplay: document.getElementById('propTaxMonthlyDisplay'),
        propMcstMonthlyDisplay: document.getElementById('propMcstMonthlyDisplay'),
        netMonthlyPropertyOutflowDisplay: document.getElementById('netMonthlyPropertyOutflowDisplay'),
        strategyAStockDcaDisplay: document.getElementById('strategyAStockDcaDisplay'),
        strategyAAvailableCashDisplay: document.getElementById('strategyAAvailableCashDisplay'),

        strategyBTakeHomeDisplay: document.getElementById('strategyBTakeHomeDisplay'),
        strategyBStartingAumDisplay: document.getElementById('strategyBStartingAumDisplay'),
        strategyBRentDisplay: document.getElementById('strategyBRentDisplay'),
        strategyBBaseDcaDisplay: document.getElementById('strategyBBaseDcaDisplay'),
        monthlyRentVsBuySavingsDisplay: document.getElementById('monthlyRentVsBuySavingsDisplay'),
        totalStrategyBMonthlyDcaDisplay: document.getElementById('totalStrategyBMonthlyDcaDisplay'),
        strategyBAvailableCashDisplay: document.getElementById('strategyBAvailableCashDisplay'),

        stockCagr: document.getElementById('stockCagr'),
        stockCagrVal: document.getElementById('stockCagrVal'),
        stockDivYield: document.getElementById('stockDivYield'),
        stockDivYieldVal: document.getElementById('stockDivYieldVal'),
        simTimeline: document.getElementById('simTimeline'),
        simTimelineVal: document.getElementById('simTimelineVal'),

        finalTotalPropAumDisplay: document.getElementById('finalTotalPropAumDisplay'),
        finalPropEquityAndLiquidSub: document.getElementById('finalPropEquityAndLiquidSub'),
        finalStockAumDisplay: document.getElementById('finalStockAumDisplay'),
        stockInvestedTotalSub: document.getElementById('stockInvestedTotalSub'),
        winnerDisplay: document.getElementById('winnerDisplay'),
        breakevenDisplay: document.getElementById('breakevenDisplay'),
        totalSunkCostsDisplay: document.getElementById('totalSunkCostsDisplay'),

        totalMortgageInterestDisplay: document.getElementById('totalMortgageInterestDisplay'),
        totalPropTaxesDisplay: document.getElementById('totalPropTaxesDisplay'),
        totalMcstDisplay: document.getElementById('totalMcstDisplay'),
        totalDutiesDisplay: document.getElementById('totalDutiesDisplay'),

        toggleLedgerBtn: document.getElementById('toggleLedgerBtn'),
        ledgerContainer: document.getElementById('ledgerContainer'),
        accordionArrow: document.getElementById('accordionArrow'),
        comparisonTableBody: document.getElementById('comparisonTableBody'),
        exportPropertyCsvBtn: document.getElementById('exportPropertyCsvBtn'),

        simYearsLabels: document.querySelectorAll('.simYearsLabel')
    };

    let propertyChart = null;

    // --- Singapore Tax & Stamp Duty Engines ---

    // Buyer's Stamp Duty (Residential 2023/2024+ Rates)
    function calculateBSD(price) {
        let bsd = 0;
        let remaining = price;

        if (remaining > 3000000) {
            bsd += (remaining - 3000000) * 0.06;
            remaining = 3000000;
        }
        if (remaining > 1500000) {
            bsd += (remaining - 1500000) * 0.05;
            remaining = 1500000;
        }
        if (remaining > 1000000) {
            bsd += (remaining - 1000000) * 0.04;
            remaining = 1000000;
        }
        if (remaining > 360000) {
            bsd += (remaining - 360000) * 0.03;
            remaining = 360000;
        }
        if (remaining > 180000) {
            bsd += (remaining - 180000) * 0.02;
            remaining = 180000;
        }
        if (remaining > 0) {
            bsd += remaining * 0.01;
        }
        return bsd;
    }

    // Additional Buyer's Stamp Duty (IRAS Schedules)
    function calculateABSD(price, residency, count) {
        let rate = 0;
        const countNum = parseInt(count);

        if (residency === 'sc' || residency === 'fta') {
            if (countNum === 1) rate = 0.0;
            else if (countNum === 2) rate = 0.20;
            else rate = 0.30;
        } else if (residency === 'spr') {
            if (countNum === 1) rate = 0.05;
            else if (countNum === 2) rate = 0.30;
            else rate = 0.35;
        } else if (residency === 'foreigner') {
            rate = 0.60;
        }
        return { rate, amount: price * rate };
    }

    // IRAS Annual Value Property Tax Engine
    function calculatePropertyTax(av, isOwnerOccupied) {
        let tax = 0;
        let remaining = Math.max(0, av);

        if (isOwnerOccupied) {
            // Revised 2024/2025 Owner-Occupied Progressive Brackets
            const tiers = [
                { limit: 12000, rate: 0.00 },
                { limit: 40000, rate: 0.04 },
                { limit: 50000, rate: 0.06 },
                { limit: 60000, rate: 0.10 },
                { limit: 70000, rate: 0.14 },
                { limit: 80000, rate: 0.20 },
                { limit: 100000, rate: 0.26 },
                { limit: Infinity, rate: 0.32 }
            ];
            let prevLimit = 0;
            for (const tier of tiers) {
                if (remaining > prevLimit) {
                    const portion = Math.min(remaining, tier.limit) - prevLimit;
                    tax += portion * tier.rate;
                    prevLimit = tier.limit;
                } else break;
            }
        } else {
            // Non-Owner-Occupied (Investment / Rented Out)
            const tiers = [
                { limit: 30000, rate: 0.12 },
                { limit: 45000, rate: 0.20 },
                { limit: 60000, rate: 0.28 },
                { limit: Infinity, rate: 0.36 }
            ];
            let prevLimit = 0;
            for (const tier of tiers) {
                if (remaining > prevLimit) {
                    const portion = Math.min(remaining, tier.limit) - prevLimit;
                    tax += portion * tier.rate;
                    prevLimit = tier.limit;
                } else break;
            }
        }
        return tax;
    }

    // Monthly Mortgage Payment Formula
    function calculateMonthlyMortgage(loanAmount, annualInterestRate, tenureYears) {
        if (loanAmount <= 0) return 0;
        const monthlyRate = (annualInterestRate / 100) / 12;
        const totalMonths = tenureYears * 12;
        if (monthlyRate === 0) return loanAmount / totalMonths;

        const factor = Math.pow(1 + monthlyRate, totalMonths);
        return loanAmount * (monthlyRate * factor) / (factor - 1);
    }

    // --- Main Strategy A vs Strategy B Simulation Engine ---
    function runPropertyVsStocksSimulation() {
        const timeline = propertyState.simTimeline;
        const totalStartingAum = propertyState.startingCash + propertyState.startingStocks;

        const price = propertyState.price;
        const ltv = propertyState.ltv;
        const loanAmount = price * (ltv / 100);
        const downpayment = price - loanAmount;

        const bsd = calculateBSD(price);
        const absdObj = calculateABSD(price, propertyState.residency, propertyState.propertyCount);
        const absd = absdObj.amount;
        const legalFees = 3000;
        const totalUpfrontPropertyOutlay = downpayment + bsd + absd + legalFees;

        // Funding Waterfall for Strategy A (Cash first, then sell stocks)
        const cashUsedForProperty = Math.min(propertyState.startingCash, totalUpfrontPropertyOutlay);
        const remainingCashAfterPurchase = propertyState.startingCash - cashUsedForProperty;
        const cashShortfall = totalUpfrontPropertyOutlay - cashUsedForProperty;

        const stocksSoldForProperty = Math.min(propertyState.startingStocks, cashShortfall);
        const remainingStocksAfterPurchase = propertyState.startingStocks - stocksSoldForProperty;
        const totalShortfall = Math.max(0, cashShortfall - stocksSoldForProperty);

        const monthlyMortgage = calculateMonthlyMortgage(loanAmount, propertyState.interestRate, propertyState.loanTenure);
        const isOwnerOccupied = propertyState.usage === 'own_stay';
        const annualPropertyTax = calculatePropertyTax(propertyState.av, isOwnerOccupied);

        const monthlyPropTax = annualPropertyTax / 12;
        const monthlyMcstAndInsurance = propertyState.mcst + propertyState.maintenance + (propertyState.insurance / 12);
        const totalMonthlyPropertyOutflow = monthlyMortgage + monthlyPropTax + monthlyMcstAndInsurance;

        // Rental vs Alternative Living Rent
        const grossMonthlyRent = propertyState.rentalIncome;
        const netRentalInflow = grossMonthlyRent * (1 - (propertyState.vacancyRate / 100)) - (grossMonthlyRent * (propertyState.agentFeePct / 100));

        // Income, Tax & CPF on Monthly Salary
        const annualGrossSalary = propertyState.monthlySalary * 12;
        const annualCpf = calculateAnnualCPF(annualGrossSalary, 0, propertyState.residency);
        const annualIncomeTax = calculateTax(annualGrossSalary, annualCpf, propertyState.residency);
        const monthlyIncomeTax = annualIncomeTax / 12;
        const monthlyCpf = annualCpf / 12;
        const monthlyTakeHome = propertyState.monthlySalary - monthlyIncomeTax - monthlyCpf;

        // Base Monthly Contribution from Income
        const baseMonthlyContribution = propertyState.monthlyInvestment;

        // Strategy A Monthly Available Cash = Take-Home - Property Outflow - Base Investment
        const strategyAPropertyCost = isOwnerOccupied ? totalMonthlyPropertyOutflow : (totalMonthlyPropertyOutflow - netRentalInflow);
        const strategyAAvailableCash = monthlyTakeHome - strategyAPropertyCost - baseMonthlyContribution;

        // Strategy B Monthly Available Cash = Take-Home - Living Rent - Base Investment
        const strategyBAvailableCash = monthlyTakeHome - propertyState.altRentCost - baseMonthlyContribution;

        // Monthly Rent vs Buy Cash Savings
        const monthlyRentSavingsDiff = strategyAPropertyCost - propertyState.altRentCost;
        const totalStrategyBMonthlyDca = baseMonthlyContribution + monthlyRentSavingsDiff;

        const labels = [];
        const propertyValues = [];
        const loanBalances = [];
        const propertyNetEquities = [];
        const remainingStocksData = [];
        const totalPropRouteAumData = [];
        const totalStockRouteAumData = [];
        const tableRows = [];

        const currentYear = new Date().getFullYear();
        let currentLoanBalance = loanAmount;
        let cumulativeNetRentalCashflows = 0;

        // Strategy A Liquid Assets (Cash & Stocks left over)
        let strategyACash = remainingCashAfterPurchase;
        let strategyAStocks = remainingStocksAfterPurchase;

        // Strategy B 100% Invested Portfolio (Full starting assets)
        let strategyBCash = propertyState.startingCash;
        let strategyBStocks = propertyState.startingStocks;

        let totalMortgageInterestPaid = 0;
        let totalPropertyTaxesPaid = 0;
        let totalMcstAndMaintPaid = 0;

        // Year 0
        const initialPropEquity = price - loanAmount; // Downpayment
        const initialStrategyATotalAum = initialPropEquity + strategyACash + strategyAStocks;
        const initialStrategyBTotalAum = strategyBCash + strategyBStocks;

        labels.push(String(currentYear));
        propertyValues.push(price);
        loanBalances.push(loanAmount);
        propertyNetEquities.push(initialPropEquity);
        remainingStocksData.push(strategyAStocks);
        totalPropRouteAumData.push(initialStrategyATotalAum);
        totalStockRouteAumData.push(initialStrategyBTotalAum);

        tableRows.push({
            yearNum: 0,
            calendarYear: currentYear,
            propertyValue: price,
            loanBalance: loanAmount,
            propertyNetEquity: initialPropEquity,
            remainingStocks: strategyAStocks,
            totalPropAum: initialStrategyATotalAum,
            totalStockAum: initialStrategyBTotalAum,
            diff: initialStrategyATotalAum - initialStrategyBTotalAum,
            winner: 'Tie'
        });

        const monthlyInterestRate = (propertyState.interestRate / 100) / 12;
        const stockAnnualReturn = (propertyState.stockCagr + propertyState.stockDivYield) / 100;
        const stockMonthlyReturn = Math.pow(1 + stockAnnualReturn, 1 / 12) - 1;
        const cashAnnualReturn = propertyState.cashInterest / 100;
        const cashMonthlyReturn = Math.pow(1 + cashAnnualReturn, 1 / 12) - 1;

        let breakevenYear = null;

        for (let y = 1; y <= timeline; y++) {
            const calYear = currentYear + y;
            labels.push(String(calYear));

            // 1. Property Valuation Growth
            const propApprec = Math.pow(1 + (propertyState.growthRate / 100), y);
            const currentPropValue = price * propApprec;
            propertyValues.push(currentPropValue);

            // 2. Month-by-month calculation for Year y
            let yearInterestPaid = 0;

            for (let m = 1; m <= 12; m++) {
                const isLoanActive = currentLoanBalance > 0.01;
                let monthMortgagePayment = isLoanActive ? monthlyMortgage : 0;

                if (isLoanActive) {
                    const interestForMonth = currentLoanBalance * monthlyInterestRate;
                    const principalForMonth = Math.min(currentLoanBalance, monthMortgagePayment - interestForMonth);
                    yearInterestPaid += interestForMonth;
                    currentLoanBalance = Math.max(0, currentLoanBalance - principalForMonth);
                }

                // Strategy A Outflow vs Strategy B Living Rent
                let monthSavingsDiff = 0;

                if (isOwnerOccupied) {
                    const monthlyPropertyNetOutflow = monthMortgagePayment + monthlyPropTax + monthlyMcstAndInsurance;
                    monthSavingsDiff = monthlyPropertyNetOutflow - propertyState.altRentCost;
                } else {
                    const monthlyPropertyNetOutflow = monthMortgagePayment + monthlyPropTax + monthlyMcstAndInsurance - netRentalInflow;
                    monthSavingsDiff = monthlyPropertyNetOutflow;
                    cumulativeNetRentalCashflows += (-monthlyPropertyNetOutflow);
                }

                // Grow Strategy A Liquid Assets (Cash Interest + Stocks Growth + Base Monthly Contribution from salary)
                strategyACash = strategyACash * (1 + cashMonthlyReturn);
                strategyAStocks = strategyAStocks * (1 + stockMonthlyReturn) + baseMonthlyContribution;

                // Grow Strategy B Liquid Assets (Cash + Stocks Growth + Base Monthly Contribution + Monthly Rent Savings Diff)
                strategyBCash = strategyBCash * (1 + cashMonthlyReturn);
                strategyBStocks = strategyBStocks * (1 + stockMonthlyReturn) + baseMonthlyContribution + monthSavingsDiff;
            }

            totalMortgageInterestPaid += yearInterestPaid;
            totalPropertyTaxesPaid += annualPropertyTax;
            totalMcstAndMaintPaid += (propertyState.mcst + propertyState.maintenance) * 12;

            loanBalances.push(currentLoanBalance);

            // Strategy A: Property Net Equity = Market Value - Remaining Debt (+ Cumulative Rental Profit if investment)
            const currentPropNetEquity = isOwnerOccupied 
                ? (currentPropValue - currentLoanBalance)
                : (currentPropValue - currentLoanBalance + cumulativeNetRentalCashflows);

            // Strategy A Total AUM = Property Equity + Compounded Remaining Cash + Compounded Remaining Stocks
            const currentTotalPropAum = currentPropNetEquity + strategyACash + strategyAStocks;

            // Strategy B Total AUM = Compounded Cash + Compounded Stocks
            const currentTotalStockAum = strategyBCash + strategyBStocks;

            propertyNetEquities.push(currentPropNetEquity);
            remainingStocksData.push(strategyAStocks);
            totalPropRouteAumData.push(currentTotalPropAum);
            totalStockRouteAumData.push(currentTotalStockAum);

            const netDiff = currentTotalPropAum - currentTotalStockAum;
            const winner = netDiff > 0 ? 'Strategy A (Buy)' : (netDiff < 0 ? 'Strategy B (Rent)' : 'Tie');

            if (breakevenYear === null && y > 1) {
                const prevDiff = tableRows[tableRows.length - 1].diff;
                if ((prevDiff < 0 && netDiff > 0) || (prevDiff > 0 && netDiff < 0)) {
                    breakevenYear = y;
                }
            }

            tableRows.push({
                yearNum: y,
                calendarYear: calYear,
                propertyValue: currentPropValue,
                loanBalance: currentLoanBalance,
                propertyNetEquity: currentPropNetEquity,
                remainingStocks: strategyAStocks,
                totalPropAum: currentTotalPropAum,
                totalStockAum: currentTotalStockAum,
                diff: netDiff,
                winner
            });
        }

        const finalTotalPropAum = totalPropRouteAumData[totalPropRouteAumData.length - 1];
        const finalStockAum = totalStockRouteAumData[totalStockRouteAumData.length - 1];
        const finalPropNetEquity = propertyNetEquities[propertyNetEquities.length - 1];
        const finalStrategyAStocks = remainingStocksData[remainingStocksData.length - 1];

        const totalSunkCosts = totalMortgageInterestPaid + totalPropertyTaxesPaid + totalMcstAndMaintPaid + bsd + absd + legalFees + (propertyState.insurance * timeline);

        return {
            timeline,
            labels,
            price,
            totalStartingAum,
            baseMonthlyContribution,
            monthlySalary: propertyState.monthlySalary,
            monthlyIncomeTax,
            monthlyCpf,
            monthlyTakeHome,
            downpayment,
            bsd,
            absd,
            legalFees,
            totalUpfrontPropertyOutlay,
            cashUsedForProperty,
            stocksSoldForProperty,
            remainingCashAfterPurchase,
            remainingStocksAfterPurchase,
            totalShortfall,
            monthlyMortgage,
            monthlyPropTax,
            monthlyMcstAndInsurance,
            annualPropertyTax,
            totalMonthlyPropertyOutflow,
            strategyAPropertyCost,
            strategyAAvailableCash,
            initialMonthlyRentSavings: monthlyRentSavingsDiff,
            totalStrategyBMonthlyDca,
            strategyBAvailableCash,
            propertyValues,
            loanBalances,
            propertyNetEquities,
            remainingStocksData,
            totalPropRouteAumData,
            totalStockRouteAumData,
            tableRows,
            finalTotalPropAum,
            finalStockAum,
            finalPropNetEquity,
            finalStrategyAStocks,
            breakevenYear,
            totalSunkCosts,
            totalMortgageInterestPaid,
            totalPropertyTaxesPaid,
            totalMcstAndMaintPaid,
            totalDuties: bsd + absd
        };
    }

    // --- Property Chart Renderer ---
    function updatePropertyChart(data) {
        const canvas = document.getElementById('propertyChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (propertyChart) {
            propertyChart.destroy();
        }

        const gradientPropAum = ctx.createLinearGradient(0, 0, 0, 440);
        gradientPropAum.addColorStop(0, 'rgba(168, 85, 247, 0.45)'); // Purple
        gradientPropAum.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

        const gradientStockAum = ctx.createLinearGradient(0, 0, 0, 440);
        gradientStockAum.addColorStop(0, 'rgba(6, 182, 212, 0.45)'); // Cyan
        gradientStockAum.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        propertyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Strategy A: Total AUM (Buy Property + Stocks)',
                        data: data.totalPropRouteAumData,
                        borderColor: '#a855f7', // Bright Purple
                        backgroundColor: gradientPropAum,
                        borderWidth: 3.5,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        order: 1
                    },
                    {
                        label: 'Strategy B: Total AUM (Rent & 100% Invested)',
                        data: data.totalStockRouteAumData,
                        borderColor: '#06b6d4', // Bright Cyan
                        backgroundColor: gradientStockAum,
                        borderWidth: 3.5,
                        tension: 0.35,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        order: 2
                    },
                    {
                        label: 'Strategy A: Property Net Equity',
                        data: data.propertyNetEquities,
                        borderColor: '#c084fc', // Light Purple
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.35,
                        fill: false,
                        pointRadius: 0,
                        order: 3
                    },
                    {
                        label: 'Strategy A: Remaining Stocks',
                        data: data.remainingStocksData,
                        borderColor: '#10b981', // Emerald
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [3, 3],
                        tension: 0.35,
                        fill: false,
                        pointRadius: 0,
                        order: 4
                    },
                    {
                        label: 'Remaining Mortgage Debt',
                        data: data.loanBalances,
                        borderColor: '#94a3b8', // Muted Slate
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [2, 2],
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0,
                        order: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            usePointStyle: true,
                            padding: 14,
                            font: { family: "'Outfit', sans-serif", size: 12 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#ffffff',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += formatCurrency(context.parsed.y);
                                }
                                return label;
                            },
                            footer: function (tooltipItems) {
                                let propAum = 0;
                                let stockAum = 0;
                                tooltipItems.forEach(item => {
                                    if (item.dataset.label.includes('Strategy A: Total AUM')) propAum = item.parsed.y;
                                    if (item.dataset.label.includes('Strategy B: Total AUM')) stockAum = item.parsed.y;
                                });
                                const delta = propAum - stockAum;
                                const leader = delta >= 0 ? 'Strategy A (Buy) leads by ' : 'Strategy B (Rent) leads by ';
                                return '\n' + leader + formatCurrency(Math.abs(delta));
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { family: "'Outfit', sans-serif" } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: "'Outfit', sans-serif" },
                            callback: function (value) {
                                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", compactDisplay: "short" }).format(value);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // --- Table Renderer ---
    function renderComparisonTable(rows) {
        if (!propElements.comparisonTableBody) return;
        propElements.comparisonTableBody.innerHTML = '';

        rows.forEach(r => {
            const tr = document.createElement('tr');
            const diffClass = r.diff >= 0 ? 'text-purple' : 'text-cyan';
            const badgeClass = r.winner.includes('Strategy A') ? 'badge-prop' : (r.winner.includes('Strategy B') ? 'badge-stock' : '');
            
            tr.innerHTML = `
                <td><strong>Year ${r.yearNum}</strong> (${r.calendarYear})</td>
                <td>${formatCurrency(r.propertyValue)}</td>
                <td>${formatCurrency(r.loanBalance)}</td>
                <td style="color: #c084fc;">${formatCurrency(r.propertyNetEquity)}</td>
                <td style="color: #10b981;">${formatCurrency(r.remainingStocks)}</td>
                <td style="color: #a855f7; font-weight: 700;">${formatCurrency(r.totalPropAum)}</td>
                <td style="color: #22d3ee; font-weight: 700;">${formatCurrency(r.totalStockAum)}</td>
                <td class="${diffClass}">${formatCurrency(Math.abs(r.diff))} ${r.diff >= 0 ? '(A)' : '(B)'}</td>
                <td><span class="badge-tag ${badgeClass}">${r.winner}</span></td>
            `;
            propElements.comparisonTableBody.appendChild(tr);
        });
    }

    // --- CSV Export for Property vs Stocks ---
    function exportPropertyCSV() {
        const sim = runPropertyVsStocksSimulation();
        let csv = 'Year,Calendar Year,Property Market Value,Remaining Mortgage Debt,Property Net Equity (Strategy A),Remaining Stocks (Strategy A),Total AUM (Strategy A: Buy),Total AUM (Strategy B: Rent & Invest),Net Difference,Leader\n';

        sim.tableRows.forEach(r => {
            csv += `${r.yearNum},${r.calendarYear},${r.propertyValue.toFixed(2)},${r.loanBalance.toFixed(2)},${r.propertyNetEquity.toFixed(2)},${r.remainingStocks.toFixed(2)},${r.totalPropAum.toFixed(2)},${r.totalStockAum.toFixed(2)},${r.diff.toFixed(2)},${r.winner}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'strategy_A_vs_strategy_B_aum_comparison.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // --- Master Property UI Update ---
    function updatePropertyUI() {
        const sim = runPropertyVsStocksSimulation();

        // Update Labels with current timeline
        propElements.simYearsLabels.forEach(el => {
            el.textContent = `${sim.timeline}Y`;
        });

        // Box 1: Starting AUM & Salary Take-Home display
        if (propElements.totalStartingAumDisplay) propElements.totalStartingAumDisplay.textContent = formatCurrency(sim.totalStartingAum);
        if (propElements.monthlyTakeHomeDisplay) propElements.monthlyTakeHomeDisplay.textContent = formatCurrency(sim.monthlyTakeHome) + '/mo';
        if (propElements.monthlySalaryTaxCpfDisplay) {
            const cpfLabel = sim.monthlyCpf > 0 ? formatCurrency(sim.monthlyCpf) + '/mo' : '$0/mo (No CPF for Foreigners)';
            propElements.monthlySalaryTaxCpfDisplay.textContent = `Tax: ${formatCurrency(sim.monthlyIncomeTax)}/mo | CPF: ${cpfLabel}`;
        }

        // Box 3: Upfront breakdown & Funding Waterfall
        if (propElements.downpaymentPctDisplay) propElements.downpaymentPctDisplay.textContent = `${100 - propertyState.ltv}%`;
        if (propElements.downpaymentDisplay) propElements.downpaymentDisplay.textContent = formatCurrency(sim.downpayment);
        if (propElements.bsdDisplay) propElements.bsdDisplay.textContent = formatCurrency(sim.bsd);
        if (propElements.absdDisplay) propElements.absdDisplay.textContent = formatCurrency(sim.absd);
        if (propElements.totalUpfrontDisplay) propElements.totalUpfrontDisplay.textContent = formatCurrency(sim.totalUpfrontPropertyOutlay);

        if (propElements.cashUsedDisplay) propElements.cashUsedDisplay.textContent = `-${formatCurrency(sim.cashUsedForProperty)}`;
        if (propElements.stocksSoldDisplay) propElements.stocksSoldDisplay.textContent = `-${formatCurrency(sim.stocksSoldForProperty)}`;
        if (propElements.remainingCashDisplay) propElements.remainingCashDisplay.textContent = formatCurrency(sim.remainingCashAfterPurchase);
        if (propElements.remainingStocksDisplay) propElements.remainingStocksDisplay.textContent = formatCurrency(sim.remainingStocksAfterPurchase);

        // Shortfall warning
        if (propElements.shortfallWarning) {
            if (sim.totalShortfall > 0) {
                propElements.shortfallWarning.classList.remove('hidden');
                if (propElements.shortfallAmtDisplay) propElements.shortfallAmtDisplay.textContent = sim.totalShortfall.toLocaleString();
            } else {
                propElements.shortfallWarning.classList.add('hidden');
            }
        }

        // Box 4: Strategy A Property Expenses & Cash Flow
        if (propElements.strategyATakeHomeDisplay) propElements.strategyATakeHomeDisplay.textContent = formatCurrency(sim.monthlyTakeHome) + '/mo';
        if (propElements.monthlyMortgageDisplay) propElements.monthlyMortgageDisplay.textContent = `-${formatCurrency(sim.monthlyMortgage)}/mo`;
        if (propElements.propTaxMonthlyDisplay) propElements.propTaxMonthlyDisplay.textContent = `-${formatCurrency(sim.monthlyPropTax)}/mo`;
        if (propElements.propMcstMonthlyDisplay) propElements.propMcstMonthlyDisplay.textContent = `-${formatCurrency(sim.monthlyMcstAndInsurance)}/mo`;
        if (propElements.netMonthlyPropertyOutflowDisplay) propElements.netMonthlyPropertyOutflowDisplay.textContent = `-${formatCurrency(sim.strategyAPropertyCost)}/mo`;
        if (propElements.strategyAStockDcaDisplay) propElements.strategyAStockDcaDisplay.textContent = `-${formatCurrency(sim.baseMonthlyContribution)}/mo`;
        
        if (propElements.strategyAAvailableCashDisplay) {
            const isNeg = sim.strategyAAvailableCash < 0;
            const sign = isNeg ? '-' : '+';
            propElements.strategyAAvailableCashDisplay.textContent = `${sign}${formatCurrency(Math.abs(sim.strategyAAvailableCash))}/mo`;
            propElements.strategyAAvailableCashDisplay.className = isNeg ? 'val-highlight text-rose font-lg' : 'val-highlight highlight-emerald font-lg';
        }

        // Box 5: Strategy B Rent & Cash Flow
        if (propElements.strategyBTakeHomeDisplay) propElements.strategyBTakeHomeDisplay.textContent = formatCurrency(sim.monthlyTakeHome) + '/mo';
        if (propElements.strategyBStartingAumDisplay) propElements.strategyBStartingAumDisplay.textContent = formatCurrency(sim.totalStartingAum);
        if (propElements.strategyBRentDisplay) propElements.strategyBRentDisplay.textContent = `-${formatCurrency(propertyState.altRentCost)}/mo`;
        if (propElements.strategyBBaseDcaDisplay) propElements.strategyBBaseDcaDisplay.textContent = `-${formatCurrency(sim.baseMonthlyContribution)}/mo`;

        if (propElements.strategyBAvailableCashDisplay) {
            const isNeg = sim.strategyBAvailableCash < 0;
            const sign = isNeg ? '-' : '+';
            propElements.strategyBAvailableCashDisplay.textContent = `${sign}${formatCurrency(Math.abs(sim.strategyBAvailableCash))}/mo`;
            propElements.strategyBAvailableCashDisplay.className = isNeg ? 'val-highlight text-rose font-lg' : 'val-highlight highlight-emerald font-lg';
        }

        if (propElements.monthlyRentVsBuySavingsDisplay) {
            const isNegative = sim.initialMonthlyRentSavings < 0;
            const sign = isNegative ? '-' : '+';
            propElements.monthlyRentVsBuySavingsDisplay.textContent = `${sign}${formatCurrency(Math.abs(sim.initialMonthlyRentSavings))}/mo`;
            propElements.monthlyRentVsBuySavingsDisplay.className = isNegative ? 'val-highlight text-rose font-lg' : 'val-highlight text-emerald font-lg';
        }

        if (propElements.totalStrategyBMonthlyDcaDisplay) {
            propElements.totalStrategyBMonthlyDcaDisplay.textContent = formatCurrency(sim.totalStrategyBMonthlyDca) + '/mo';
        }

        // Summary Top Cards
        if (propElements.finalTotalPropAumDisplay) propElements.finalTotalPropAumDisplay.textContent = formatCurrency(sim.finalTotalPropAum);
        if (propElements.finalPropEquityAndLiquidSub) {
            propElements.finalPropEquityAndLiquidSub.textContent = `Equity: ${formatCurrency(sim.finalPropNetEquity)} | Stocks: ${formatCurrency(sim.finalStrategyAStocks)}`;
        }
        if (propElements.finalStockAumDisplay) propElements.finalStockAumDisplay.textContent = formatCurrency(sim.finalStockAum);
        if (propElements.stockInvestedTotalSub) propElements.stockInvestedTotalSub.textContent = `Starting ${formatCurrency(sim.totalStartingAum)} + Base DCA (${formatCurrency(sim.baseMonthlyContribution)}/mo) + Rent Savings`;

        // Winner Card
        if (propElements.winnerDisplay) {
            const netFinalDelta = sim.finalTotalPropAum - sim.finalStockAum;
            if (Math.abs(netFinalDelta) < 1000) {
                propElements.winnerDisplay.textContent = 'Dead Heat (Tie)';
            } else if (netFinalDelta > 0) {
                propElements.winnerDisplay.textContent = `Strategy A (Buy) by ${formatCurrency(netFinalDelta)}`;
            } else {
                propElements.winnerDisplay.textContent = `Strategy B (Rent) by ${formatCurrency(Math.abs(netFinalDelta))}`;
            }
        }
        if (propElements.breakevenDisplay) {
            if (sim.breakevenYear) {
                propElements.breakevenDisplay.textContent = `Crossover: Year ${sim.breakevenYear}`;
            } else {
                const initialLeader = sim.tableRows[1].winner;
                propElements.breakevenDisplay.textContent = `${initialLeader} leads throughout`;
            }
        }

        // Sunk Costs & Breakdowns
        if (propElements.totalSunkCostsDisplay) propElements.totalSunkCostsDisplay.textContent = formatCurrency(sim.totalSunkCosts);
        if (propElements.totalMortgageInterestDisplay) propElements.totalMortgageInterestDisplay.textContent = formatCurrency(sim.totalMortgageInterestPaid);
        if (propElements.totalPropTaxesDisplay) propElements.totalPropTaxesDisplay.textContent = formatCurrency(sim.totalPropertyTaxesPaid);
        if (propElements.totalMcstDisplay) propElements.totalMcstDisplay.textContent = formatCurrency(sim.totalMcstAndMaintPaid);
        if (propElements.totalDutiesDisplay) propElements.totalDutiesDisplay.textContent = formatCurrency(sim.totalDuties);

        // Render Visuals
        updatePropertyChart(sim);
        renderComparisonTable(sim.tableRows);
    }

    function bindPropertyInput(key, elInput, elRange, elDisplay = null, formatType = 'raw') {
        if (elInput) {
            elInput.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 0;
                propertyState[key] = val;
                if (elRange) elRange.value = val;
                if (elDisplay) {
                    if (formatType === 'currency') elDisplay.textContent = formatCurrency(val);
                    else if (formatType === 'monthly') elDisplay.textContent = formatCurrency(val) + '/mo';
                    else if (formatType === 'percent') elDisplay.textContent = val.toFixed(1) + '%';
                    else if (formatType === 'years') elDisplay.textContent = val + ' Years';
                    else elDisplay.textContent = val;
                }
                updatePropertyUI();
            });
        }
        if (elRange) {
            elRange.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                propertyState[key] = val;
                if (elInput) elInput.value = val;
                if (elDisplay) {
                    if (formatType === 'currency') elDisplay.textContent = formatCurrency(val);
                    else if (formatType === 'monthly') elDisplay.textContent = formatCurrency(val) + '/mo';
                    else if (formatType === 'percent') elDisplay.textContent = val.toFixed(1) + '%';
                    else if (formatType === 'years') elDisplay.textContent = val + ' Years';
                    else elDisplay.textContent = val;
                }
                updatePropertyUI();
            });
        }
    }

    function setupPropertyListeners() {
        bindPropertyInput('startingCash', propElements.startingCash, propElements.startingCashRange, propElements.startingCashVal, 'currency');
        bindPropertyInput('startingStocks', propElements.startingStocks, propElements.startingStocksRange, propElements.startingStocksVal, 'currency');
        bindPropertyInput('monthlySalary', propElements.propMonthlySalary, propElements.propMonthlySalaryRange, propElements.propMonthlySalaryVal, 'monthly');
        bindPropertyInput('monthlyInvestment', propElements.propMonthlyInvestment, propElements.propMonthlyInvestmentRange, propElements.propMonthlyInvestmentVal, 'monthly');

        bindPropertyInput('price', propElements.propPrice, propElements.propPriceRange, propElements.propPriceVal, 'currency');
        bindPropertyInput('growthRate', propElements.propGrowthRate, propElements.propGrowthRate, propElements.propGrowthRateVal, 'percent');
        bindPropertyInput('ltv', propElements.propLtv, propElements.propLtv, propElements.propLtvVal, 'percent');
        bindPropertyInput('loanTenure', propElements.propLoanTenure, propElements.propLoanTenure, propElements.propLoanTenureVal, 'years');
        bindPropertyInput('interestRate', propElements.propInterestRate, propElements.propInterestRate, propElements.propInterestRateVal, 'percent');

        bindPropertyInput('av', propElements.propAv, null, propElements.propAvVal, 'currency');
        bindPropertyInput('mcst', propElements.propMcst, propElements.propMcst, propElements.propMcstVal, 'currency');
        bindPropertyInput('maintenance', propElements.propMaintenance, propElements.propMaintenance, propElements.propMaintenanceVal, 'currency');
        bindPropertyInput('insurance', propElements.propInsurance, propElements.propInsurance, propElements.propInsuranceVal, 'currency');

        bindPropertyInput('rentalIncome', propElements.rentalIncome, null, propElements.rentalIncomeVal, 'currency');
        bindPropertyInput('vacancyRate', propElements.vacancyRate, propElements.vacancyRate, propElements.vacancyRateVal, 'percent');
        bindPropertyInput('agentFeePct', propElements.agentFeePct, propElements.agentFeePct, propElements.agentFeePctVal, 'percent');
        bindPropertyInput('altRentCost', propElements.altRentCost, null, propElements.altRentCostVal, 'currency');

        bindPropertyInput('stockCagr', propElements.stockCagr, propElements.stockCagr, propElements.stockCagrVal, 'percent');
        bindPropertyInput('stockDivYield', propElements.stockDivYield, propElements.stockDivYield, propElements.stockDivYieldVal, 'percent');
        bindPropertyInput('simTimeline', propElements.simTimeline, propElements.simTimeline, propElements.simTimelineVal, 'years');

        // Selects
        if (propElements.propResidency) {
            propElements.propResidency.addEventListener('change', (e) => {
                propertyState.residency = e.target.value;
                updatePropertyUI();
            });
        }

        if (propElements.propCount) {
            propElements.propCount.addEventListener('change', (e) => {
                propertyState.propertyCount = parseInt(e.target.value);
                updatePropertyUI();
            });
        }

        // Segmented buttons for Usage (Own Stay vs Investment)
        if (propElements.btnUsageOwnStay && propElements.btnUsageInvestment) {
            propElements.btnUsageOwnStay.addEventListener('click', () => {
                propElements.btnUsageOwnStay.classList.add('active');
                propElements.btnUsageInvestment.classList.remove('active');
                propertyState.usage = 'own_stay';

                if (propElements.investmentFields) propElements.investmentFields.classList.add('hidden');
                updatePropertyUI();
            });

            propElements.btnUsageInvestment.addEventListener('click', () => {
                propElements.btnUsageInvestment.classList.add('active');
                propElements.btnUsageOwnStay.classList.remove('active');
                propertyState.usage = 'investment';

                if (propElements.investmentFields) propElements.investmentFields.classList.remove('hidden');
                updatePropertyUI();
            });
        }

        // Accordion Table Toggle
        if (propElements.toggleLedgerBtn && propElements.ledgerContainer) {
            propElements.toggleLedgerBtn.addEventListener('click', () => {
                const isHidden = propElements.ledgerContainer.classList.contains('hidden');
                if (isHidden) {
                    propElements.ledgerContainer.classList.remove('hidden');
                    if (propElements.accordionArrow) propElements.accordionArrow.classList.add('rotated');
                } else {
                    propElements.ledgerContainer.classList.add('hidden');
                    if (propElements.accordionArrow) propElements.accordionArrow.classList.remove('rotated');
                }
            });
        }

        if (propElements.exportPropertyCsvBtn) {
            propElements.exportPropertyCsvBtn.addEventListener('click', exportPropertyCSV);
        }
    }

    // =========================================================================
    // INITIALIZATION & BOOTSTRAP
    // =========================================================================
    setupWealthListeners();
    renderExpenses();
    updateWealthUI();

    setupPropertyListeners();
    updatePropertyUI();
});
