"""Structured "About" profile data for every seeded company, keyed by ticker.

Complements company_descriptions.py (one-paragraph business summary) with the
discrete facts a real-world screener shows on a company profile page:
headquarters city, founding year, CEO name, employee headcount, and a one-line
unique-selling-point (USP) contrasting the company against its competitors.

employee_count / founded_year / headquarters / ceo are derived deterministically
(seeded by ticker) from each company's relative size and industry in
seed_companies.py, so headcount scales with shares_outstanding and industries
get plausible HQ cities and founding eras (e.g. utilities/banks skew older,
software/AI skew younger). USP lines are authored per company.
"""

import random

# ── Per-industry headquarters city pool (id -> list of "City, ST/Country") ──
INDUSTRY_HQ_CITIES: dict[int, list[str]] = {
    1: ["Charlotte, NC", "Columbus, OH", "Hartford, CT", "Kansas City, MO", "Minneapolis, MN"],
    2: ["San Jose, CA", "Austin, TX", "Seattle, WA", "Boston, MA", "Bengaluru, India"],
    3: ["Basel, Switzerland", "Indianapolis, IN", "Raleigh, NC", "Cambridge, MA", "New Jersey, NJ"],
    4: ["Cincinnati, OH", "Chicago, IL", "Minneapolis, MN", "Atlanta, GA", "London, UK"],
    5: ["Detroit, MI", "Stuttgart, Germany", "Nagoya, Japan", "Turin, Italy", "Toledo, OH"],
    6: ["Houston, TX", "Calgary, Canada", "Oklahoma City, OK", "Aberdeen, UK", "Dallas, TX"],
    7: ["Des Moines, IA", "Richmond, VA", "Phoenix, AZ", "Portland, OR", "Columbus, OH"],
    8: ["Perth, Australia", "Denver, CO", "Toronto, Canada", "Pittsburgh, PA", "Salt Lake City, UT"],
    9: ["Dallas, TX", "Chicago, IL", "Atlanta, GA", "Denver, CO", "Charlotte, NC"],
    10: ["New York, NY", "Chicago, IL", "San Francisco, CA", "Miami, FL", "Dallas, TX"],
    11: ["Atlanta, GA", "Denver, CO", "Reston, VA", "Basking Ridge, NJ", "Bellevue, WA"],
    12: ["Bentonville, AR", "Seattle, WA", "Minneapolis, MN", "Columbus, OH", "San Francisco, CA"],
    13: ["Milwaukee, WI", "Pittsburgh, PA", "Cleveland, OH", "Houston, TX", "Charlotte, NC"],
    14: ["Wilmington, DE", "Houston, TX", "Ludwigshafen, Germany", "Midland, MI", "Mumbai, India"],
    15: ["Los Angeles, CA", "New York, NY", "Atlanta, GA", "Burbank, CA", "London, UK"],
}

FIRST_NAMES = [
    "James", "Maria", "Wei", "Sarah", "David", "Priya", "Michael", "Elena", "Robert", "Aisha",
    "Thomas", "Yuki", "Jennifer", "Carlos", "Linda", "Ahmed", "Susan", "Daniel", "Grace", "Kevin",
]
LAST_NAMES = [
    "Whitfield", "Chen", "Okafor", "Nakamura", "Sullivan", "Patel", "Bergstrom", "Alvarez",
    "Kowalski", "Reyes", "Hartley", "Singh", "Fontaine", "Mercer", "Delgado", "Winslow",
    "Osei", "Lindqvist", "Abernathy", "Castellano",
]

# Rough founding-era ranges by industry (older/utility/banking skew earlier).
INDUSTRY_FOUNDING_RANGE: dict[int, tuple[int, int]] = {
    1: (1890, 1985),
    2: (1995, 2018),
    3: (1920, 1995),
    4: (1900, 1980),
    5: (1910, 1990),
    6: (1930, 1995),
    7: (1900, 1970),
    8: (1900, 1985),
    9: (1930, 2000),
    10: (1960, 2010),
    11: (1985, 2010),
    12: (1950, 2015),
    13: (1920, 1990),
    14: (1920, 1990),
    15: (1970, 2015),
}


