"""PDF report generation for con-call transcripts and annual reports.

Uses reportlab's Platypus framework to produce professional-grade PDF
documents suitable for download by the frontend.
"""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    ConCall,
    ConsensusEstimate,
    IncomeStatement,
)

# ── colour palette ──────────────────────────────────────────────────────
HEADER_BG = colors.HexColor("#1a1f2e")
ACCENT = colors.HexColor("#4f7cff")
BODY_TEXT = colors.HexColor("#374151")
MUTED = colors.HexColor("#6b7280")
TABLE_HEADER_BG = colors.HexColor("#f3f4f6")
TABLE_ALT_BG = colors.HexColor("#fafbfc")

# ── shared helpers ──────────────────────────────────────────────────────


def _fmt(val: float | None, decimals: int = 2) -> str:
    if val is None:
        return "—"
    return f"{val:,.{decimals}f}"


def _fmt_pct(val: float | None) -> str:
    if val is None:
        return "—"
    return f"{val * 100:+.2f}%"


def _styles():
    ss = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("DocTitle", parent=ss["Title"], fontSize=20, leading=24, spaceAfter=6, textColor=colors.white),
        "subtitle": ParagraphStyle("DocSubtitle", parent=ss["Normal"], fontSize=11, leading=14, spaceAfter=2, textColor=colors.HexColor("#9ca3af")),
        "h1": ParagraphStyle("H1", parent=ss["Heading1"], fontSize=14, leading=18, spaceBefore=14, spaceAfter=6, textColor=ACCENT),
        "h2": ParagraphStyle("H2", parent=ss["Heading2"], fontSize=12, leading=15, spaceBefore=10, spaceAfter=4, textColor=HEADER_BG),
        "body": ParagraphStyle("Body", parent=ss["Normal"], fontSize=9.5, leading=13, spaceAfter=4, textColor=BODY_TEXT),
        "body_bold": ParagraphStyle("BodyBold", parent=ss["Normal"], fontSize=9.5, leading=13, spaceAfter=4, textColor=BODY_TEXT, fontName="Helvetica-Bold"),
        "small": ParagraphStyle("Small", parent=ss["Normal"], fontSize=8, leading=10, textColor=MUTED),
        "badge": ParagraphStyle("Badge", fontSize=8, leading=10, textColor=colors.white, alignment=TA_CENTER, spaceAfter=4),
        "cell_num": ParagraphStyle("CellNum", parent=ss["Normal"], fontSize=8.5, leading=11, alignment=TA_RIGHT, textColor=BODY_TEXT),
        "cell_label": ParagraphStyle("CellLabel", parent=ss["Normal"], fontSize=8.5, leading=11, textColor=BODY_TEXT),
        "header_cell": ParagraphStyle("HeaderCell", parent=ss["Normal"], fontSize=8.5, leading=11, textColor=colors.white, fontName="Helvetica-Bold"),
        "footer": ParagraphStyle("Footer", parent=ss["Normal"], fontSize=7, leading=9, textColor=MUTED, alignment=TA_CENTER),
    }


def _company_header(company: Company, styles: dict) -> list:
    industry_name = company.industry.name if company.industry else ""
    return [
        [Paragraph(company.name, styles["title"])],
        [Paragraph(f"{company.ticker}  |  {industry_name}", styles["subtitle"])],
    ]


def _header_table(rows: list) -> Table:
    t = Table(rows, colWidths=[6.5 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HEADER_BG),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
    ]))
    return t


def _badge(text: str, bg: str, styles: dict) -> Paragraph:
    return Paragraph(f'<font backcolor="{bg}">&nbsp;{text.upper()}&nbsp;</font>', styles["badge"])


def _key_val_row(label: str, value: str, styles: dict) -> list:
    return [
        Paragraph(label, styles["cell_label"]),
        Paragraph(value, styles["body_bold"]),
    ]


# ── concall PDF ─────────────────────────────────────────────────────────


