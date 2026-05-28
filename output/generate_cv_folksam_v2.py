"""
Generate cv_folksam_v2.pdf — two-column sidebar layout.
Changes from base (cv_folksamSVE):
  1. "kritiska säkerhetssårbarheter" → "säkerhetsrisker"
  2. "super-admin-registreringsendpoint i SecurityConfig" →
     "öppen administrativ åtkomstpunkt i produktionsmiljön"
  3. Nackademin date: "2024 – 2026" → "2024 – maj 2026"
  4. Remove gymnasium/naturvetenskapsprogram (not present in source)
  5. Remove DSV/Stockholm University (not present in source)
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, HRFlowable,
    KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
SIDEBAR_BG   = colors.HexColor("#1e2d40")   # dark navy
ACCENT       = colors.HexColor("#3a8fc1")   # muted blue
WHITE        = colors.white
BODY_TEXT    = colors.HexColor("#2c2c2c")
LIGHT_RULE   = colors.HexColor("#cdd6dd")

# ---------------------------------------------------------------------------
# Page geometry
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4                          # 595.28 × 841.89 pt
MARGIN_TOP    = 14 * mm
MARGIN_BOTTOM = 14 * mm
SIDEBAR_W     = 62 * mm
MAIN_W        = PAGE_W - SIDEBAR_W - 12 * mm
SIDEBAR_X     = 0
MAIN_X        = SIDEBAR_W + 6 * mm
INNER_PAD     = 5 * mm

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
def make_styles():
    s = {}

    # --- Sidebar ---
    s["name"] = ParagraphStyle(
        "name",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=WHITE,
        spaceAfter=2,
    )
    s["title_sub"] = ParagraphStyle(
        "title_sub",
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#b0c4d8"),
        spaceAfter=8,
    )
    s["contact"] = ParagraphStyle(
        "contact",
        fontName="Helvetica",
        fontSize=7,
        leading=10,
        textColor=WHITE,
        spaceAfter=2,
    )
    s["section_sidebar"] = ParagraphStyle(
        "section_sidebar",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=11,
        textColor=ACCENT,
        spaceBefore=10,
        spaceAfter=3,
        borderPadding=(0, 0, 2, 0),
    )
    s["skill_group"] = ParagraphStyle(
        "skill_group",
        fontName="Helvetica-Bold",
        fontSize=6.8,
        leading=9,
        textColor=colors.HexColor("#d0e4f5"),
        spaceBefore=5,
        spaceAfter=1,
    )
    s["skill_item"] = ParagraphStyle(
        "skill_item",
        fontName="Helvetica",
        fontSize=6.8,
        leading=9,
        textColor=WHITE,
        spaceAfter=0,
    )
    s["sidebar_misc"] = ParagraphStyle(
        "sidebar_misc",
        fontName="Helvetica",
        fontSize=6.8,
        leading=9.5,
        textColor=WHITE,
        spaceAfter=1,
    )

    # --- Main column ---
    s["section"] = ParagraphStyle(
        "section",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=ACCENT,
        spaceBefore=10,
        spaceAfter=3,
        borderPadding=(0, 0, 2, 0),
    )
    s["job_title"] = ParagraphStyle(
        "job_title",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=BODY_TEXT,
        spaceBefore=7,
        spaceAfter=1,
    )
    s["job_date"] = ParagraphStyle(
        "job_date",
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=10,
        textColor=colors.HexColor("#6a8099"),
        spaceAfter=2,
    )
    s["bullet"] = ParagraphStyle(
        "bullet",
        fontName="Helvetica",
        fontSize=7.2,
        leading=10,
        textColor=BODY_TEXT,
        leftIndent=8,
        firstLineIndent=-6,
        spaceAfter=1,
    )
    s["body"] = ParagraphStyle(
        "body",
        fontName="Helvetica",
        fontSize=7.4,
        leading=10.5,
        textColor=BODY_TEXT,
        spaceAfter=3,
    )
    s["edu_title"] = ParagraphStyle(
        "edu_title",
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=11,
        textColor=BODY_TEXT,
        spaceBefore=6,
        spaceAfter=1,
    )
    s["proj_title"] = ParagraphStyle(
        "proj_title",
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=11,
        textColor=BODY_TEXT,
        spaceBefore=6,
        spaceAfter=1,
    )
    return s

# ---------------------------------------------------------------------------
# Content builders
# ---------------------------------------------------------------------------

def sidebar_content(S):
    items = []

    items.append(Paragraph("Rickard Borchers", S["name"]))
    items.append(Paragraph(
        "System Engineer · Java · Integrationer<br/>Plattformar &amp; Systemförvaltning",
        S["title_sub"]
    ))
    items.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#3a5a78"), spaceAfter=6))

    # Contact
    items.append(Paragraph("KONTAKT", S["section_sidebar"]))
    for line in [
        "RickardBorchers@gmail.com",
        "076-910 24 95",
        "Stockholm",
        "linkedin.com/in/rickard-borchers",
    ]:
        items.append(Paragraph(line, S["contact"]))

    items.append(Spacer(1, 4))
    items.append(HRFlowable(width="100%", thickness=0.3, color=colors.HexColor("#2e4a63"), spaceAfter=2))

    # Skills
    items.append(Paragraph("KOMPETENSER", S["section_sidebar"]))

    skill_groups = [
        ("BACKEND &amp; JAVA", [
            "Java 21 / Spring Boot 3",
            "Spring Security &amp; JWT",
            "REST API / OpenAPI",
            "JUnit / Maven",
            "Node.js (bekant)",
        ]),
        ("DEVOPS &amp; VERKTYG", [
            "Git / GitHub",
            "Docker · Kubernetes · OpenShift",
            "CI/CD (GitHub Actions)",
            "Linux (Debian)",
            "IntelliJ IDEA",
        ]),
        ("DATABASER", [
            "MongoDB Atlas",
            "PostgreSQL / SQL",
            "NoSQL-koncept",
        ]),
        ("PROCESS &amp; DRIFT", [
            "ITIL incident management",
            "SAFe / Agile / Kanban",
            "PM3 objekthantering",
            "Leverantörskoordinering",
            "GDPR-incidentrapportering",
        ]),
    ]

    for group_name, group_items in skill_groups:
        items.append(Paragraph(group_name, S["skill_group"]))
        for sk in group_items:
            items.append(Paragraph(f"· {sk}", S["skill_item"]))
        items.append(Spacer(1, 2))

    items.append(HRFlowable(width="100%", thickness=0.3, color=colors.HexColor("#2e4a63"), spaceAfter=2))

    # Languages
    items.append(Paragraph("SPRÅK", S["section_sidebar"]))
    items.append(Paragraph("Svenska — modersmål", S["sidebar_misc"]))
    items.append(Paragraph("Engelska — flytande", S["sidebar_misc"]))

    items.append(HRFlowable(width="100%", thickness=0.3, color=colors.HexColor("#2e4a63"), spaceAfter=2))

    # Misc
    items.append(Paragraph("ÖVRIGT", S["section_sidebar"]))
    items.append(Paragraph("Stockholmsbaserad", S["sidebar_misc"]))
    items.append(Paragraph("Tillgänglig omgående", S["sidebar_misc"]))
    items.append(Paragraph("Svensk medborgare", S["sidebar_misc"]))

    return items


def main_content(S):
    items = []

    # PROFIL
    items.append(Paragraph("PROFIL", S["section"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_RULE, spaceAfter=4))
    items.append(Paragraph(
        "Jag söker mig tillbaka till Folksam — en miljö jag känner väl efter flera år inom IT Produktion. "
        "Komplexiteten med reglerade system, många integrationer och höga krav på tillgänglighet, "
        "spårbarhet och säkerhet är en miljö jag trivs i och förstår inifrån. Idag kombinerar jag "
        "den erfarenheten med modern Java-utveckling och produktionsnära systemarbete från "
        "YH-utbildningen på Nackademin samt LIA hos 56N Software AB. Under LIA-praktiken arbetade "
        "jag nära både verksamhet och utveckling i en Spring Boot-baserad AI/SaaS-plattform. "
        "Jag bidrog inom områden som CI/CD, deploymentflöden, loggning, monitorering, "
        "dokumentation och teknisk koordinering samt identifierade och eskalerade säkerhets- "
        "och compliance-risker i produktionsmiljö. Min styrka är kombinationen av "
        "systemförståelse, teknisk problemlösning och erfarenhet av komplexa "
        "verksamhetskritiska IT-miljöer. Jag trivs i roller där teknik, struktur och "
        "samarbete möts.",
        S["body"]
    ))

    # ERFARENHET
    items.append(Spacer(1, 2))
    items.append(Paragraph("ERFARENHET", S["section"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_RULE, spaceAfter=4))

    # 56N
    items.append(KeepTogether([
        Paragraph(
            "56N Software AB — Technical Systems Analyst &amp; Product Process Coordinator (LIA)",
            S["job_title"]
        ),
        Paragraph("Jul 2025 – Maj 2026", S["job_date"]),
        Paragraph(
            "· Arbetade hands-on med AiMA — en AI-driven marknadsföringsplattform byggd på "
            "Spring Boot med integrationer mot OpenAI, Gemini och Pinecone",
            S["bullet"]
        ),
        # CHANGE 1 + 2 applied here
        Paragraph(
            "· Identifierade och dokumenterade säkerhetsrisker: lösenord i klartext i "
            "versionshantering, allmänt tillgänglig öppen administrativ åtkomstpunkt i produktionsmiljön",
            S["bullet"]
        ),
        Paragraph(
            "· Utvärderade och förbättrade CI/CD-flöden, deploymentprocesser, loggning och "
            "övervakning med fokus på driftsstabilitet, spårbarhet och driftssäkerhet i en "
            "Spring Boot-miljö",
            S["bullet"]
        ),
        Paragraph(
            "· Fungerade som brygga mellan verksamhetsbehov och teknisk implementation i ett "
            "distribuerat Sverige–Indien-team",
            S["bullet"]
        ),
        Paragraph(
            "· Införde strukturerade Kanban-flöden och semi-agila processer på eget initiativ",
            S["bullet"]
        ),
        Paragraph(
            "· Dokumenterade arkitektur och rutiner så att teamet kunde arbeta självständigt",
            S["bullet"]
        ),
        Paragraph(
            "· Eskalerade framgångsrikt ett regelefterlevnadsgap genom att formulera det som "
            "en juridisk risk, vilket ledde till omedelbar åtgärd från ledningen",
            S["bullet"]
        ),
    ]))

    # PostNord
    items.append(KeepTogether([
        Paragraph(
            "PostNord — IT Servicedesk Agent / Dispatcher",
            S["job_title"]
        ),
        Paragraph("Okt 2021 – Aug 2024", S["job_date"]),
        Paragraph(
            "· Incident- och ärendehantering i en av Sveriges största IT-miljöer — "
            "arbetsplats-IT till POS-lösningar, sorteringssystem och logistikplattformar",
            S["bullet"]
        ),
        Paragraph(
            "· Dispatcher / SPOC-roll för högprioriterade incidenter: koordinerade och "
            "schemalade agenter, hanterade överlämningar till/från externa leverantörer, "
            "ansvarade för GDPR-rapportering och dagliga incidentmöten med Incident Management",
            S["bullet"]
        ),
        Paragraph(
            "· Bred exponering mot komplex legacy-infrastruktur; tränad i snabb orientering "
            "i okända system under press",
            S["bullet"]
        ),
        Paragraph(
            "· Deltog i projekt med tydligt intressent- och leverantörssamarbete",
            S["bullet"]
        ),
    ]))

    # Folksam perm
    items.append(KeepTogether([
        Paragraph(
            "Folksam — IT Servicedesk Agent",
            S["job_title"]
        ),
        Paragraph("Maj 2017 – Dec 2020", S["job_date"]),
        Paragraph(
            "· Ansvar för Folksams IT-plattform — en dubbelreglerad miljö (försäkring + bank) "
            "med flera leverantörer, djupa legacy-integrationer och strikta regelefterlevnadskrav",
            S["bullet"]
        ),
        Paragraph(
            "· Koordinerade mellan interna team och externa leverantörer i en högt komplex "
            "incidenthanteringskedja",
            S["bullet"]
        ),
        Paragraph(
            "· Kravägare och beställare i ett agilt projekt för att ersätta ITSM-verktyg och CMDB",
            S["bullet"]
        ),
        Paragraph(
            "· Proaktiv incident- och problemhantering med ITIL-anpassad eskalering till "
            "flera leverantörer",
            S["bullet"]
        ),
        Paragraph(
            "· Övervakade incidentprocessen och skapade rutiner för IT Service Point",
            S["bullet"]
        ),
    ]))

    # Folksam konsult
    items.append(KeepTogether([
        Paragraph(
            "Folksam via Lexicon IT-konsult — IT Servicedesk Agent (konsult → tillsvidare)",
            S["job_title"]
        ),
        Paragraph("Sep 2015 – Jan 2017", S["job_date"]),
        Paragraph(
            "· Samma uppdrag som ovan; anställdes på grund av hög prestation",
            S["bullet"]
        ),
    ]))

    # Tidigare erfarenhet
    items.append(Paragraph("Tidigare erfarenhet", S["job_title"]))
    items.append(Paragraph(
        "· TeleComputing (PwC Sverige) — IT-support, Lotus Notes / Citrix / AD / "
        "Windows Server (2014–2015)",
        S["bullet"]
    ))
    items.append(Paragraph(
        "· IBM Helpdesk (ABB) — teknisk support, Active Directory / nätverk / SAP, "
        "Dublin (2012–2013)",
        S["bullet"]
    ))

    # UTBILDNING — CHANGE 3 applied (maj 2026), items 4+5 not present in source
    items.append(Spacer(1, 2))
    items.append(Paragraph("UTBILDNING", S["section"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_RULE, spaceAfter=4))

    items.append(KeepTogether([
        Paragraph("Nackademin — YH Javautvecklare", S["edu_title"]),
        Paragraph("2024 – maj 2026", S["job_date"]),
        Paragraph(
            "· Java 21, Spring Boot 3, Spring Security &amp; JWT, REST API / OpenAPI, "
            "JUnit, Maven",
            S["bullet"]
        ),
        Paragraph(
            "· Docker, Kubernetes, CI/CD (GitHub Actions), cloud (AWS/Azure/GCP), "
            "SQL, Git, IntelliJ",
            S["bullet"]
        ),
        Paragraph(
            "· LIA-praktik: 56N Software AB — AI-plattform i produktion, "
            "API-integration, säkerhetsanalys",
            S["bullet"]
        ),
    ]))

    # PROJEKT
    items.append(Spacer(1, 2))
    items.append(Paragraph("PROJEKT", S["section"]))
    items.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_RULE, spaceAfter=4))

    items.append(KeepTogether([
        Paragraph(
            "Pantry Tracker — Examensarbete (Java / Spring Boot) · 2026",
            S["proj_title"]
        ),
        Paragraph(
            "Fullstack-applikation för hushållsinventering, byggd med moderna Java-teknologier.",
            S["body"]
        ),
        Paragraph(
            "· Backend: Spring Boot 3 / Java 21 / MongoDB Atlas med JWT-autentisering "
            "(refresh tokens) och Spring Security",
            S["bullet"]
        ),
        Paragraph(
            "· Externa REST API-integrationer (Spoonacular, TheMealDB) med "
            "server-side MongoDB-cachning",
            S["bullet"]
        ),
        Paragraph(
            "· CI/CD via GitHub Actions, deployment via Railway",
            S["bullet"]
        ),
        Paragraph(
            "· Frontend: React 18 / TypeScript / Tailwind CSS — responsiv layout "
            "för mobil/surfplatta/desktop",
            S["bullet"]
        ),
    ]))

    items.append(KeepTogether([
        Paragraph(
            "Hydroponicraft — NeoForge Minecraft-mod (Java) · Aktiv",
            S["proj_title"]
        ),
        Paragraph(
            "· Komplext Java-projekt med händelsestyrd spelmekanik och djup "
            "tredjepartsintegration",
            S["bullet"]
        ),
        Paragraph(
            "· Visar förmåga att designa och implementera komplexa systemberoenden i Java",
            S["bullet"]
        ),
    ]))

    return items


# ---------------------------------------------------------------------------
# Background canvas (sidebar fill)
# ---------------------------------------------------------------------------

def draw_sidebar_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(SIDEBAR_BG)
    canvas.rect(0, 0, SIDEBAR_W, PAGE_H, fill=1, stroke=0)
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Build document
# ---------------------------------------------------------------------------

def build_pdf(output_path):
    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=0,
        rightMargin=0,
        topMargin=0,
        bottomMargin=0,
    )

    sidebar_frame = Frame(
        SIDEBAR_X + INNER_PAD,
        MARGIN_BOTTOM,
        SIDEBAR_W - 2 * INNER_PAD,
        PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        id="sidebar",
    )

    main_frame = Frame(
        MAIN_X,
        MARGIN_BOTTOM,
        MAIN_W - INNER_PAD,
        PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        id="main",
    )

    template = PageTemplate(
        id="two_col",
        frames=[sidebar_frame, main_frame],
        onPage=draw_sidebar_bg,
    )
    doc.addPageTemplates([template])

    S = make_styles()

    # Sidebar flows into frame 1, then main content into frame 2.
    # Use FrameBreak to separate them.
    from reportlab.platypus import FrameBreak

    story = sidebar_content(S) + [FrameBreak()] + main_content(S)

    doc.build(story)
    print(f"Generated: {output_path}")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "cv_folksam_v2.pdf")
    build_pdf(out)