# Overrides for companies whose business-summary description (in
# company_descriptions.py) implies a founding era that conflicts with their
# industry's default range — e.g. a "digitally native" consumer lender or a
# hypergrowth AI company should read as young even though banking/utilities
# otherwise skew toward much older founding years.
FOUNDING_YEAR_OVERRIDES: dict[str, int] = {
    "MCC": 2014,   # digitally native consumer lender
    "PAI": 2018,   # AI-native vertical model company
    "BGT": 2019,   # hypergrowth AI developer-tooling startup
    "GMN": 1958,   # broadcast affiliate network — should read older, not newer
    "UPC": 1931,   # power utility
    "ETE": 1957,   # district-heating utility, newer niche than legacy power/water
    "SVI": 2015,   # streaming service (medium can't predate broadband/streaming era)
    "ANT": 1998,   # embedded automotive software / OTA — should read modern, not 1947
}


def derive_profile(ticker: str, company_id: int, industry_id: int, shares_outstanding: int) -> dict:
    """Deterministically derive employee_count, founded_year, headquarters, ceo."""
    rng = random.Random(f"profile-{ticker}-{company_id}")

    cities = INDUSTRY_HQ_CITIES[industry_id]
    headquarters = cities[company_id % len(cities)]

    if ticker in FOUNDING_YEAR_OVERRIDES:
        founded_year = FOUNDING_YEAR_OVERRIDES[ticker]
    else:
        lo, hi = INDUSTRY_FOUNDING_RANGE[industry_id]
        founded_year = rng.randint(lo, hi)

    first = FIRST_NAMES[rng.randrange(len(FIRST_NAMES))]
    last = LAST_NAMES[rng.randrange(len(LAST_NAMES))]
    ceo = f"{first} {last}"

    # Employee count scales with share count (a rough size proxy already used
    # for market cap) plus industry-typical labor intensity per $ of scale.
    labor_intensity = {
        1: 0.9, 2: 0.5, 3: 0.7, 4: 1.1, 5: 1.3, 6: 0.6, 7: 0.5, 8: 1.0,
        9: 1.2, 10: 0.3, 11: 0.6, 12: 1.6, 13: 1.1, 14: 0.7, 15: 0.6,
    }[industry_id]
    base = (shares_outstanding / 1_000_000) * labor_intensity * rng.uniform(0.8, 1.25)
    employee_count = max(120, int(round(base * 15)))

    return {
        "employee_count": employee_count,
        "founded_year": founded_year,
        "headquarters": headquarters,
        "ceo": ceo,
    }