def generate_concall_pdf(company: Company, concall: ConCall, actual_eps: float | None, consensus_eps: float | None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        topMargin=0.6 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
    )
    s = _styles()
    story: list = []

    # header
    story.append(_header_table(_company_header(company, s)))
    story.append(Spacer(1, 8))

    # call metadata
    perf_color = {"beat": "#059669", "inline": "#d97706", "miss": "#dc2626"}
    tone_color = {"confident": "#059669", "measured": "#d97706", "cautious": "#d97706", "defensive": "#dc2626", "evasive": "#dc2626"}

    story.append(Paragraph(f"Earnings Call Transcript", s["h1"]))
    meta_rows = [
        [Paragraph("Fiscal Period", s["cell_label"]), Paragraph(concall.fiscal_period, s["body_bold"]),
         Paragraph("Call Date", s["cell_label"]), Paragraph(str(concall.call_date), s["body_bold"])],
    ]
    if actual_eps is not None:
        meta_rows.append([
            Paragraph("Actual EPS", s["cell_label"]), Paragraph(f"${_fmt(actual_eps)}", s["body_bold"]),
            Paragraph("Consensus EPS", s["cell_label"]), Paragraph(f"${_fmt(consensus_eps)}" if consensus_eps else "—", s["body_bold"]),
        ])
    meta_rows.append([
        Paragraph("Performance", s["cell_label"]),
        _badge(concall.performance_bucket, perf_color.get(concall.performance_bucket, "#6b7280"), s),
        Paragraph("Tone", s["cell_label"]),
        _badge(concall.tone, tone_color.get(concall.tone, "#6b7280"), s),
    ])
    meta_rows.append([
        Paragraph("Tone Score", s["cell_label"]),
        Paragraph(f"{concall.tone_score:+.2f}", s["body_bold"]),
        Paragraph("Guided Revenue Growth (QoQ)", s["cell_label"]),
        Paragraph(f"{concall.guidance_revenue_growth * 100:+.2f}%", s["body_bold"]),
    ])

    meta_t = Table(meta_rows, colWidths=[1.3 * inch, 1.8 * inch, 1.5 * inch, 1.8 * inch])
    meta_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, TABLE_HEADER_BG),
    ]))
    story.append(meta_t)
    story.append(Spacer(1, 10))

    # management commentary
    story.append(Paragraph("Management Commentary", s["h1"]))
    statement_order = ["opening", "revenue", "margins", "guidance", "closing"]
    labels = {
        "opening": "Opening Remarks",
        "revenue": "Revenue Commentary",
        "margins": "Margin Commentary",
        "guidance": "Outlook & Guidance",
        "closing": "Closing Remarks",
    }
    for key in statement_order:
        text = concall.statements.get(key)
        if text:
            story.append(Paragraph(labels.get(key, key.replace("_", " ").title()), s["h2"]))
            story.append(Paragraph(text, s["body"]))
            story.append(Spacer(1, 4))

    # footer
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Generated by StockSim  |  {date.today().isoformat()}", s["footer"]))

    doc.build(story)
    return buf.getvalue()


# ── annual / quarterly report PDF ────────────────────────────────────────


def _build_fin_table(title: str, data: dict | None, styles: dict) -> list:
    """Return story elements for one financial statement table."""
    elements: list = []
    elements.append(Paragraph(title, styles["h1"]))
    if not data:
        elements.append(Paragraph("No data available for this period.", styles["body"]))
        return elements

    rows = [[Paragraph("Line Item", styles["header_cell"]), Paragraph("Value", styles["header_cell"])]]
    for key, value in data.items():
        label = key.replace("_", " ").title()
        formatted = _fmt(value) if isinstance(value, (int, float)) else str(value)
        rows.append([Paragraph(label, styles["cell_label"]), Paragraph(formatted, styles["cell_num"])])

    col_w = [4.2 * inch, 2.2 * inch]
    t = Table(rows, colWidths=col_w, repeatRows=1)
    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            table_style.append(("BACKGROUND", (0, i), (-1, i), TABLE_ALT_BG))
        table_style.append(("LINEBELOW", (0, i), (-1, i), 0.3, colors.HexColor("#e5e7eb")))

    t.setStyle(TableStyle(table_style))
    elements.append(t)
    elements.append(Spacer(1, 8))
    return elements


def _quarters_to_fiscal_year_label(periods: list[str]) -> str:
    """Given a sorted list of fiscal periods like ['2024Q1','2024Q2','2024Q3','2024Q4'],
    return a label like 'FY2024' if all four quarters of the same year are present,
    otherwise return the last period."""
    if len(periods) < 3:
        return periods[-1] if periods else "N/A"
    years = set(p[:4] for p in periods)
    if len(years) == 1:
        year = next(iter(years))
        present_qs = {p[4:] for p in periods}
        if present_qs == {"Q1", "Q2", "Q3", "Q4"}:
            return f"FY{year}"
    return periods[-1]


