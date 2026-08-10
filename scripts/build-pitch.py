#!/usr/bin/env python3
"""
build-pitch.py — Generate a real PowerPoint file (docs/pitch/PayLoop-Pitch-Deck.pptx)
for the PayLoop Level-5 pitch deck.

Dependency-free: writes a .pptx (an Office Open XML zip) using only the Python
standard library, so it runs anywhere with Python 3. Slides cover everything the
Level-5 submission asks for: problem, solution, market opportunity,
architecture, growth strategy, and future roadmap.

Usage:
    python3 scripts/build-pitch.py
"""

import os
import zipfile
from xml.sax.saxutils import escape

XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'

W = 12192000  # 16:9 slide width (EMU)
H = 6858000

# --- Slide content ----------------------------------------------------------

SLIDES = [
    {
        "title": "PayLoop",
        "sub": "Get paid in seconds, cash out at home.",
        "bullets": [
            "Invoice + escrow for freelancers, built on Stellar Soroban",
            "USDC payments settle in ~5 seconds for fractions of a cent",
            "Every payment is an on-chain income record — portable and tamper-proof",
        ],
    },
    {
        "title": "The problem",
        "sub": "Global clients, broken payments.",
        "bullets": [
            "PayPal/Payoneer: 2–5 day holds, 3–5% fees plus 5–8% FX markup",
            "African freelancers wait weeks to see money for work already done",
            "No verifiable income trail — lenders and clients can't check your history",
            "Freelancing is exploding, but the rails still punish the sellers",
        ],
    },
    {
        "title": "The solution",
        "sub": "PayLoop — a payment loop that works for the freelancer.",
        "bullets": [
            "Create an invoice on-chain, share a /pay link, get paid in one wallet click",
            "Instant settlement: USDC moves client → freelancer atomically",
            "Portable, on-chain invoice history = your reputation and income proof",
            "Cash out to Naira through a licensed anchor (SEP-24 off-ramp)",
        ],
    },
    {
        "title": "How it works",
        "sub": "Create → share → client pays → cash out.",
        "bullets": [
            "1. Freelancer creates an invoice (client, amount, description)",
            "2. Client opens the shared link and funds it in one click",
            "3. USDC lands with the freelancer instantly, recorded on-chain",
            "4. Freelancer withdraws to their local bank via an anchor",
        ],
    },
    {
        "title": "Market opportunity",
        "sub": "A large, growing, under-served market.",
        "bullets": [
            "Nigerian freelance & gig economy is among the fastest-growing in Africa",
            "Stablecoin remittance / payout volumes growing rapidly in the region",
            "Fees today cost freelancers 8–13% of every cross-border payment",
            "PayLoop attacks speed, cost, and trust — the three blockers at once",
        ],
    },
    {
        "title": "Architecture",
        "sub": "Stellar Soroban + Next.js. No app database.",
        "bullets": [
            "Smart contract (Rust/Soroban) is the source of truth for invoices",
            "Next.js web app, Freighter wallet, deployed on Vercel",
            "Public on-chain activity feed — verifiable usage proof",
            "Sentry monitoring + Vercel analytics + in-app feedback loop",
            "Anchor off-ramp path documented and mocked end-to-end (SEP-24)",
        ],
    },
    {
        "title": "Traction",
        "sub": "Live on Stellar testnet, iterating on real feedback.",
        "bullets": [
            "50+ testnet users onboarded with real wallet transactions",
            "Invoices created and paid on-chain — public and verifiable",
            "User survey: strong average product rating, 0% negative intent",
            "Feedback-driven iteration: history, preview, PDF export, reminders, walkthrough, dark mode",
        ],
    },
    {
        "title": "Growth strategy",
        "sub": "From 50 testnet users to a live product.",
        "bullets": [
            "Onboard freelancer communities in design, writing and dev circles",
            "Reduce friction: one-click onboarding, tutorial, testnet faucet",
            "Land a licensed anchor for the real USDC → Naira off-ramp",
            "Word-of-mouth loop: every client who pays becomes a freelancer user",
            "Feedback funnel (form + in-app widget) drives each iteration",
        ],
    },
    {
        "title": "Roadmap",
        "sub": "Next on the build.",
        "bullets": [
            "Live USDC ↔ Naira anchor off-ramp (SEP-24)",
            "Milestone / held escrow for larger projects",
            "On-chain reputation score and income proof API",
            "Recurring / retainer invoices and multi-stablecoin",
            "Agency batch payouts and team accounts",
        ],
    },
    {
        "title": "The ask",
        "sub": "What we're building toward.",
        "bullets": [
            "Hackathon / grant validation to fund the anchor integration",
            "Design partners: freelancers willing to pay in USDC today",
            "Advisors with anchor & compliance experience",
            "We ship a full, tested, deployed product — on testnet today",
        ],
    },
]

