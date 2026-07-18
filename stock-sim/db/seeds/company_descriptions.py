"""Business-summary descriptions for every seeded company, keyed by ticker.

Kept in a separate module (rather than inline in COMPANIES) so the tuple list in
seed_companies.py stays compact and this content can be reviewed/edited on its own.
"""

COMPANY_DESCRIPTIONS: dict[str, str] = {
    # ── Industry 1 – Banking & Financial Services ──────────────────────
    "FNB": (
        "First National Bank (FNB) is a full-service retail and commercial bank serving "
        "mid-sized cities through a dense branch network. It specializes in small-business "
        "lending and long-tenured deposit relationships, prioritizing balance-sheet stability "
        "over rapid growth."
    ),
    "MCC": (
        "Metro Credit Corp (MCC) is an urban consumer lender focused on credit cards and "
        "personal installment loans for younger, digitally native borrowers. Its niche is "
        "fast underwriting decisions powered by alternative credit-scoring data."
    ),
    "PFG": (
        "Pacific Financial Group (PFG) is a diversified regional bank with a strong presence "
        "in trade finance for import/export businesses along the Pacific coast. It pairs "
        "traditional lending with treasury-management services for mid-market exporters."
    ),
    "AIB": (
        "Atlas Investment Bank (AIB) is a boutique investment bank specializing in M&A "
        "advisory and equity underwriting for growth-stage industrial and technology "
        "companies. It carries a smaller balance sheet than universal banks, leaning on "
        "advisory fee income."
    ),
    "CMT": (
        "Commonwealth Trust (CMT) operates as a private bank and trust company, managing "
        "estates, trusts, and wealth for high-net-worth families. Its niche is fiduciary "
        "services and multi-generational wealth planning rather than mass-market banking."
    ),
    "SIG": (
        "Summit Insurance Group (SIG) underwrites property and casualty insurance for "
        "homeowners and small commercial property owners in catastrophe-exposed regions. "
        "It differentiates through disciplined actuarial pricing and reinsurance-backed risk "
        "retention."
    ),
    "SFS": (
        "Sterling Financial Services (SFS) provides equipment leasing and asset-based lending "
        "to manufacturers and logistics operators. Its specialization is structuring financing "
        "against hard collateral rather than unsecured corporate credit."
    ),
    "HAM": (
        "Harbor Asset Management (HAM) is an institutional asset manager running fixed-income "
        "and multi-asset mandates for pension funds and endowments. It competes on low fees "
        "and a conservative, benchmark-aware investment process."
    ),
    "PNB": (
        "Pinnacle Bancorp (PNB) is a community bank holding company built around agricultural "
        "and farm-equipment lending in rural markets. Its niche is deep local relationships "
        "with family-owned farms and agribusinesses."
    ),
    "CRF": (
        "Crestline Financial (CRF) is a specialty finance company focused on subprime auto "
        "loan origination and servicing. It operates with tighter margins and higher risk "
        "tolerance than traditional banks in exchange for higher yields."
    ),
    # ── Industry 2 – Information Technology / Software ─────────────────
    "NBS": (
        "NovaByte Software (NBS) develops enterprise SaaS tools for supply-chain analytics, "
        "specializing in demand forecasting and inventory optimization for mid-market "
        "logistics firms."
    ),
    "QDM": (
        "Quantum Dynamics (QDM) builds high-performance computing platforms for scientific "
        "simulation and engineering workloads, serving aerospace and materials-research "
        "customers who need GPU-accelerated modeling."
    ),
    "ADS": (
        "Apex Digital Solutions (ADS) is a systems integrator and cloud-migration consultancy "
        "that helps large enterprises modernize legacy ERP and mainframe workloads onto "
        "public cloud infrastructure."
    ),
    "CVS": (
        "CoreVault Systems (CVS) develops enterprise data-backup and disaster-recovery "
        "software, specializing in ransomware-resilient storage for regulated industries "
        "like healthcare and finance."
    ),
    "WFT": (
        "WebForge Technologies (WFT) provides a no-code website and e-commerce storefront "
        "builder aimed at small businesses and independent creators, competing on ease of "
        "use over enterprise feature depth."
    ),
    "DSI": (
        "DataStream Inc (DSI) operates a real-time data-streaming and event-processing "
        "platform used by fintech and ad-tech companies to power low-latency analytics "
        "pipelines."
    ),
    "CPS": (
        "CloudPeak Software (CPS) sells DevOps and CI/CD tooling that automates software "
        "release pipelines for engineering teams, with a focus on Kubernetes-native "
        "deployment workflows."
    ),
    "ICS": (
        "IronClad Cybersecurity (ICS) provides endpoint detection and response (EDR) software "
        "for mid-sized enterprises, specializing in threat-hunting services bundled with its "
        "detection platform."
    ),
    "GFA": (
        "GreenField Analytics (GFA) builds machine-learning platforms for precision "
        "agriculture, helping large farm operators optimize crop yields using satellite "
        "imagery and soil-sensor data."
    ),
    "PAI": (
        "Pivot AI Corp (PAI) develops generative AI copilots for enterprise knowledge work, "
        "specializing in document search and contract-analysis applications for legal and "
        "professional-services firms."
    ),
    # ── Industry 3 – Pharmaceuticals & Healthcare ───────────────────────
    "APX": (
        "Apex Pharmaceuticals (APX) is a mid-cap pharma company specializing in generic and "
        "branded-generic cardiovascular and diabetes medications sold through a broad "
        "wholesale distribution network."
    ),
    "BVL": (
        "BioVita Labs (BVL) is a clinical-stage biotech focused on monoclonal antibody "
        "therapies for autoimmune disease, running a pipeline concentrated in Phase II "
        "rheumatology trials."
    ),
    "MCH": (
        "MedCore Health (MCH) operates a network of outpatient diagnostic imaging and "
        "laboratory-testing centers, specializing in fast-turnaround radiology services for "
        "referring physician networks."
    ),
    "NXT": (
        "Nexus Therapeutics (NXT) develops oncology therapeutics with a pipeline centered on "
        "targeted small-molecule inhibitors for solid tumors, partnering with academic cancer "
        "centers for trial recruitment."
    ),
    "PMD": (
        "Pulse Medical Devices (PMD) manufactures implantable cardiac monitoring devices and "
        "pacemakers, specializing in remote-telemetry features that let cardiologists track "
        "patients outside the clinic."
    ),
    "VBS": (
        "Vertex BioSolutions (VBS) is a gene-therapy platform company developing viral-vector "
        "treatments for rare pediatric genetic disorders, a narrow but high-value niche within "
        "biotech."
    ),
    "CVH": (
        "Crestview Hospitals (CVH) operates a regional chain of acute-care hospitals and "
        "surgical centers, specializing in orthopedic and cardiac surgery service lines with "
        "above-average case volumes."
    ),
    "GHP": (
        "GenHeal Pharma (GHP) manufactures over-the-counter wound-care and dermatology "
        "products, specializing in advanced hydrogel dressings sold through pharmacy and "
        "hospital-supply channels."
    ),
    "PCD": (
        "PureCare Diagnostics (PCD) makes point-of-care rapid diagnostic test kits for "
        "infectious disease screening, specializing in low-cost assays for clinics in "
        "underserved and rural areas."
    ),
    "OSI": (
        "OmniSurgical Inc (OSI) designs minimally invasive surgical instruments and robotic-"
        "assist tooling, specializing in laparoscopic devices sold to ambulatory surgery "
        "centers."
    ),
    # ── Industry 4 – FMCG / Consumer Staples ────────────────────────────
    "EEC": (
        "Everyday Essentials Corp (EEC) manufactures household paper and personal-care "
        "staples — tissues, diapers, and cleaning wipes — distributed nationally through "
        "mass-market grocery and club-store retailers."
    ),
    "PHP": (
        "PureHome Products (PHP) produces laundry detergents and home-cleaning chemicals, "
        "specializing in concentrated, eco-certified formulations that command a premium "
        "shelf position."
    ),
    "SFL": (
        "Sunrise Foods Ltd (SFL) is a packaged-foods manufacturer specializing in breakfast "
        "cereals and shelf-stable snack bars sold under private-label and branded lines to "
        "supermarket chains."
    ),
    "CBI": (
        "Coastal Beverages Inc (CBI) bottles and distributes non-alcoholic beverages, "
        "specializing in flavored sparkling water and functional drinks targeting "
        "health-conscious consumers."
    ),
    "EFC": (
        "EverFresh Consumer Goods (EFC) makes refrigerated dairy and plant-based milk "
        "alternatives, specializing in short-supply-chain distribution to regional grocery "
        "chains."
    ),
    "HGH": (
        "HomeGuard Hygiene (HGH) produces disinfectant sprays and surface-cleaning products, "
        "specializing in institutional-grade formulations sold to schools, offices, and "
        "healthcare facilities as well as retail."
    ),
    "TBF": (
        "TasteBuds Food Co (TBF) manufactures ready-to-eat snack foods and confectionery, "
        "specializing in better-for-you chip and cookie lines aimed at younger consumers."
    ),
    "NBO": (
        "Nature's Best Organics (NBO) produces certified-organic packaged foods, specializing "
        "in organic pasta sauces and condiments sold through natural-foods grocery channels."
    ),
    "QFH": (
        "QuickFix Household (QFH) sells household repair and maintenance consumables — "
        "adhesives, sealants, and small hardware kits — through big-box home-improvement "
        "retailers."
    ),
    "DBC": (
        "DailyBrew Coffee (DBC) roasts and packages coffee and tea products, specializing in "
        "single-serve pod formats sold through grocery and direct-to-consumer subscription "
        "channels."
    ),
    # ── Industry 5 – Automobiles & Auto Components ──────────────────────
    "VLM": (
        "Velocity Motors (VLM) is a mass-market automaker producing sedans and crossover "
        "SUVs, specializing in value-oriented vehicles for first-time and budget-conscious "
        "buyers."
    ),
    "AAP": (
        "Apex Auto Parts (AAP) manufactures aftermarket replacement parts — brakes, "
        "suspension components, and filters — distributed through independent repair shops "
        "and auto-parts retailers."
    ),
    "TEL": (
        "Titan Engineering Ltd (TEL) supplies precision-forged drivetrain components to "
        "original-equipment automakers, specializing in transmission gears and axle "
        "assemblies."
    ),
    "CCS": (
        "Cruise Control Systems (CCS) develops advanced driver-assistance system (ADAS) "
        "electronics, specializing in radar and camera-fusion modules sold to Tier-1 auto "
        "suppliers."
    ),
    "EVE": (
        "EVolution Electric (EVE) manufactures battery-electric passenger vehicles, "
        "specializing in compact urban EVs with fast-charging architecture aimed at "
        "environmentally conscious commuters."
    ),
    "MWC": (
        "Metro Wagon Corp (MWC) produces light commercial vans and cargo vehicles, "
        "specializing in last-mile delivery fleets for logistics and courier operators."
    ),
    "PTI": (
        "Powertrain Industries (PTI) designs and manufactures internal-combustion and hybrid "
        "engine components, specializing in fuel-injection systems for mid-size sedan and "
        "truck platforms."
    ),
    "ANT": (
        "AutoNexa Technologies (ANT) develops infotainment and connected-car software "
        "platforms, specializing in over-the-air update systems licensed to smaller "
        "automakers."
    ),
    "SSC": (
        "SteerSafe Components (SSC) manufactures steering and suspension safety components, "
        "specializing in electric power-steering racks sold to both OEM and aftermarket "
        "channels."
    ),
    "FPL": (
        "FleetPro Logistics (FPL) provides commercial vehicle fleet leasing and maintenance "
        "management, specializing in telematics-enabled fleet tracking for trucking "
        "companies."
    ),
    # ── Industry 6 – Energy (Oil & Gas) ──────────────────────────────────
    "PPE": (
        "PetroPeak Energy (PPE) is an integrated oil and gas producer with upstream "
        "exploration assets concentrated in mature onshore basins, specializing in "
        "enhanced-recovery techniques on legacy wells."
    ),
    "COE": (
        "CrestOil Exploration (COE) is an upstream exploration company focused on offshore "
        "deepwater drilling, specializing in high-risk, high-reward frontier basin "
        "exploration."
    ),
    "NNG": (
        "NorthStar Natural Gas (NNG) produces and markets natural gas from shale formations, "
        "specializing in liquids-rich plays that pair gas output with associated NGL "
        "revenue."
    ),
    "DDR": (
        "DeepDrill Resources (DDR) provides contract drilling services to oil and gas "
        "operators, specializing in high-pressure/high-temperature well services for complex "
        "reservoirs."
    ),
    "GFR": (
        "Greenfield Renewables (GFR) develops and operates utility-scale wind and solar "
        "generation assets, specializing in long-term power-purchase agreements with "
        "corporate offtakers."
    ),
    "SRC": (
        "Sierra Refining Corp (SRC) operates crude-oil refining and fuel-blending facilities, "
        "specializing in producing low-sulfur diesel and jet fuel for regional distribution."
    ),
    "PPL": (
        "Pipeline Partners LP (PPL) owns and operates midstream crude and natural-gas "
        "pipeline infrastructure, specializing in fee-based transportation contracts that "
        "reduce commodity-price exposure."
    ),
    "TEG": (
        "Terra Energy Group (TEG) is an independent exploration and production company "
        "specializing in unconventional tight-oil extraction using horizontal drilling and "
        "multi-stage fracturing."
    ),
    "CLL": (
        "Coastal LNG Ltd (CLL) operates liquefied natural gas export terminals, specializing "
        "in long-term supply contracts with Asian and European utility buyers."
    ),
    "BPS": (
        "BluePeak Solar (BPS) designs and installs commercial and industrial rooftop solar "
        "systems, specializing in behind-the-meter installations for manufacturing and "
        "logistics facilities."
    ),
    # ── Industry 7 – Utilities (Power/Gas/Water) ────────────────────────
    "PGE": (
        "PolarGrid Electric (PGE) is a regulated electric utility delivering power to "
        "residential and commercial customers across a cold-climate service territory, "
        "specializing in winter-peak grid reliability."
    ),
    "RWC": (
        "RiverRun Water Co (RWC) is a regulated water utility providing treatment and "
        "distribution services, specializing in aging-infrastructure replacement programs "
        "across suburban service areas."
    ),
    "MGD": (
        "MetroGas Distribution (MGD) is a regulated natural-gas local distribution company "
        "serving urban residential and commercial customers, specializing in pipeline safety "
        "modernization."
    ),
    "SPA": (
        "Sunbelt Power Authority (SPA) is a vertically integrated electric utility serving "
        "high-growth Sun Belt markets, specializing in rate-base expansion tied to population "
        "growth."
    ),
    "CSU": (
        "ClearStream Utilities (CSU) provides combined electric and water services in smaller "
        "municipal territories, specializing in bundled-utility billing for rural cooperatives."
    ),
    "WEC": (
        "Windward Energy Co (WEC) is an electric utility with a growing renewable generation "
        "mix, specializing in integrating wind and battery-storage assets into its regulated "
        "rate base."
    ),
    "PGT": (
        "PeakGrid Transmission (PGT) owns high-voltage electric transmission lines connecting "
        "regional grids, specializing in interconnection projects for new generation "
        "capacity."
    ),
    "APH": (
        "AquaPure Holdings (APH) operates municipal water and wastewater treatment plants "
        "under long-term concession contracts, specializing in public-private partnership "
        "infrastructure deals."
    ),
    "UPC": (
        "Unity Power Corp (UPC) is a regulated electric and gas utility holding company, "
        "specializing in demand-response programs that shift industrial customer load off "
        "peak hours."
    ),
    "ETE": (
        "EcoTherm Energy (ETE) operates district-heating and combined-heat-and-power "
        "facilities, specializing in industrial steam supply contracts with manufacturing "
        "campuses."
    ),
    # ── Industry 8 – Metals & Mining ─────────────────────────────────────
    "IPM": (
        "IronPeak Mining (IPM) operates open-pit iron-ore mines supplying steelmakers, "
        "specializing in high-grade ore blends that command premium pricing from blast-"
        "furnace customers."
    ),
    "CRL": (
        "Copper Ridge Ltd (CRL) mines and processes copper concentrate, specializing in "
        "supplying wire and cable manufacturers serving the electrification and grid-"
        "buildout market."
    ),
    "NWM": (
        "NorthWest Minerals (NWM) is a diversified mining company with polymetallic "
        "operations spanning zinc, lead, and silver, specializing in underground hard-rock "
        "extraction."
    ),
    "SCI": (
        "SteelCraft Industries (SCI) operates electric-arc-furnace steel mills, specializing "
        "in recycled-scrap-based production of structural steel for construction customers."
    ),
    "GSR": (
        "GoldStar Resources (GSR) is a gold-mining company operating heap-leach extraction "
        "sites, specializing in low-cost open-pit production in politically stable "
        "jurisdictions."
    ),
    "ALC": (
        "Alpine Lithium Corp (ALC) mines and processes lithium brine for battery-grade "
        "chemicals, specializing in supply contracts with electric-vehicle battery "
        "manufacturers."
    ),
    "TEC": (
        "Titanium Extraction Co (TEC) produces titanium sponge and mill products, "
        "specializing in aerospace-grade alloys sold to airframe and jet-engine "
        "manufacturers."
    ),
    "FMG": (
        "Fusion Metals Group (FMG) is a specialty alloys producer, specializing in "
        "nickel-based superalloys used in gas-turbine and industrial high-heat "
        "applications."
    ),
    "RED": (
        "RareEarth Dynamics (RED) mines and refines rare-earth elements, specializing in "
        "neodymium and dysprosium supply for permanent-magnet manufacturers serving EV motor "
        "and wind-turbine makers."
    ),
    "BLM": (
        "BeltLine Mining (BLM) operates coal and industrial-mineral surface mines, "
        "specializing in metallurgical coal supply contracts with regional steel producers."
    ),
    # ── Industry 9 – Construction & Infrastructure ──────────────────────
    "BRC": (
        "BuildRight Construction (BRC) is a general contractor specializing in mid-rise "
        "commercial and multifamily residential construction for regional developers."
    ),
    "HIC": (
        "Highway Infrastructure Corp (HIC) builds and maintains roads and highways under "
        "public-sector contracts, specializing in design-build partnerships with state "
        "transportation departments."
    ),
    "SLD": (
        "Skyline Developers (SLD) is a real-estate development firm specializing in "
        "master-planned mixed-use districts combining office, retail, and residential "
        "components."
    ),
    "RSF": (
        "RockSolid Foundations (RSF) provides specialty foundation and geotechnical "
        "engineering services, specializing in deep-pile installation for high-rise and "
        "industrial projects."
    ),
    "MRE": (
        "MetroRail Engineering (MRE) designs and builds urban rail and transit "
        "infrastructure, specializing in light-rail systems for metropolitan transit "
        "authorities."
    ),
    "GSU": (
        "GreenScape Urban (GSU) specializes in sustainable landscape architecture and "
        "urban-park construction, serving municipal green-infrastructure and stormwater-"
        "management projects."
    ),
    "TDC": (
        "Tidewater Dredging Co (TDC) performs marine dredging and port-channel maintenance, "
        "specializing in harbor-deepening contracts for shipping and port authorities."
    ),
    "SBP": (
        "Summit Bridge Partners (SBP) is a heavy-civil contractor specializing in bridge "
        "construction and rehabilitation for state and federal infrastructure programs."
    ),
    "CBM": (
        "CoreBuild Materials (CBM) manufactures ready-mix concrete and aggregate materials, "
        "specializing in supplying large-scale commercial construction sites within a "
        "regional radius of its quarries."
    ),
    "FWI": (
        "Forward Infrastructure (FWI) designs and builds water and sewer utility "
        "infrastructure, specializing in municipal pipe-replacement and treatment-plant "
        "expansion projects."
    ),
    # ── Industry 10 – Real Estate ────────────────────────────────────────
    "POR": (
        "Prime Office REIT (POR) owns and leases Class-A office towers in central business "
        "districts, specializing in long-term leases to financial and professional-services "
        "tenants."
    ),
    "HVP": (
        "HarborView Properties (HVP) develops and manages waterfront mixed-use properties, "
        "specializing in luxury residential-over-retail projects in coastal metro markets."
    ),
    "USR": (
        "UrbanSpace REIT (USR) owns urban mixed-use properties combining ground-floor retail "
        "with residential units, specializing in transit-adjacent infill development."
    ),
    "GLR": (
        "GreenLeaf Residential (GLR) owns and operates suburban multifamily apartment "
        "communities, specializing in workforce-housing rentals in growing metro suburbs."
    ),
    "CCT": (
        "Commercial Core Trust (CCT) owns suburban office parks and business campuses, "
        "specializing in flexible lease terms for regional corporate tenants."
    ),
    "SLH": (
        "Skyline Hospitality (SLH) owns and operates upscale hotel properties, specializing "
        "in convention-center-adjacent full-service hotels catering to business travel."
    ),
    "RPP": (
        "RetailPlex Properties (RPP) owns grocery-anchored neighborhood shopping centers, "
        "specializing in necessity-based retail tenants resilient to e-commerce "
        "disintermediation."
    ),
    "ISC": (
        "Industrial Space Corp (ISC) owns and leases logistics warehouses and distribution "
        "centers, specializing in last-mile fulfillment properties near major metro "
        "population centers."
    ),
    "LER": (
        "Lakeview Estates REIT (LER) owns single-family rental home portfolios, specializing "
        "in build-to-rent communities in mid-sized suburban markets."
    ),
    "CDR": (
        "Capital District REIT (CDR) owns a diversified portfolio of government-leased "
        "office buildings, specializing in long-duration leases to federal and state agency "
        "tenants."
    ),
    # ── Industry 11 – Telecommunications ────────────────────────────────
    "CTW": (
        "ConnectTel Wireless (CTW) is a national mobile network operator, specializing in "
        "prepaid and value-tier wireless plans targeting price-sensitive consumers."
    ),
    "BLC": (
        "BroadLink Communications (BLC) provides fiber and cable broadband internet service, "
        "specializing in residential gigabit connectivity in mid-sized metro markets."
    ),
    "FQN": (
        "FiberQuest Networks (FQN) builds and operates long-haul fiber-optic backbone "
        "infrastructure, specializing in wholesale bandwidth leasing to other carriers and "
        "hyperscale data centers."
    ),
    "SWT": (
        "SkyWave Telecom (SWT) provides satellite communications services, specializing in "
        "connectivity for maritime vessels and remote industrial sites beyond terrestrial "
        "network coverage."
    ),
    "DPS": (
        "DataPipe Solutions (DPS) offers managed network and colocation services to "
        "enterprises, specializing in hybrid-cloud connectivity for mid-market IT "
        "departments."
    ),
    "VSI": (
        "VoiceStream Inc (VSI) provides cloud-based business VoIP and unified-communications "
        "platforms, specializing in call-center software for customer-support teams."
    ),
    "NGT": (
        "NexGen Towers (NGT) owns and leases wireless communication towers, specializing in "
        "co-location agreements that host multiple carriers' equipment on shared "
        "infrastructure."
    ),
    "PSC": (
        "Pacific Satellite Corp (PSC) operates a fleet of geostationary communications "
        "satellites, specializing in broadcast-distribution and backhaul services for "
        "regional media companies."
    ),
    "MFT": (
        "MobileFirst Tech (MFT) develops mobile virtual network operator (MVNO) "
        "infrastructure and billing software, specializing in white-label wireless services "
        "for retail brands."
    ),
    "CIS": (
        "CyberLink ISP (CIS) is a regional internet service provider, specializing in "
        "fixed-wireless broadband delivery to rural and underserved communities."
    ),
    # ── Industry 12 – Retail & E-commerce ───────────────────────────────
    "MMR": (
        "MegaMart Retail (MMR) operates a national chain of big-box discount department "
        "stores, specializing in one-stop grocery-plus-general-merchandise shopping."
    ),
    "SWE": (
        "ShopWave E-commerce (SWE) runs a broad online marketplace connecting third-party "
        "sellers with consumers, specializing in fast last-mile delivery logistics as a "
        "competitive differentiator."
    ),
    "CSG": (
        "CornerStore Grocery (CSG) operates neighborhood grocery and convenience stores, "
        "specializing in fresh-food format stores in dense urban neighborhoods."
    ),
    "TSF": (
        "TrendSet Fashion (TSF) is a fast-fashion apparel retailer, specializing in rapid "
        "trend-cycle design and turnaround targeting younger shoppers."
    ),
    "QCO": (
        "QuickCart Online (QCO) is an online-only retailer specializing in same-day grocery "
        "and household-essentials delivery through a dark-store fulfillment network."
    ),
    "HSF": (
        "HomeStyle Furnishings (HSF) sells furniture and home-decor products through "
        "showrooms and an e-commerce storefront, specializing in mid-price ready-to-assemble "
        "furniture."
    ),
    "BBD": (
        "BargainBasics Discount (BBD) operates deep-discount variety stores, specializing in "
        "closeout and off-price merchandise sourced opportunistically from overstock "
        "suppliers."
    ),
    "FMO": (
        "FreshMart Organic (FMO) is a specialty grocery chain, specializing in organic and "
        "locally sourced produce for health-focused, higher-income shoppers."
    ),
    "TGS": (
        "TechGadget Stores (TGS) is a consumer-electronics retailer, specializing in "
        "curated smartphone, computing, and smart-home product selections with in-store "
        "technical support."
    ),
    "LBO": (
        "LuxeBoutique Online (LBO) is a direct-to-consumer luxury e-commerce retailer, "
        "specializing in curated designer apparel and accessories sold via a "
        "membership-styled online storefront."
    ),
    # ── Industry 13 – Industrials & Capital Goods ───────────────────────
    "PMW": (
        "Precision Machine Works (PMW) manufactures CNC-machined precision components, "
        "specializing in tight-tolerance parts for aerospace and defense contractors."
    ),
    "AIC": (
        "Atlas Industrial Corp (AIC) produces heavy industrial equipment such as cranes and "
        "material-handling systems, specializing in port and warehouse automation gear."
    ),
    "TFL": (
        "Titan Forge Ltd (TFL) operates heavy forging and casting facilities, specializing in "
        "large forged components for turbine and heavy-machinery manufacturers."
    ),
    "GLS": (
        "Global Logistics Systems (GLS) provides third-party logistics and freight-"
        "forwarding services, specializing in cross-border supply-chain management for "
        "manufacturers."
    ),
    "SBM": (
        "SteelBridge Manufacturing (SBM) fabricates structural steel components for bridges "
        "and industrial buildings, specializing in prefabricated modular steel assemblies."
    ),
    "ADC": (
        "AeroDynamic Components (ADC) manufactures precision aerospace components, "
        "specializing in turbine blades and structural parts for commercial jet-engine "
        "programs."
    ),
    "RRI": (
        "Rails & Roads Inc (RRI) manufactures railcars and track-maintenance equipment, "
        "specializing in freight railcar production for bulk-commodity rail operators."
    ),
    "PGN": (
        "PowerGen Equipment (PGN) manufactures industrial gas turbines and generator sets, "
        "specializing in backup power systems for data centers and hospitals."
    ),
    "HCS": (
        "HydroCore Systems (HCS) designs hydraulic pumps and fluid-power systems, "
        "specializing in hydraulic actuation equipment for construction and mining "
        "machinery."
    ),
    "EBT": (
        "EcoBuild Technologies (EBT) manufactures energy-efficient building systems, "
        "specializing in prefabricated insulated wall panels for green-certified "
        "construction projects."
    ),
    # ── Industry 14 – Chemicals ──────────────────────────────────────────
    "CCI": (
        "ChemCore Industries (CCI) produces industrial base chemicals, specializing in "
        "chlor-alkali production supplying water treatment and PVC manufacturers."
    ),
    "SYS": (
        "Synthesis Solutions (SYS) is a specialty chemical manufacturer, specializing in "
        "custom-synthesized intermediates for pharmaceutical and agrochemical customers."
    ),
    "PDI": (
        "Polymer Dynamics Inc (PDI) produces engineered plastics and polymer resins, "
        "specializing in high-performance polymers for automotive and electronics "
        "molding applications."
    ),
    "AGF": (
        "AgriGrow Fertilizers (AGF) manufactures nitrogen and phosphate fertilizers, "
        "specializing in precision-blended crop-nutrition products for large-scale farm "
        "operators."
    ),
    "PCL": (
        "Paints & Coatings Ltd (PCL) produces industrial and architectural coatings, "
        "specializing in corrosion-resistant protective coatings for marine and "
        "infrastructure applications."
    ),
    "SPC": (
        "SolventPro Chemicals (SPC) manufactures industrial solvents and cleaning "
        "chemicals, specializing in formulations for electronics manufacturing and precision "
        "cleaning."
    ),
    "IAC": (
        "Industrial Adhesives Corp (IAC) produces structural adhesives and sealants, "
        "specializing in bonding solutions for automotive lightweighting and construction "
        "applications."
    ),
    "BSP": (
        "BlueSky Petrochemicals (BSP) operates petrochemical cracking facilities, "
        "specializing in ethylene and propylene feedstock production for downstream plastics "
        "manufacturers."
    ),
    "SMI": (
        "Specialty Materials Inc (SMI) produces advanced ceramics and ultra-high-purity "
        "materials, specializing in substrates for semiconductor and electronics "
        "manufacturing."
    ),
    "GCS": (
        "GreenChem Solutions (GCS) manufactures biodegradable and bio-based industrial "
        "chemicals, specializing in plant-derived surfactants for eco-certified consumer "
        "products."
    ),
    # ── Industry 15 – Media & Entertainment ─────────────────────────────
    "GMN": (
        "Global Media Networks (GMN) operates a portfolio of national television and cable "
        "news channels, specializing in advertising-supported broadcast journalism."
    ),
    "SSE": (
        "StarStream Entertainment (SSE) produces and distributes feature films and "
        "television series, specializing in mid-budget theatrical releases and streaming "
        "licensing deals."
    ),
    "PDM": (
        "Pulse Digital Media (PDM) operates social and short-form video platforms, "
        "specializing in creator-monetization tools and algorithmic content distribution."
    ),
    "NRS": (
        "NextReel Studios (NRS) is a film and television production studio, specializing in "
        "genre content — horror and thriller franchises — licensed to streaming platforms."
    ),
    "SVI": (
        "StreamVault Inc (SVI) operates a subscription video-on-demand streaming service, "
        "specializing in a deep catalog of licensed classic film and television content."
    ),
    "CPP": (
        "ClassicPress Publishing (CPP) publishes print and digital magazines and books, "
        "specializing in long-form journalism and niche special-interest print titles."
    ),
    "UBM": (
        "UrbanBeats Music Group (UBM) is a record label and music-publishing company, "
        "specializing in hip-hop and R&B artist development and catalog licensing."
    ),
    "HGC": (
        "Hologram Gaming Corp (HGC) develops and publishes video games, specializing in "
        "live-service multiplayer titles monetized through in-game purchases."
    ),
    "NWT": (
        "NewsWire Today (NWT) operates a digital news wire and syndication service, "
        "specializing in real-time breaking-news feeds licensed to other media outlets."
    ),
    "BSB": (
        "BrightSky Broadcasting (BSB) owns a network of local television and radio "
        "affiliate stations, specializing in regional news and sports broadcasting."
    ),
    # ── Outlier archetype companies ─────────────────────────────────────
    "NCD": (
        "Nova Credit Distressed (NCD) is a regional bank whose commercial real-estate loan "
        "book has deteriorated sharply, leaving it thinly capitalized and dependent on "
        "regulatory forbearance. It specializes in workout lending to overleveraged "
        "borrowers it can no longer easily exit."
    ),
    "BGT": (
        "Blaze Growth Tech (BGT) is a hypergrowth software company burning cash to capture "
        "market share in AI-driven developer tooling, specializing in aggressive "
        "land-and-expand sales motions ahead of sustained profitability."
    ),
    "FTC": (
        "Fortress Capital (FTC) is a diversified consumer-staples holding company with a "
        "debt-free balance sheet and deep cash reserves, specializing in acquiring and "
        "compounding steady, high-margin household-brand businesses."
    ),
}