# ── One-line unique selling point per ticker, contrasted against competitors ──
COMPANY_USPS: dict[str, str] = {
    # Industry 1 – Banking & Financial Services
    "FNB": "Deepest small-business banker relationships of any mid-size retail bank in its footprint, with loan officers averaging 12+ years at the same branch.",
    "MCC": "Underwrites consumer credit using alternative data (cash-flow, rent history) to approve thin-file borrowers that FICO-only lenders decline.",
    "PFG": "Only regional bank with dedicated trade-finance desks in every major Pacific port city, cutting export LC turnaround from days to hours.",
    "AIB": "Senior bankers personally lead every deal from pitch to close, versus large banks that hand off to junior staff after mandate — clients cite this as the reason they return.",
    "CMT": "Trust officers manage under 40 client families each, roughly half the industry caseload, enabling multi-generational estate planning most private banks can't match.",
    "SIG": "Proprietary catastrophe-modeling engine, tuned on three decades of regional claims data, prices coastal property risk more precisely than national carriers.",
    "SFS": "Same-week equipment appraisal and funding turnaround versus the 3-4 week industry norm, because in-house appraisers travel to the collateral instead of outsourcing.",
    "HAM": "Runs at roughly half the expense ratio of peer institutional managers by keeping strategies benchmark-aware and headcount lean.",
    "PNB": "Loan officers are drawn from farming families themselves, giving underwriting judgment on agricultural cash-flow cycles that urban-trained bankers lack.",
    "CRF": "Proprietary telematics-based repayment scoring lets it price subprime auto risk more granularly than lenders relying on credit bureau data alone.",
    # Industry 2 – Information Technology / Software
    "NBS": "Purpose-built demand-forecasting models trained only on mid-market logistics data, outperforming generalist ERP forecasting modules on SKU-level accuracy.",
    "QDM": "One of the few vendors offering GPU-accelerated simulation software validated for aerospace-grade materials modeling, a niche the hyperscalers don't serve directly.",
    "ADS": "Focuses exclusively on legacy ERP and mainframe migrations, building playbooks the generalist cloud consultancies don't have for 20+ year old systems.",
    "CVS": "Backup infrastructure is architected as immutable/air-gapped by default, marketed specifically against ransomware — a stronger guarantee than bolt-on backup features from general storage vendors.",
    "WFT": "Website-builder templates ship with accessibility and Core Web Vitals compliance out of the box, reducing the retrofitting competitors' customers need later.",
    "DSI": "Data-pipeline platform charges by compute consumed rather than per-seat, undercutting per-seat competitors for data-heavy (not headcount-heavy) customers.",
    "CPS": "Cloud cost-optimization engine reallocates workloads in real time rather than producing monthly reports, catching savings competitors' batch tools miss.",
    "ICS": "Incident-response retainer includes a named senior analyst on 15-minute call, versus the industry-standard ticket queue during a live breach.",
    "GFA": "Analytics models are built industry-by-industry rather than as one generalist BI tool, giving domain-specific benchmarks larger vendors don't offer.",
    "PAI": "Ships fine-tuned vertical AI models (not a general chatbot wrapper), letting customers deploy faster than teams building on raw foundation-model APIs.",
    # Industry 3 – Pharmaceuticals & Healthcare
    "APX": "Pipeline concentrated in rare-disease indications with smaller trial populations, reaching approval faster than broad-indication competitors.",
    "BVL": "Proprietary biologics manufacturing process yields higher titer at lower cost than the industry-standard CHO cell lines used by most peers.",
    "MCH": "Owns both the diagnostic and the therapy for several of its target conditions, a companion-diagnostic model most single-product competitors can't replicate.",
    "NXT": "Focuses R&D exclusively on second-generation oncology therapies designed to overcome resistance to first-generation drugs already on the market.",
    "PMD": "Devices are designed for single-handed use in ambulance and field settings, a usability edge over hospital-only competitor designs.",
    "VBS": "Runs the shortest average trial-to-filing timeline in its peer set by concentrating on biomarker-driven adaptive trial designs.",
    "CVH": "Hospital network's average patient wait time is under half the regional benchmark, driven by a staffing model competitors haven't replicated.",
    "GHP": "Generic manufacturing footprint is vertically integrated from API to finished dose, insulating margins from the API-supply shocks that hit peers.",
    "PCD": "Diagnostic turnaround time is same-day versus the 2-3 day industry standard, using in-house lab automation rather than outsourced reference labs.",
    "OSI": "Surgical instruments are designed around a single reusable platform across procedure types, cutting hospital sterilization costs versus single-use competitors.",
    # Industry 4 – FMCG / Consumer Staples
    "EEC": "Broadest household-staples distribution network of any peer, reaching small-format independent retailers that larger CPG competitors skip.",
    "PHP": "Formulates every product line without the synthetic fragrance additives common industry-wide, a claim independently certified rather than self-reported.",
    "SFL": "Vertically integrated from farm contracts to shelf, insulating margins from the commodity input swings that squeeze peers without owned supply.",
    "CBI": "Regional bottling footprint lets it restock convenience stores within 24 hours, versus the 3-5 day replenishment cycle of national beverage rivals.",
    "EFC": "Private-label manufacturing arm lets it match branded competitors' shelf price while retaining a wider margin.",
    "HGH": "Only major hygiene-products maker with dissolvable, plastic-free packaging across its full line, ahead of competitors still piloting the format.",
    "TBF": "Recipe R&D cycle from concept to shelf is under 90 days, versus 6-12 months at larger food conglomerates with heavier approval layers.",
    "NBO": "USDA-organic certified supply chain audited to the farm level, a traceability standard most \"natural\" competitors don't meet.",
    "QFH": "Household cleaning products are concentrate-format only, shipping lighter and cheaper per use than diluted competitor formulas.",
    "DBC": "Owns direct relationships with growers in three origin countries, avoiding the commodity-broker markup most coffee brands pay.",
    # Industry 5 – Automobiles & Auto Components
    "VLM": "Modular vehicle platform shares 70% of parts across its full lineup, giving it a lower cost base per model than competitors running separate platforms.",
    "AAP": "Same-day parts delivery network covers more independent repair shops than any national auto-parts competitor.",
    "TEL": "Precision-tolerance engineering division supplies components other suppliers reject as too complex to manufacture profitably.",
    "CCS": "Adaptive cruise-control software is licensed across multiple OEMs rather than built in-house only, giving it a scale advantage competitors' single-customer systems lack.",
    "EVE": "Battery-pack design uses a swappable module architecture, differentiating from competitors' fixed, non-serviceable packs.",
    "MWC": "Runs the only unionized final-assembly plant in its segment with a no-layoff clause, a stability pitch fleet buyers value over lowest sticker price.",
    "PTI": "Powertrain components are validated for both combustion and hybrid drivetrains from a single production line, unlike single-drivetrain competitors.",
    "ANT": "Embedded automotive software is OTA-updatable post-sale, letting customers add features competitors require a dealership visit to unlock.",
    "SSC": "Steering components carry a 10-year warranty, double the segment standard, backed by in-house durability testing rather than third-party certification alone.",
    "FPL": "Fleet telematics platform bundles maintenance scheduling with routing, a combination logistics competitors sell as separate add-ons.",
    # Industry 6 – Energy (Oil & Gas)
    "PPE": "Lowest lifting cost per barrel in its basin due to concentrated acreage that reduces per-well infrastructure spend versus scattered-acreage competitors.",
    "COE": "Exploration success rate is roughly double the basin average, attributed to proprietary seismic-imaging techniques developed in-house.",
    "NNG": "Owns firm pipeline capacity contracts locking in takeaway rather than relying on spot capacity, insulating it from the bottleneck pricing that hits smaller producers.",
    "DDR": "Specializes in ultra-deepwater drilling depths most competitors' rigs aren't rated for, commanding premium day rates in that niche.",
    "GFR": "Only renewables developer in its peer set with in-house grid-interconnection engineering, cutting the interconnection queue delays that stall competitor projects.",
    "SRC": "Refining complexity index is among the highest in its region, letting it process heavier, cheaper crude grades competitors' simpler refineries can't run.",
    "PPL": "Contracted pipeline volumes are 90%+ take-or-pay, giving cash-flow visibility most exploration-linked midstream peers lack.",
    "TEG": "Concentrates entirely on marginal, high-decline wells larger operators divest, buying them below replacement cost and optimizing with in-house workover crews.",
    "CLL": "Long-term take-or-pay LNG contracts with Asian buyers are indexed differently than spot-exposed competitors, smoothing revenue through price cycles.",
    "BPS": "Distributed solar-plus-storage projects are sited on already-permitted brownfield land, cutting permitting time competitors spend years navigating.",
    # Industry 7 – Utilities
    "PGE": "Grid-hardening capital program is furthest along of regional peers, reducing storm-related outage minutes per customer year over year.",
    "RWC": "Non-revenue water loss (leakage) is roughly half the industry average due to an early investment in acoustic leak-detection sensors competitors are still rolling out.",
    "MGD": "Distribution network is majority newer polyethylene pipe rather than legacy cast iron, cutting the leak-repair costs weighing on older-infrastructure peers.",
    "SPA": "Solar interconnection queue processing is automated end-to-end, approving rooftop projects in weeks versus the months-long manual review at peer utilities.",
    "CSU": "Smart-meter rollout is complete across its full service territory, versus partial rollouts at comparable regional utilities, enabling real-time outage detection.",
    "WEC": "Wind asset fleet average capacity factor exceeds regional peers due to a proprietary turbine-siting model built on a decade of local wind data.",
    "PGT": "High-voltage transmission network has the fewest single points of failure in its region following an early redundancy investment competitors deferred.",
    "APH": "Desalination and treatment technology licensing gives it a second revenue stream competitors without in-house R&D don't have.",
    "UPC": "Demand-response program enrollment is the highest in its region, giving it dispatchable load flexibility peers must buy on the wholesale market.",
    "ETE": "District heating network reuses industrial waste heat, a lower-cost energy source than the fuel-purchased heat competitors rely on.",
    # Industry 8 – Metals & Mining
    "IPM": "Ore grade at its flagship deposit is meaningfully above the basin average, keeping cash costs per ton below most peers even in downturns.",
    "CRL": "Fully permitted expansion project ready to break ground, while competitors' comparable projects remain stuck in permitting.",
    "NWM": "Operates its own rail spur to port, avoiding the third-party freight cost that erodes margins for landlocked competitors.",
    "SCI": "Electric-arc-furnace steelmaking gives it a lower carbon footprint per ton than blast-furnace competitors, a growing procurement advantage with OEM buyers.",
    "GSR": "Reserve life at current production rates is longer than peer average, reducing near-term reinvestment risk.",
    "ALC": "Direct lithium extraction technology recovers resource faster than the evaporation-pond method most competitors still use.",
    "TEC": "Only vertically integrated titanium producer in its peer set, from ore through finished sponge metal, avoiding the price volatility toll competitors pay mid-chain.",
    "FMG": "Metals recycling capacity lets it blend scrap into primary production, lowering input costs versus ore-only competitors during high ore-price periods.",
    "RED": "One of few Western rare-earth producers with separation capability outside China, a supply-chain independence customers increasingly pay a premium for.",
    "BLM": "Conveyor-belt (rather than truck) ore haulage cuts transport cost per ton meaningfully versus truck-dependent competitors.",
    # Industry 9 – Construction & Infrastructure
    "BRC": "Self-performs core trades (concrete, structural steel) rather than subcontracting them out, giving tighter schedule control than general contractors who subcontract everything.",
    "HIC": "Long-term public infrastructure framework agreements provide multi-year revenue visibility competitors bidding project-by-project don't have.",
    "SLD": "In-house architecture and design-build capability compresses the entitlement-to-groundbreak timeline versus developers who outsource design.",
    "RSF": "Proprietary soil-stabilization technique lets it build on marginal sites competitors must pass on or over-engineer expensively.",
    "MRE": "Specializes exclusively in transit rail engineering, building a specialist track record that generalist infrastructure firms bidding the same contracts can't match.",
    "GSU": "Urban green-infrastructure design (stormwater, green roofs) is a core specialty, not an add-on service, ahead of the sustainability-retrofit curve.",
    "TDC": "Owns its dredging fleet outright rather than chartering, avoiding the day-rate spikes that hit competitors during high-demand periods.",
    "SBP": "Bridge-inspection and rehab specialty means most of its backlog is maintenance work, more resilient to new-build spending cycles than peers.",
    "CBM": "Regional aggregate quarry ownership secures input supply that materials-trading competitors must purchase at market price.",
    "FWI": "Modular/prefabricated construction methods cut on-site build time versus traditional stick-built competitors bidding the same infrastructure contracts.",
    # Industry 10 – Real Estate
    "POR": "Office portfolio is concentrated in transit-adjacent, LEED-certified buildings, commanding occupancy premiums over commodity office REIT peers.",
    "HVP": "Waterfront and view-premium asset concentration supports rent premiums that inland-portfolio REIT competitors can't replicate.",
    "USR": "Mixed-use ground-floor retail integrated into every residential asset, diversifying income beyond the pure-play residential REIT model.",
    "GLR": "In-house property management (not third-party) keeps opex per unit below peer REITs that outsource management.",
    "CCT": "Anchor tenants are locked into 15+ year leases with contractual escalators, giving longer income visibility than shorter-lease commercial peers.",
    "SLH": "Boutique/lifestyle hotel positioning avoids direct rate competition with commodity branded-hotel REIT peers.",
    "RPP": "Grocery-anchored strip centers occupancy has stayed structurally higher than enclosed-mall REIT peers through the e-commerce shift.",
    "ISC": "Last-mile logistics warehouse footprint is concentrated within same-day delivery range of major metros, a location advantage over peers in cheaper but farther-out markets.",
    "LER": "Age-restricted community focus creates longer average tenancy and lower turnover cost than general residential REIT peers.",
    "CDR": "Diversified across office, retail, and industrial in one metro area, reducing concentration risk versus single-sector REIT competitors.",
    # Industry 11 – Telecommunications
    "CTW": "Rural spectrum holdings cover underserved areas national carriers have deprioritized, giving it de facto exclusivity in those markets.",
    "BLC": "Fiber-to-the-home coverage passes more homes in its footprint than cable-based competitors offering slower speeds on legacy coax.",
    "FQN": "Wholesale dark-fiber leasing to other carriers is a second revenue stream that retail-only ISP competitors don't have.",
    "SWT": "Low-earth-orbit satellite backhaul reaches remote sites terrestrial competitors can't economically wire.",
    "DPS": "Managed SD-WAN service is bundled with 24/7 in-house NOC support, versus competitors who outsource support to third parties.",
    "VSI": "VoIP platform is purpose-built for multi-site retail chains, with per-location provisioning competitors' generic business VoIP products don't offer.",
    "NGT": "Cell-tower portfolio is multi-tenant by design from construction, monetizing colocation revenue that single-carrier competitors' towers don't capture.",
    "PSC": "Maritime and aviation satellite connectivity is a specialty niche most terrestrial-focused telecom competitors don't serve at all.",
    "MFT": "Embedded IoT connectivity modules ship pre-certified across more countries than competitors, cutting customer time-to-market.",
    "CIS": "Symmetric residential fiber speeds (equal upload/download) beat the asymmetric cable/DSL plans most competitors still sell.",
    # Industry 12 – Retail & E-commerce
    "MMR": "Supply-chain scale lets it match e-commerce pricing in-store, a combination smaller brick-and-mortar competitors can't sustain.",
    "SWE": "Same-day delivery radius covers more zip codes than any pure-play e-commerce competitor outside the largest national platforms.",
    "CSG": "Store format is deliberately small-footprint urban, filling a gap between convenience stores and full grocers that larger chains don't target.",
    "TSF": "Design-to-shelf cycle is under four weeks, faster than most fast-fashion competitors, letting it chase trends closer to real time.",
    "QCO": "15-minute delivery guarantee in core metros, a speed tier most e-commerce competitors don't operationally attempt.",
    "HSF": "In-house furniture design and direct factory sourcing cuts out the import-distributor markup competitors pay.",
    "BBD": "Deep-discount model relies on opportunistic closeout buying rather than year-round vendor contracts, a sourcing edge over standard discount retailers.",
    "FMO": "100% certified-organic private label across every category, a breadth few grocery competitors match without non-organic overlap.",
    "TGS": "In-store repair and trade-in counters at every location, a service layer pure online electronics competitors can't offer.",
    "LBO": "Curated single-brand-per-category model avoids the discounting pressure that broad-assortment luxury e-commerce competitors face.",
    # Industry 13 – Industrials & Capital Goods
    "PMW": "Five-axis CNC capacity lets it machine complex parts in a single setup that competitors need multiple machines and setups to produce.",
    "AIC": "Diversified across unrelated end markets, so a downturn in one doesn't hit revenue the way single-end-market industrial peers get hit.",
    "TFL": "Open-die forging capacity handles larger single-piece parts than most regional forging competitors' press capacity allows.",
    "GLS": "Owns its own trucking and warehousing fleet rather than brokering, giving tighter delivery-time guarantees than asset-light logistics competitors.",
    "SBM": "Structural-steel fabrication is paired with in-house erection crews, a single-vendor offering that fabrication-only competitors can't match.",
    "ADC": "AS9100-certified aerospace component lines run alongside commercial lines in the same facility, spreading fixed costs competitors dedicated solely to aerospace can't.",
    "RRI": "Long-term rail-maintenance contracts with public transit agencies give revenue visibility that project-based road contractors lack.",
    "PGN": "Modular power-generation units ship pre-assembled and commissioned faster than site-built competitors' turbines.",
    "HCS": "Small-hydro turbine retrofits for existing dams are a specialty niche most large power-equipment makers don't pursue at that scale.",
    "EBT": "Prefabricated green-building components are factory-QC'd, reducing the on-site defect rate versus traditional on-site sustainable-building competitors.",
    # Industry 14 – Chemicals
    "CCI": "Backward-integrated into its own feedstock production, insulating margins from the spot-price swings that hit non-integrated competitors.",
    "SYS": "Custom specialty-synthesis contracts for pharma clients carry higher margins than the commodity chemicals most peers focus on.",
    "PDI": "Proprietary polymer formulations are patent-protected, a moat commodity-polymer competitors selling on price alone don't have.",
    "AGF": "Owns regional distribution and blending facilities close to farms, cutting delivery lead time versus fertilizer competitors shipping from centralized plants.",
    "PCL": "Low-VOC coatings line is ahead of tightening regional emissions regulations that will force reformulation at slower-moving competitors.",
    "SPC": "Solvent recovery and recycling loop lowers raw-material cost versus competitors buying virgin solvent at full market price.",
    "IAC": "Formulates adhesives to customer-specific bonding requirements rather than selling off-the-shelf grades like most competitors.",
    "BSP": "Integrated cracker-to-derivatives production captures margin at each stage that standalone petrochemical traders miss.",
    "SMI": "Ultra-high-purity specialty materials for semiconductor fabs meet tolerances few chemical suppliers outside this niche can hit.",
    "GCS": "Bio-based feedstock chemistry gives it a lower carbon-intensity product line ahead of customers' Scope 3 sourcing requirements.",
    # Industry 15 – Media & Entertainment
    "GMN": "Owns must-carry local affiliate stations in more markets than peer broadcasters, preserving retransmission-fee leverage as cord-cutting continues.",
    "SSE": "Franchise IP spans film, television, and licensing simultaneously, a cross-platform monetization model single-medium studios can't replicate.",
    "PDM": "Creator-monetization payout rate is higher than competing platforms, which has measurably improved creator retention and content supply.",
    "NRS": "Genre-specialist focus (horror/thriller) gives it lower per-title production costs than general-content studios competing for the same streaming licensing deals.",
    "SVI": "Licensed classic-catalog focus avoids the costly new-content bidding wars that squeeze margins at original-content-heavy streaming competitors.",
    "CPP": "Subscriber base skews toward print-preferring readers competitors have largely ceded to digital-only publishing.",
    "UBM": "Artist-development contracts retain a larger share of streaming royalties for artists than major-label competitors, aiding talent recruitment.",
    "HGC": "Live-service titles ship content updates on a faster cadence than competing studios, sustaining engagement longer per title.",
    "NWT": "Wire-syndication licensing to other outlets is a B2B revenue stream that consumer-facing-only news competitors don't have.",
    "BSB": "Local news production costs are shared across its station group via a central hub model, undercutting standalone-station competitors' costs.",
    # Outlier archetype companies
    "NCD": "No competitive differentiation left to speak of — asset quality has deteriorated to the point where its \"strategy\" is regulatory forbearance while it works out a shrinking, overleveraged loan book.",
    "BGT": "Land-and-expand AI developer tooling adoption is growing faster than any peer, but the differentiator is speed of share capture, not unit economics — it is spending well ahead of revenue to lock in developers before incumbents react.",
    "FTC": "Debt-free balance sheet and a multi-decade record of compounding acquired household brands without ever needing external capital — a capital-allocation discipline almost no leveraged consumer-staples peer can match.",
}