# --- OOXML scaffolding ------------------------------------------------------

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

def emu(n):
    return str(n)

def shape_xml(shape_id, name, x, y, cx, cy, lines, font_size=1800, bold=False, color="1F2937"):
    """A text box with one or more paragraphs (lines). First line can be styled."""
    paras = []
    for i, line in enumerate(lines):
        run_props = ""
        if i == 0:
            run_props = f'<a:rPr lang="en-US" sz="{font_size}" b="1"/>'
        else:
            run_props = f'<a:rPr lang="en-US" sz="{font_size}"/>'
        paras.append(
            f'<a:p><a:r>{run_props}<a:t>{escape(line)}</a:t></a:r></a:p>'
        )
    return (
        f'<p:sp>'
        f'<p:nvSpPr><p:cNvPr id="{shape_id}" name="{escape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{emu(x)}" y="{emu(y)}"/><a:ext cx="{emu(cx)}" cy="{emu(cy)}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        f'<p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>{"".join(paras)}</p:txBody>'
        f"</p:sp>"
    )

def slide_xml(slide):
    title_lines = [slide["title"]]
    sub_lines = [slide["sub"]]
    title = shape_xml(2, "Title", 685800, 400000, W - 1371600, 800000, title_lines, font_size=4400, bold=True)
    sub = shape_xml(3, "Subtitle", 685800, 1300000, W - 1371600, 600000, sub_lines, font_size=2000, bold=False, color="64748B")
    bullets = shape_xml(4, "Bullets", 685800, 2100000, W - 1371600, H - 2600000, [f"•  {b}" for b in slide["bullets"]], font_size=2000)
    brand = shape_xml(5, "Brand", 914400, H - 700000, 4000000, 300000, ["PayLoop · Stellar Soroban"], font_size=1200, color="94A3B8")
    return f"""
<p:sld xmlns:a="{NS['a']}" xmlns:r="{NS['r']}" xmlns:p="{NS['p']}">
  <p:cSld name="{escape(slide['title'])}">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{W}" cy="{H}"/><a:chOff x="0" y="0"/><a:chExt cx="{W}" cy="{H}"/></a:xfrm></p:grpSpPr>
      {title}
      {sub}
      {bullets}
      {brand}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
""".lstrip()

def slide_master_xml():
    return f"""<p:sldMaster xmlns:a="{NS['a']}" xmlns:r="{NS['r']}" xmlns:p="{NS['p']}">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{W}" cy="{H}"/><a:chOff x="0" y="0"/><a:chExt cx="{W}" cy="{H}"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMap accent1="0B1220" accent2="3390FC" accent3="8ECDFF" accent4="1F2937" accent5="10B981" accent6="F59E0B" hlink="3390FC" folHlink="59B0FF" bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"/>
</p:sldMaster>
""".lstrip()

def slide_layout_xml():
    return f"""<p:sldLayout xmlns:a="{NS['a']}" xmlns:r="{NS['r']}" xmlns:p="{NS['p']}" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>
""".lstrip()

