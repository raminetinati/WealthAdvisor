# WealthAdvisor - Wealth & Singapore Property Forecaster

A modern, interactive financial planning and forecasting platform designed to help you model your wealth accumulation and evaluate Singapore real estate decisions with precision. Built with a sleek Glassmorphism UI, it provides real-time visualization of net worth, cash flow trajectories, and opportunity cost analysis.

---

## Tabs & Features

### 1. 📈 Wealth Forecaster
- **Interactive 20-Year Net Worth Trajectory**: Multi-asset stacked line chart powered by Chart.js (Stocks, Cash Savings, CPF OA).
- **Accurate Singapore Resident Income Tax (YA 2024+)**: Progressive income tax brackets with automatic CPF relief deduction.
- **CPF Contribution Simulator**: Ordinary Wage (OW) & Additional Wage (AW) ceilings with progressive rates for Citizens and PRs (Year 1, 2, and 3+).
- **Dynamic Expense Tracker**: Add, edit (in-place), and remove recurring monthly expenses with real-time net cash balance calculations.
- **Growth Levers**: Tune stock appreciation, dividend yields, salary increments, bonuses, and risk-free cash yields.

### 2. 🏠 Property vs. Stocks (Singapore) - Total AUM Modeling
- **Starting Assets & Monthly Savings Engine**:
  - Input initial Starting Cash and Starting Stock Portfolio (e.g. $1,000,000 starting AUM).
  - Input **Average Monthly Salary** ($12,000/mo) and **Monthly Contribution to Stocks** ($3,000/mo).
- **Two Competing Holistic Strategies**:
  - **Strategy A (Buy Property + Ongoing Investment)**:
    - Funds upfront purchase (Downpayment + BSD + ABSD + Legal fees) from Cash first, selling Stocks only for the remaining shortfall.
    - Remaining Stocks compound at stock CAGR + receive the ongoing **Base Monthly Investment ($3,000/mo)**.
    - Total AUM = Property Net Equity + Compounded Remaining Cash + Compounded Remaining Stocks.
  - **Strategy B (Rent & 100% Invested)**:
    - 100% of Starting Assets ($1.0M) remain invested from Day 1.
    - Pays monthly living rent ($4,200/mo).
    - Invests **Base Monthly Contribution ($3,000/mo)** PLUS **Monthly Rent vs. Buy Savings (+$2,545/mo)** = **$5,545/mo Total Monthly DCA** into stocks!
    - Total AUM = Compounded Starting Cash + Compounded Starting Stocks (with Total Monthly DCA).
- **Singapore Regulatory & Property Calculations**:
  - **Buyer's Stamp Duty (BSD)**: Progressive 6-tier IRAS residential rates (up to 6% on excess over $3M).
  - **Additional Buyer's Stamp Duty (ABSD)**: Precise 2023/2024+ schedules for SC (0%/20%/30%), PR (5%/30%/35%), Foreigners (60%), and US/FTA nationals (treated as SC).
  - **Ongoing Holding Costs**: IRAS tiered Property Tax (Owner-Occupied vs Non-Owner-Occupied), Condo MCST fees, maintenance reserves, and property insurance.
- **Analytics & Visualizations**:
  - Multi-line interactive chart comparing Total AUM (Strategy A vs Strategy B), Property Net Equity, and Remaining Stocks.
  - Summary cards displaying 30Y Total AUM, Winning Strategy with dollar lead, crossover year, and sunk costs.
  - Expandable **Year-by-Year AUM & Equity Ledger** and CSV export.

---

## Installation & Usage

1. Open `index.html` in any modern web browser.
2. Toggle between the **Wealth Forecaster** and **Property vs. Stocks (SG)** tabs at the top of the dashboard.
3. Adjust sliders or numerical inputs for instant interactive calculations.

---

## Technologies

- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables, Flexbox/Grid, Glassmorphism), Modern JavaScript (ES6+).
- **Visualization**: [Chart.js](https://www.chartjs.org/).
- **Zero Dependencies**: Pure static client-side web application.

---

## License

MIT License. Open-source for personal financial planning and evaluation.
