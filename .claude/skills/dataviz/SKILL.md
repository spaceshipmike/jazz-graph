---
name: dataviz
description: Data visualization advisor. Recommends chart types based on data shape, audience, and goal. Covers 150+ visualization types with taxonomy from datavizproject.com. Triggers on "what chart should I use", "visualize this data", "dataviz", "chart type", "which visualization", "how to show/display/plot".
argument-hint: "[data description or question]"
---

# Data Visualization Advisor

Recommend the right visualization for any dataset, explain chart types, and guide implementation decisions.

**Based on:** [datavizproject.com](https://datavizproject.com/) by Ferdio — the world's largest data visualization library (160+ types).

**Use this for**: Choosing chart types, understanding visualization trade-offs, mapping data shape to visual form, exploring alternatives to common charts.

---

## How to Use This Skill

When invoked, follow this decision process:

### Step 1: Understand the Data

Ask (or infer from context):

1. **What are you showing?** — The subject/story
2. **How many variables?** — 1, 2, 3, many
3. **What type of variables?** — Categorical, continuous, temporal, geographic, hierarchical, network
4. **How many data points?** — Handful, dozens, hundreds, thousands+
5. **Who is the audience?** — General public, analysts, executives, domain experts

### Step 2: Identify the Function

Map the user's goal to one of these seven functions:

| Function | The user wants to... | Primary chart families |
|----------|---------------------|----------------------|
| **Comparison** | Compare values across categories or groups | Bar, Grouped Bar, Lollipop, Dot, Bullet, Radar |
| **Trend over time** | Show how values change over a time period | Line, Area, Stream, Sparkline, Slope, Bump, Candlestick |
| **Part to whole** | Show how parts contribute to a total | Pie, Donut, Treemap, Sunburst, Waffle, Marimekko, Stacked Bar |
| **Distribution** | Display the spread or shape of data | Histogram, Box Plot, Violin, Beeswarm, Strip, Jitter |
| **Correlation** | Reveal relationships between variables | Scatter, Bubble, Connected Scatter, Heat Map, Parallel Coordinates |
| **Geolocation** | Show data tied to geographic places | Choropleth, Dot Density, Bubble Map, Flow Map, Cartogram |
| **Concept visualization** | Explain a process, structure, or idea | Flow Chart, Sankey, Venn, Mind Map, Org Chart, Illustration |

### Step 3: Recommend (with Reasoning)

Provide:

1. **Primary recommendation** — The best-fit chart type with rationale
2. **Runner-up** — A strong alternative and when to prefer it
3. **Avoid** — A common but poor choice for this case and why
4. **Implementation notes** — Library suggestions (D3, Observable Plot, Vega-Lite, Chart.js, matplotlib, ggplot2, etc.)

---

## Taxonomy System

Every visualization is classified along four orthogonal dimensions:

### Family (what kind of visual)

| Family | Description |
|--------|-------------|
| **Chart** | Traditional statistical/quantitative graphics (bar, line, area, pie) |
| **Diagram** | Conceptual, relational, or process-oriented visuals (flow, Venn, org chart) |
| **Geospatial** | Map-based visualizations (choropleth, dot map, flow map) |
| **Plot** | Statistical/mathematical coordinate-based visuals (scatter, box, violin) |
| **Table** | Tabular/grid data arrangements (heat map, matrix, comparison chart) |

### Function (what purpose it serves)

Comparison · Concept visualization · Correlation · Distribution · Geolocation · Part to whole · Trend over time

### Shape (visual form)

Area · Circle/Circular · Line · Point · Rectangle/Bar · Square · Grid · Arc/Radial · Spiral

### Input (data requirements)

One variable · Two variables · Three variables · Several variables · Temporal · Hierarchical · Network/relational · Geographic · Text

---

## Complete Visualization Catalog

### Bar & Column Charts

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Bar Chart** | Compare values across categories | The workhorse — use by default for comparison |
| **Bar Chart (Horizontal)** | Many categories or long labels | Easier to read category names |
| **Grouped Bar Chart** | Compare 2-3 series across categories | Side-by-side bars per group |
| **Stacked Bar Chart** | Part-to-whole AND comparison | Segments stack; use 100% variant for pure proportions |
| **Butterfly Chart** | Compare two opposing groups (male/female, before/after) | Also called Tornado Chart |
| **Triangle Bar Chart** | Stylistic variant of bar chart | Triangular bars |
| **Lollipop Chart** | Cleaner alternative to bar chart | Line + dot; less ink, same data |
| **Bullet Graph** | Show value against a target/threshold | Replaces gauges on dashboards |
| **Span Chart** | Show ranges (min-max) per category | Two Y values per point |
| **Column Range** | Show floating ranges per category | Also called floating column chart |
| **Waterfall Chart** | Show cumulative positive/negative changes | Running total — great for financials |
| **Pareto Chart** | Highlight the vital few factors | Bars (descending) + cumulative line |
| **Histogram** | Show distribution of continuous data | Bins, not categories — distinct from bar chart |
| **Radial Bar Chart** | Comparison with circular layout | Bar chart on polar coordinates |
| **Radial Histogram** | Distribution of cyclical data | Histogram wrapped around a circle |
| **Spiral Histogram** | Compare cycles while keeping timeline | Also called condegram |
| **Pictorial Bar Chart** | Add visual metaphor to bars | Icons replace/overlay bars |

### Line & Trend Charts

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Line Graph** | Continuous data over time | Connect the dots — the default for time series |
| **Spline Graph** | Smoother time series | Fitted curve instead of straight segments |
| **Stepped Line Graph** | Data that changes at discrete points | Step function — good for pricing tiers, rates |
| **Slope Chart** | Compare exactly two time points | Two-point before/after comparison |
| **Bump Chart** | Show rank changes over time | Focus on position, not magnitude |
| **Sparkline** | Inline trend within text or table | Word-sized, no axes — pure trend |
| **Radial Line Graph** | Cyclical patterns (hours, months) | Data wrapped around a circle |
| **Connected Scatter Plot** | Two variables evolving over time | Time is encoded in the path direction |
| **Kagi Chart** | Price movements ignoring time | Only draws when price moves enough |
| **Candlestick Chart** | OHLC financial data | Open/high/low/close per period |
| **Renko Chart** | Price trend filtering noise | Equal-size bricks, direction changes on threshold |
| **Control Chart** | Statistical process control | Line + upper/lower control limits |

### Area Charts

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Area Chart** | Emphasize volume/magnitude over time | Filled line chart |
| **Stacked Area Chart** | Part-to-whole over time | Multiple series stacked vertically |
| **Layered Area Chart** | Compare overlapping series | Transparency-based layering |
| **Radial Area Chart** | Cyclical magnitude data | Area chart on polar coordinates |
| **Stream Graph** | Organic, flowing multi-series over time | Displaced around central axis |
| **Sorted Stream Graph** | Same but sorted for readability | Series sorted by magnitude |
| **3D Stream Graph** | Surface-style stream | Three-dimensional variant |

### Pie & Donut Charts

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Pie Chart** | 2-5 clearly different proportions | Controversial but effective for simple part-to-whole |
| **Donut Chart** | Same as pie, with space for a metric in the center | Functionally identical to pie |
| **Semi Circle Donut** | Part-to-whole with visual economy | Half donut saves space |
| **Multi-level Donut** | Hierarchical proportions | Concentric rings for parent-child |
| **Polar Area Chart** | Compare magnitudes across equal-angle sectors | Nightingale Rose / Coxcomb chart |
| **Sunburst Diagram** | Multi-level hierarchical part-to-whole | Concentric rings from root outward |
| **Compound Bubble & Pie** | Geographic proportional composition | Bubble size + pie composition |
| **Pie Chart on a Map** | Proportions at geographic locations | Pie charts placed on map |
| **Fan Chart** | Past trend + future uncertainty | Line graph meets range/prediction area |

### Scatter & Bubble Plots

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Scatter Plot** | Relationship between two continuous variables | The default for correlation |
| **Bubble Chart** | Three continuous variables | x, y, + bubble size |
| **Circular Bubble Chart** | Three variables on circular plane | Alternative layout for bubble |
| **3D Scatter Plot** | Three continuous variables in 3D | Use sparingly — hard to read in 2D print |
| **Hexagonal Binning** | Scatter with thousands of overlapping points | Density via hexagonal bins |

### Dot & Strip Charts

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Dot Chart** | Simpler alternative to bar chart | Cleaner for few values |
| **Dot Plot** | Simple 1D distribution | Dots on a number line |
| **Strip Plot** | Distribution of one continuous variable | Single-axis scatter |
| **Jitter Plot** | Strip plot with overlap reduction | Random offset to reveal density |
| **Beeswarm Plot** | Distribution with zero overlap | Systematic positioning, not random |
| **Dumbbell Plot** | Compare two values per category | Two dots connected by a line |

### Statistical Distribution

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Box Plot** | Summarize distribution (median, quartiles, outliers) | The statistician's default |
| **Violin Plot** | Full distribution shape + box plot | Shows density, not just quartiles |
| **Error Bars** | Show uncertainty/precision of measurements | Added to other chart types |

### Proportional Area

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Proportional Area (Circle)** | Quick size comparison, no axes | Circle area encodes value |
| **Proportional Area (Square)** | Same but with squares | Easier to compare than circles |
| **Proportional Area (Half Circle)** | Compact proportional comparison | Half-circle variant |
| **Proportional Area (Icon)** | Add meaning via icon shape | Scaled icons |
| **Nested Proportional Area** | Layered proportional comparison | Nested/overlapping shapes |
| **Packed Circle Chart** | Hierarchical data as tangent circles | Circle packing layout |

### Pictorial / Icon-Based

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Pictorial Unit Chart** | Make data tangible for general audience | Icons instead of abstract shapes |
| **Pictorial Fraction Chart** | "1 in 5 people..." style | Filled vs. unfilled icons |
| **Pictorial Percentage Chart** | Percentage via pictogram fill | Icons showing percentage |
| **Pictorial Stacked Chart** | Part-to-whole with visual metaphor | Stacked pictogram bars |
| **Icon Count** | Simple count visualization | Repeated icons |
| **Icon and Number** | Hero stat with visual context | Number + illustrative icon |

### Numbers & Simple Indicators

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Scaled-up Number** | Single standout metric (KPI) | Big bold number — no chart needed |
| **Progress Bar** | Show completion toward a goal | Linear fill |
| **Waffle Chart** | Percentage with discrete units | 10×10 grid, colored cells = percentage |
| **Tally Chart** | Frequency count with raw feel | Tally marks |
| **Angular Gauge** | Show value within a range | Speedometer-style dial |
| **Solid Gauge** | Good/bad indicator | Index gauge (above/below threshold) |

### Heat Maps & Matrices

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Heat Map** | Dense 2D data as color intensity | Grid of colored cells |
| **Bubble-based Heat Map** | Heat map + magnitude via bubble size | Circles in a grid |
| **Circular Heat Map** | Cyclical 2D data (hours × days) | Radial layout |
| **Spiral Heat Map** | Compare continuous cycles | Spiral preserves timeline + cyclicality |
| **Matrix Diagram** | Present/absent relationships | Intersection grid |
| **Comparison Chart** | Feature/attribute comparison | Rows × columns table |
| **Table Chart** | Precise values matter more than shape | Just a table — sometimes the best choice |

### Network & Relationship Diagrams

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Network Visualization** | Complex many-to-many relationships | Nodes and edges (force-directed) |
| **Chord Diagram** | Flows between entities in a closed set | Arcs around a circle |
| **Non-ribbon Chord Diagram** | Same, emphasis on connections not volume | Lines instead of ribbons |
| **Arc Diagram** | Connections with ordered nodes | 1D layout, arcs above/below |
| **Sankey Diagram** | Flow quantities through stages | Width = quantity; energy/cost transfers |
| **Alluvial Diagram** | Category changes over time | Flows between parallel categorical axes |
| **Hive Plot** | Network with structural axes | Nodes mapped to radial axes by property |
| **Radial Convergences** | Entity relationships in strict circle | Circular node layout with connections |
| **Clustered Force Layout** | Hierarchical grouping with nested circles | Circle packing + force simulation |
| **Parallel Coordinates** | High-dimensional multivariate data | Vertical axes, one per variable |
| **Parallel Sets** | Categorical flow/frequency | Like parallel coordinates for categories |

### Hierarchical / Tree Visualizations

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Treemap** | Part-to-whole in hierarchical data | Nested rectangles, area = value |
| **Convex Treemap** | Same with non-rectangular polygons | Aesthetic alternative |
| **Dendrogram** | Cluster hierarchy from analysis | Tree branching from clustering |
| **Organisational Chart** | Reporting structure | Classic top-down tree |
| **Mind Map** | Brainstorm / idea relationships | Central concept + branches |
| **Hyperbolic Tree** | Very large hierarchies with focus+context | Fisheye distortion for exploration |
| **Fan Chart (Genealogy)** | Family tree | Half-circle with concentric ancestor rings |

### Pyramid & Funnel

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Funnel Chart** | Sequential filtering/drop-off | Progressively narrowing stages |
| **Pyramid Chart** | Inverted funnel / hierarchical tiers | Broadest at base |
| **Pyramid Diagram** | Conceptual hierarchy (Maslow's etc.) | Conceptual, not data-driven |
| **Population Pyramid** | Age/gender distribution | Back-to-back horizontal bars |

### Flow & Process Diagrams

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Flow Chart** | Decision logic / process steps | Boxes + arrows |
| **Cycle Diagram** | Repeating process with no clear start/end | Circular flow |
| **Step by Step Illustration** | Sequential instructions | Illustrated panels |
| **Illustration Diagram** | Explain how something works | Annotated illustration |
| **Development and Causes** | Timeline + explanation of changes | Compound: timeline + area/line |
| **SWOT Analysis** | Strategic assessment | Four-quadrant grid |

### Venn & Set Diagrams

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Venn Diagram** | All logical relations between sets | Overlapping circles |
| **Euler Diagram** | Set relationships (may not show all combos) | Simpler than Venn when sets don't all overlap |
| **Marimekko Chart** | Two-dimensional part-to-whole | Variable-width stacked columns |

### Geographic / Map Visualizations

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Choropleth Map** | Values by region (density, rate, index) | Shaded regions — the default geo viz |
| **Dot Density Map** | Show concentration/presence | Many dots = high density |
| **Bubble Map** | Values at specific locations | Sized bubbles on map |
| **Connection Map** | Routes/links between locations | Lines connecting points on map |
| **Flow Map** | Directional movement between places | Width = quantity moved |
| **Pin Map** | Specific locations with labels | Pins/markers on map |
| **Isoline Map** | Continuous surface data (elevation, weather) | Contour lines on map |
| **Cartogram** | Distort geography to encode data | Area = data variable |
| **Topographic Map** | Physical terrain with elevation | Contour map |
| **Profile Map** | Elevation cross-section | Exaggerated vertical scale |

### Contour & Ternary Plots

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Contour Plot** | 3-variable relationship on 2D surface | Like a topographic map of data |
| **Ternary Plot** | Three variables that sum to constant | Equilateral triangle coordinates |
| **Ternary Contour Plot** | Mixture response surface | Contours on ternary triangle |

### Radar & Multivariate

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Radar Diagram** | Compare multivariate profiles | Spider/web chart — axes from center |
| **Taylor Diagram** | Model-observation comparison | Correlation + RMS + amplitude in one plot |

### Timelines

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Timeline** | Chronological events (sequence) | Events in order |
| **Scaled Timeline** | Events with true time spacing | Proportional time distances |
| **Bubble Timeline** | Events with a magnitude variable | Bubble size on timeline |
| **Gantt Chart** | Project schedule / task durations | Horizontal bars across time |

### Word & Text

| Type | When to use | Key trait |
|------|-------------|-----------|
| **Word Cloud** | Word frequency in text corpus | Size = frequency/importance |

---

## Quick Decision Flowchart

```
What do you want to show?
│
├─ COMPARISON across categories
│  ├─ Few categories (≤7) → Bar Chart
│  ├─ Many categories (8+) → Horizontal Bar Chart
│  ├─ Two groups side-by-side → Grouped Bar / Butterfly Chart
│  ├─ With a target/benchmark → Bullet Graph
│  └─ Multivariate profile → Radar Diagram
│
├─ CHANGE OVER TIME
│  ├─ Single series → Line Graph
│  ├─ Multiple series (≤4) → Multi-line Graph
│  ├─ Multiple series (5+) → Small multiples / Sparklines
│  ├─ Part-to-whole over time → Stacked Area / Stream Graph
│  ├─ Two time points → Slope Chart
│  ├─ Rank changes → Bump Chart
│  └─ Financial OHLC → Candlestick / Kagi / Renko
│
├─ PART TO WHOLE
│  ├─ 2-5 parts → Pie / Donut Chart
│  ├─ Many parts → Treemap
│  ├─ Hierarchical → Sunburst / Multi-level Donut
│  ├─ Exact percentages matter → Stacked Bar (100%) / Waffle
│  ├─ Sequential stages → Funnel Chart
│  └─ Two categorical dimensions → Marimekko Chart
│
├─ DISTRIBUTION
│  ├─ Single variable → Histogram / Strip Plot
│  ├─ Compare groups → Box Plot / Violin Plot
│  ├─ Show every point → Beeswarm / Jitter Plot
│  └─ 2D density → Hexagonal Binning / 2D Histogram
│
├─ CORRELATION / RELATIONSHIP
│  ├─ Two variables → Scatter Plot
│  ├─ Three variables → Bubble Chart
│  ├─ Many variables → Parallel Coordinates / Heat Map
│  ├─ Flow between entities → Sankey / Chord Diagram
│  ├─ Network structure → Network Graph / Arc Diagram
│  └─ Set overlap → Venn / Euler Diagram
│
├─ GEOGRAPHIC
│  ├─ Values by region → Choropleth Map
│  ├─ Points/locations → Pin Map / Dot Density Map
│  ├─ Values at locations → Bubble Map
│  ├─ Movement/flow → Flow Map / Connection Map
│  └─ Distort for data → Cartogram
│
├─ CONCEPT / PROCESS
│  ├─ Decision logic → Flow Chart
│  ├─ Hierarchy/structure → Org Chart / Dendrogram
│  ├─ Process stages → Funnel / Step-by-Step
│  ├─ Cyclical process → Cycle Diagram
│  └─ Strategy → SWOT Analysis
│
└─ SINGLE VALUE / KPI
   ├─ Just a number → Scaled-up Number
   ├─ Progress toward goal → Progress Bar / Waffle Chart
   └─ Value in range → Angular Gauge
```

---

## Common Anti-Patterns

| Don't | Do instead | Why |
|-------|-----------|-----|
| Pie chart with 8+ slices | Horizontal bar chart | Humans can't compare small angles |
| 3D bar chart | 2D bar chart | 3D distorts perception, adds no data |
| Dual-axis chart | Two aligned charts or indexed lines | Two scales mislead about correlation |
| Rainbow color scale | Sequential or diverging palette | Rainbow has no perceptual order |
| Truncated y-axis bar chart | Start bars at zero | Non-zero baseline exaggerates differences |
| Scatter with 10,000+ points | Hexbin or 2D density | Overplotting hides the pattern |
| Line chart for unordered categories | Bar chart | Lines imply continuity between points |
| Area chart comparing series | Line chart or small multiples | Stacking occludes lower series |

---

## Response Format

When recommending a visualization, structure your response as:

```markdown
### Recommended: [Chart Type]

**Why:** [1-2 sentences connecting the data shape to the chart's strengths]

**Alternative:** [Runner-up type] — better if [condition]

**Avoid:** [Common wrong choice] — because [reason]

**Implementation:**
- **D3.js**: [relevant module/example]
- **Observable Plot**: [relevant mark/transform]
- **Python (matplotlib/seaborn/plotly)**: [function]
- **R (ggplot2)**: [geom/function]
- **No-code**: [tool suggestion]

**Reference:** https://datavizproject.com/data-type/[slug]/
```

Adapt the implementation section to the user's known tech stack. If you know from context they use Python, lead with Python. If building for the web, lead with JS libraries.

---

## Source

All visualization types and taxonomy from [Data Viz Project](https://datavizproject.com/) by [Ferdio](https://ferdio.com/), with supplementary guidance on selection and implementation.