def theme_xml():
    return f"""<a:theme xmlns:a="{NS['a']}" name="Office">
  <a:themeElements>
    <a:clrScheme name="PayLoop">
      <a:dk1><a:srgbClr val="0B1220"/></a:dk1>
      <a:dk2><a:srgbClr val="131C2E"/></a:dk2>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:lt2><a:srgbClr val="F1F5F9"/></a:lt2>
      <a:accent1><a:srgbClr val="3390FC"/></a:accent1>
      <a:accent2><a:srgbClr val="59B0FF"/></a:accent2>
      <a:accent3><a:srgbClr val="10B981"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="1F2937"/></a:accent5>
      <a:accent6><a:srgbClr val="8ECDFF"/></a:accent6>
      <a:hlink><a:srgbClr val="3390FC"/></a:hlink>
      <a:folHlink><a:srgbClr val="59B0FF"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>
""".lstrip()

def build_slide_rels():
    return XML_DECL + (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
        "</Relationships>"
    )

def build_layout_rels():
    return XML_DECL + (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>'
        "</Relationships>"
    )

def build_master_rels():
    return XML_DECL + (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>'
        "</Relationships>"
    )

def build_presentation_xml():
    sld_ids = "".join(
        f'<p:sldId id="{256 + i}" r:id="rId{i+1}"/>'
        for i in range(len(SLIDES))
    )
    rels = [f'<p:sldIdLst>{sld_ids}</p:sldIdLst>']
    siz = f'<p:sldSz cx="{W}" cy="{H}" type="screen16x9"/>'
    return f"""<p:presentation xmlns:a="{NS['a']}" xmlns:r="{NS['r']}" xmlns:p="{NS['p']}" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
  {rels[0]}
  <p:sldSz cx="{W}" cy="{H}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>
""".lstrip()

def build_presentation_rels():
    entries = []
    entries.append(
        '<Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
    )
    for i in range(len(SLIDES)):
        entries.append(
            f'<Relationship Id="rId{i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i+1}.xml"/>'
        )
    return XML_DECL + (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(entries)
        + "</Relationships>"
    )

def build_content_types():
    overrides = "".join(
        f'<Override PartName="/ppt/slides/slide{i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for i in range(len(SLIDES))
    )
    return XML_DECL + (
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
        + overrides
        + "</Types>"
    )

def build_root_rels():
    return XML_DECL + (
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        "</Relationships>"
    )

def build_core_props():
    return XML_DECL + (
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>PayLoop — Pitch Deck</dc:title>"
        "<dc:creator>PayLoop Team</dc:creator>"
        "<dc:description>Get paid in seconds, cash out at home.</dc:description>"
        "<cp:lastModifiedBy>PayLoop</cp:lastModifiedBy>"
        "</cp:coreProperties>"
    )

def build_app_props():
    return XML_DECL + (
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>PayLoop Deck Builder</Application>"
        "<Slides>%d</Slides></Properties>" % len(SLIDES)
    )


def main():
    out = os.path.join("docs", "pitch", "PayLoop-Pitch-Deck.pptx")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", build_content_types())
        z.writestr("_rels/.rels", build_root_rels())
        z.writestr("docProps/core.xml", build_core_props())
        z.writestr("docProps/app.xml", build_app_props())
        z.writestr("ppt/presentation.xml", build_presentation_xml())
        z.writestr("ppt/_rels/presentation.xml.rels", build_presentation_rels())
        z.writestr("ppt/slideMasters/slideMaster1.xml", slide_master_xml())
        z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", build_master_rels())
        z.writestr("ppt/slideLayouts/slideLayout1.xml", slide_layout_xml())
        z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", build_layout_rels())
        z.writestr("ppt/theme/theme1.xml", theme_xml())
        for i, slide in enumerate(SLIDES):
            z.writestr(f"ppt/slides/slide{i+1}.xml", slide_xml(slide))
            z.writestr(f"ppt/slides/_rels/slide{i+1}.xml.rels", build_slide_rels())
    print(f"Wrote {out} ({len(SLIDES)} slides)")


if __name__ == "__main__":
    main()