def generate_financial_report_pdf(
    company: Company,
    income: IncomeStatement | None,
    balance: BalanceSheet | None,
    cashflow: CashFlowStatement | None,
    fiscal_period: str,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        topMargin=0.6 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
    )
    s = _styles()
    story: list = []

    income_dict: dict | None = None
    balance_dict: dict | None = None
    cashflow_dict: dict | None = None

    if income:
        income_dict = dict(
            revenue=float(income.revenue),
            cogs=float(income.cogs),
            gross_profit=float(income.gross_profit),
            operating_expenses=float(income.operating_expenses),
            ebitda=float(income.ebitda),
            depreciation_amortization=float(income.depreciation_amortization),
            ebit=float(income.ebit),
            interest_expense=float(income.interest_expense),
            pretax_income=float(income.pretax_income),
            tax=float(income.tax),
            net_profit=float(income.net_profit),
            eps=float(income.eps),
            shares_diluted=float(income.shares_diluted),
        )

    if balance:
        balance_dict = dict(
            cash_and_equivalents=float(balance.cash_and_equivalents),
            receivables=float(balance.receivables),
            inventory=float(balance.inventory),
            current_assets=float(balance.current_assets),
            ppe=float(balance.ppe),
            intangibles=float(balance.intangibles),
            total_assets=float(balance.total_assets),
            payables=float(balance.payables),
            short_term_debt=float(balance.short_term_debt),
            current_liabilities=float(balance.current_liabilities),
            long_term_debt=float(balance.long_term_debt),
            total_debt=float(balance.total_debt),
            total_liabilities=float(balance.total_liabilities),
            shareholders_equity=float(balance.shareholders_equity),
            invested_capital=float(balance.invested_capital),
        )

    if cashflow:
        cashflow_dict = dict(
            operating_cash_flow=float(cashflow.operating_cash_flow),
            capex=float(cashflow.capex),
            free_cash_flow=float(cashflow.free_cash_flow),
            investing_cash_flow=float(cashflow.investing_cash_flow),
            financing_cash_flow=float(cashflow.financing_cash_flow),
            dividends_paid=float(cashflow.dividends_paid),
            buybacks=float(cashflow.buybacks),
            net_change_in_cash=float(cashflow.net_change_in_cash),
        )

    label = _quarters_to_fiscal_year_label([fiscal_period])

    story.append(_header_table(_company_header(company, s)))
    story.append(Spacer(1, 8))

    report_type = "Annual Report" if label.startswith("FY") else "Quarterly Report"
    story.append(Paragraph(f"{report_type}  —  {label}", s["h1"]))

    # key metrics highlight
    if income and balance:
        highlight_rows = [
            [Paragraph("Revenue", s["cell_label"]), Paragraph(f"${_fmt(float(income.revenue))}", s["body_bold"]),
             Paragraph("Net Profit", s["cell_label"]), Paragraph(f"${_fmt(float(income.net_profit))}", s["body_bold"])],
            [Paragraph("EPS", s["cell_label"]), Paragraph(f"${_fmt(float(income.eps))}", s["body_bold"]),
             Paragraph("Total Assets", s["cell_label"]), Paragraph(f"${_fmt(float(balance.total_assets))}", s["body_bold"])],
            [Paragraph("Total Equity", s["cell_label"]), Paragraph(f"${_fmt(float(balance.shareholders_equity))}", s["body_bold"]),
             Paragraph("Total Debt", s["cell_label"]), Paragraph(f"${_fmt(float(balance.total_debt))}", s["body_bold"])],
        ]

        net_margin = float(income.net_profit) / float(income.revenue) * 100 if float(income.revenue) > 0 else 0
        de_ratio = float(balance.total_debt) / float(balance.shareholders_equity) if float(balance.shareholders_equity) > 0 else 0
        highlight_rows.append([
            Paragraph("Net Margin", s["cell_label"]), Paragraph(f"{net_margin:.2f}%", s["body_bold"]),
            Paragraph("Debt / Equity", s["cell_label"]), Paragraph(f"{de_ratio:.2f}", s["body_bold"]),
        ])

        ht = Table(highlight_rows, colWidths=[1.2 * inch, 1.7 * inch, 1.2 * inch, 1.7 * inch])
        ht.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 0), (-1, -2), 0.5, TABLE_HEADER_BG),
        ]))
        story.append(Spacer(1, 4))
        story.append(Paragraph("Key Metrics", s["h2"]))
        story.append(ht)
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 4))

    # income statement
    story.extend(_build_fin_table("Income Statement", income_dict, s))

    # balance sheet
    story.append(PageBreak())
    story.extend(_build_fin_table("Balance Sheet", balance_dict, s))

    # cash flow
    story.append(PageBreak())
    story.extend(_build_fin_table("Cash Flow Statement", cashflow_dict, s))

    # footer
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Generated by StockSim  |  {date.today().isoformat()}", s["footer"]))

    doc.build(story)
    return buf.getvalue()
