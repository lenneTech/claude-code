# Connect Claude Code to tools via MCP

> Source: https://code.claude.com/docs/en/mcp
> Generated: 2026-03-17T05:34:29.284Z

---

Claude Code can connect to hundreds of external tools and data sources through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction), an open source standard for AI-tool integrations. MCP servers give Claude Code access to your tools, databases, and APIs.


What you can do with MCP

With MCP servers connected, you can ask Claude Code to:

-   **Implement features from issue trackers**: “Add the feature described in JIRA issue ENG-4521 and create a PR on GitHub.”
-   **Analyze monitoring data**: “Check Sentry and Statsig to check the usage of the feature described in ENG-4521.”
-   **Query databases**: “Find emails of 10 random users who used feature ENG-4521, based on our PostgreSQL database.”
-   **Integrate designs**: “Update our standard email template based on the new Figma designs that were posted in Slack”
-   **Automate workflows**: “Create Gmail drafts inviting these 10 users to a feedback session about the new feature.”


Popular MCP servers

Here are some commonly used MCP servers you can connect to Claude Code:

Use third party MCP servers at your own risk - Anthropic has not verified the correctness or security of all these servers. Make sure you trust MCP servers you are installing. Be especially careful when using MCP servers that could fetch untrusted content, as these can expose you to prompt injection risk.

[**Notion**](https://developers.notion.com/docs/mcp)

Connect your Notion workspace to search, update, and power workflows across toolsCommand`claude mcp add --transport http notion https://mcp.notion.com/mcp`[**Canva**](https://www.canva.dev/docs/connect/canva-mcp-server-setup/)

Search, create, autofill, and export Canva designsCommand`claude mcp add --transport http canva https://mcp.canva.com/mcp`[**Figma**](https://help.figma.com/hc/en-us/articles/32132100833559)

Generate diagrams and better code from Figma contextCommand`claude mcp add --transport http figma-remote-mcp https://mcp.figma.com/mcp`[**Slack**](https://docs.slack.dev/ai/mcp-server)

Send messages, create canvases, and fetch Slack dataCommand`claude mcp add slack --transport http https://mcp.slack.com/mcp`[**Atlassian**](https://community.atlassian.com/forums/Atlassian-Platform-articles/Using-the-Atlassian-Remote-MCP-Server-beta/ba-p/3005104)

Access Jira & Confluence from ClaudeCommand`claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp`[**Linear**](https://linear.app/docs/mcp)

Manage issues, projects & team workflows in LinearCommand`claude mcp add --transport http linear https://mcp.linear.app/mcp`[**monday.com**](https://developer.monday.com/apps/docs/mondaycom-mcp-integration)

Manage projects, boards, and workflows in monday.comCommand`claude mcp add --transport http monday https://mcp.monday.com/mcp`[**Intercom**](https://developers.intercom.com/docs/guides/mcp)

Access to Intercom data for better customer insightsCommand`claude mcp add --transport http intercom https://mcp.intercom.com/mcp`[**Box**](https://developer.box.com/guides/box-mcp)

Search, access and get insights on your Box contentCommand`claude mcp add box --transport http https://mcp.box.com`[**Gamma**](https://gamma.app/docs/Gamma-MCP-Server-Documentation-m6p43kobgzy15zj?mode=doc)

Create presentations, docs, socials, and sites with AICommand`claude mcp add gamma --transport http https://mcp.gamma.app/mcp`[**Vercel**](https://vercel.com/docs/mcp/vercel-mcp)

Analyze, debug, and manage projects and deploymentsCommand`claude mcp add --transport http vercel https://mcp.vercel.com`[**Granola**](https://help.granola.ai/article/granola-mcp#set-up-guide)

The AI notepad for meetingsCommand`claude mcp add --transport http granola https://mcp.granola.ai/mcp`[**Asana**](https://developers.asana.com/docs/mcp-server)

Connect to Asana to coordinate tasks, projects, and goalsCommand`claude mcp add --transport streamable-http asana https://mcp.asana.com/v2/mcp`[**Miro**](https://developers.miro.com/docs/miro-mcp)

Access and create new content on Miro boardsCommand`claude mcp add --transport http miro https://mcp.miro.com/`[**Sentry**](https://docs.sentry.io/product/sentry-mcp/)

Search, query, and debug errors intelligentlyCommand`claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`[**PubMed**](https://support.claude.com/en/)

Search biomedical literature from PubMedCommand`claude mcp add pubmed --transport http https://pubmed.mcp.claude.com/mcp`[**n8n**](https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/)

Access and run your n8n workflowsRequires user-specific URL. [Get your URL here](https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/).

[**Supabase**](https://supabase.com/docs/guides/getting-started/mcp)

Manage databases, authentication, and storageCommand`claude mcp add --transport http supabase https://mcp.supabase.com/mcp`[**ClickUp**](https://help.clickup.com/hc/en-us/articles/33335772678423-What-is-ClickUp-MCP)

Project management & collaboration for teams & agentsCommand`claude mcp add clickup --transport http https://mcp.clickup.com/mcp`[**Hugging Face**](https://huggingface.co/settings/mcp)

Access the Hugging Face Hub and thousands of Gradio AppsCommand`claude mcp add --transport http hugging-face https://huggingface.co/mcp`[**Context7**](https://context7.com/docs/overview)

Up-to-date docs for LLMs and AI code editorsCommand`claude mcp add --transport http context7 https://mcp.context7.com/mcp`[**Stripe**](https://docs.stripe.com/mcp)

Payment processing and financial infrastructure toolsCommand`claude mcp add --transport http stripe https://mcp.stripe.com`[**Microsoft Learn**](https://learn.microsoft.com/en-us/training/support/mcp)

Search trusted Microsoft docs to power your developmentCommand`claude mcp add --transport http microsoft-learn https://learn.microsoft.com/api/mcp`[**Clay**](https://www.notion.so/clayrun/Clay-Claude-MCP-Server-Documentation-2ef7e66eb01480c9820de48041591aeb?showMoveTo=true&saveParent=true)

Find prospects. Research accounts. Personalize outreachCommand`claude mcp add --transport http clay https://api.clay.com/v3/mcp`[**NetSuite**](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_7200233106.html)

Connect Claude to NetSuite data for analysis & insightsRequires user-specific URL. [Get your URL here](https://system.netsuite.com/mcp/mcpinfo.nl).

[**Webflow**](https://developers.webflow.com/mcp/v1.0.0/reference/overview)

Manage Webflow CMS, pages, assets and sitesCommand`claude mcp add --transport http webflow https://mcp.webflow.com/mcp`[**Ahrefs**](https://docs.ahrefs.com/docs/mcp/reference/introduction)

SEO & AI search analyticsCommand`claude mcp add ahrefs --transport http https://api.ahrefs.com/mcp/mcp`[**Clinical Trials**](https://docs.mcp.deepsense.ai/guides/clinical_trials.html)

Access ClinicalTrials.gov dataCommand`claude mcp add clinical-trials --transport http https://mcp.deepsense.ai/clinical_trials/mcp`[**Cloudflare Developer Platform**](https://www.support.cloudflare.com/)

Build applications with compute, storage, and AICommand`claude mcp add --transport http cloudflare https://bindings.mcp.cloudflare.com/mcp`[**Scholar Gateway**](https://docs.scholargateway.ai)

Enhance responses with scholarly research and citationsCommand`claude mcp add scholar-gateway --transport http https://connector.scholargateway.ai/mcp`[**Smartsheet**](https://help.smartsheet.com/articles/2483663-use-smartsheet-connector-claude)

Analyze and manage Smartsheet data with ClaudeRequires user-specific URL. [Get your URL here](https://help.smartsheet.com/articles/2483656-install-smartsheet-connector-claude#toc-get-started).

[**Ramp**](https://docs.ramp.com/developer-api/v1/guides/ramp-mcp-remote)

Search, access, and analyze your Ramp financial dataCommand`claude mcp add --transport http ramp https://ramp-mcp-remote.ramp.com/mcp`[**ZoomInfo**](https://docs.zoominfo.com/docs/zi-api-mcp-overview/)

Enrich contacts & accounts with GTM intelligenceCommand`claude mcp add --transport http zoominfo https://mcp.zoominfo.com/mcp`[**bioRxiv**](https://docs.mcp.deepsense.ai/guides/biorxiv.html)

Access bioRxiv and medRxiv preprint dataCommand`claude mcp add biorxiv --transport http https://mcp.deepsense.ai/biorxiv/mcp`[**WordPress.com**](https://developer.wordpress.com/docs/mcp/)

Secure AI access to manage your WordPress.com sitesCommand`claude mcp add wordpress-com --transport http https://public-api.wordpress.com/wpcom/v2/mcp/v1`[**Netlify**](https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/)

Create, deploy, manage, and secure websites on Netlify.Command`claude mcp add --transport http netlify https://netlify-mcp.netlify.app/mcp`[**Snowflake**](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp)

Retrieve both structured and unstructured dataRequires user-specific URL. [Get your URL here](https://docs.snowflake.com/en/user-guide/admin-account-identifier#label-account-name-find).

[**Make**](https://developers.make.com/mcp-server/)

Run Make scenarios and manage your Make accountCommand`claude mcp add --transport http make https://mcp.make.com`[**NPI Registry**](https://docs.mcp.deepsense.ai/guides/npi_registry.html)

Access US National Provider Identifier (NPI) RegistryCommand`claude mcp add npi-registry --transport http https://mcp.deepsense.ai/npi_registry/mcp`[**GoDaddy**](https://developer.godaddy.com/mcp)

Search domains and check availabilityCommand`claude mcp add --transport http godaddy https://api.godaddy.com/v1/domains/mcp`[**Google Cloud BigQuery**](https://cloud.google.com/bigquery/docs/use-bigquery-mcp)

BigQuery: Advanced analytical insights for agentsCommand`claude mcp add --transport http bigquery https://bigquery.googleapis.com/mcp`[**CMS Coverage**](https://docs.mcp.deepsense.ai/guides/cms_coverage.html)

Access the CMS Coverage DatabaseCommand`claude mcp add cms-coverage --transport http https://mcp.deepsense.ai/cms_coverage/mcp`[**Glean**](https://docs.glean.com/administration/platform/mcp/about)

Bring enterprise context to Claude and your AI toolsRequires user-specific URL. [Get your URL here](https://docs.glean.com/administration/platform/mcp/about).

[**ChEMBL**](https://docs.mcp.deepsense.ai/guides/chembl.html)

Access the ChEMBL DatabaseCommand`claude mcp add chembl --transport http https://mcp.deepsense.ai/chembl/mcp`[**Hex**](https://learn.hex.tech/docs/administration/mcp-server)

Answer questions with the Hex agentRequires user-specific URL. [Get your URL here](https://learn.hex.tech/docs/administration/mcp-server#connect-to-claude).

[**ICD-10 Codes**](https://docs.mcp.deepsense.ai/guides/icd10_codes.html)

Access ICD-10-CM and ICD-10-PCS code setsCommand`claude mcp add icd-10-codes --transport http https://mcp.deepsense.ai/icd10_codes/mcp`[**PayPal**](https://mcp.paypal.com/)

Access PayPal payments platformCommand`claude mcp add --transport http paypal https://mcp.paypal.com/mcp`[**Open Targets**](https://github.com/opentargets/open-targets-platform-mcp)

Drug target discovery and prioritisation platformCommand`claude mcp add open-targets --transport http https://mcp.platform.opentargets.org/mcp`[**Databricks**](https://docs.databricks.com/aws/en/generative-ai/mcp/connect-external-services)

Managed MCP servers with Unity Catalog and Mosaic AIRequires user-specific URL. [Get your URL here](https://docs.databricks.com/aws/en/generative-ai/mcp/connect-external-services).

[**Vibe Prospecting**](https://developers.explorium.ai/mcp-docs/agentsource-mcp)

Find company & contact dataCommand`claude mcp add vibe-prospecting --transport http https://vibeprospecting.explorium.ai/mcp`[**AWS Marketplace**](https://docs.aws.amazon.com/marketplace/latest/APIReference/marketplace-mcp-server.html)

Discover, evaluate, and buy solutions for the cloudCommand`claude mcp add aws-marketplace --transport http https://marketplace-mcp.us-east-1.api.aws/mcp`[**Wix**](https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp)

Manage and build sites and apps on WixCommand`claude mcp add wix --transport http https://mcp.wix.com/mcp`[**Pendo**](https://support.pendo.io/hc/en-us/articles/41102236924955)

Connect to Pendo for product and user insightsRequires user-specific URL. [Get your URL here](https://support.pendo.io/hc/en-us/articles/41102236924955).

[**Klaviyo**](https://developers.klaviyo.com/en/docs/klaviyo_mcp_server)

Report, strategize & create with real-time Klaviyo dataCommand`claude mcp add klaviyo --transport http https://mcp.klaviyo.com/mcp?include-mcp-app=true`[**PostHog**](https://posthog.com/docs/model-context-protocol)

Query, analyze, and manage your PostHog insightsCommand`claude mcp add --transport http posthog https://mcp.posthog.com/mcp`[**Similarweb**](https://docs.similarweb.com/api-v5/mcp/mcp-setup)

Real time web, mobile app, and market data.Command`claude mcp add --transport http similarweb https://mcp.similarweb.com`[**Crypto.com**](https://mcp.crypto.com/docs)

Real time prices, orders, charts, and more for cryptoCommand`claude mcp add --transport http crypto.com https://mcp.crypto.com/market-data/mcp`[**BioRender**](https://help.biorender.com/hc/en-gb/articles/30870978672157-How-to-use-the-BioRender-MCP-connector)

Search for and use scientific templates and iconsCommand`claude mcp add biorender --transport http https://mcp.services.biorender.com/mcp`[**Attio**](https://docs.attio.com/mcp/overview)

Search, manage, and update your Attio CRM from ClaudeCommand`claude mcp add --transport http attio https://mcp.attio.com/mcp`[**Guru**](https://help.getguru.com/docs/connecting-gurus-mcp-server)

Search and interact with your company knowledgeCommand`claude mcp add guru --transport http https://mcp.api.getguru.com/mcp`[**Trivago**](https://mcp.trivago.com/docs)

Find your ideal hotel at the best price.Command`claude mcp add --transport http trivago https://mcp.trivago.com/mcp`[**Windsor.ai**](https://windsor.ai/introducing-windsor-mcp/#method-1-using-claude-desktop-3)

Connect 325+ marketing, analytics and CRM data sourcesCommand`claude mcp add windsor-ai --transport http https://mcp.windsor.ai`[**Synapse.org**](https://github.com/susheel/synapse-mcp?tab=readme-ov-file#synapse-mcp-server)

Search and metadata tools for Synapse scientific dataCommand`claude mcp add synapse-org --transport http https://mcp.synapse.org/mcp`[**Jam**](https://jam.dev/docs/debug-a-jam/mcp)

Record screen and collect automatic context for issuesCommand`claude mcp add --transport http jam https://mcp.jam.dev/mcp`[**Consensus**](https://docs.consensus.app/docs/mcp)

Explore scientific researchCommand`claude mcp add --transport http consensus https://mcp.consensus.app/mcp`[**Crossbeam**](https://help.crossbeam.com/en/articles/12601327-crossbeam-mcp-server-beta)

Explore partner data and ecosystem insights in ClaudeCommand`claude mcp add crossbeam --transport http https://mcp.crossbeam.com`[**Clockwise**](https://support.getclockwise.com/article/238-connecting-to-clockwise-mcp)

Advanced scheduling and time management for work.Command`claude mcp add --transport http clockwise https://mcp.getclockwise.com/mcp`[**Circleback**](https://circleback.ai/docs/mcp)

Search and access context from meetingsCommand`claude mcp add circleback --transport http https://app.circleback.ai/api/mcp`[**lastminute.com**](https://mcp.lastminute.com/docs)

Search, compare and book flights, dynamic packages (flight + hotel) and hotels across global airlines and hotel suppliers.Command`claude mcp add lastminute-com --transport http https://mcp.lastminute.com/mcp`[**Outreach**](https://support.outreach.io/hc/en-us/articles/46370115253403-Outreach-MCP-Server)

Unleash your team's best performance with Outreach AICommand`claude mcp add --transport http outreach https://api.outreach.io/mcp/`[**Mixpanel**](https://docs.mixpanel.com/docs/features/mcp)

Analyze, query, and manage your Mixpanel dataCommand`claude mcp add --transport http mixpanel https://mcp.mixpanel.com/mcp`[**Bitly**](https://dev.bitly.com/bitly-mcp/)

Shorten links, generate QR Codes, and track performanceCommand`claude mcp add bitly --transport http https://api-ssl.bitly.com/v4/mcp`[**CData Connect AI**](https://cloud.cdata.com/docs/Claude-Client.html)

Managed MCP platform for 350 sourcesCommand`claude mcp add cdata-connect-ai --transport http https://mcp.cloud.cdata.com/mcp`[**MT Newswires**](https://console.blueskyapi.com/docs/EDGE/news/MT_NEWSWIRES_Global#mcp)

Trusted real-time global financial news providerCommand`claude mcp add --transport http mtnewswire`[**Square**](https://developer.squareup.com/docs/mcp)

Search and manage transaction, merchant, and payment dataCommand`claude mcp add --transport sse square https://mcp.squareup.com/sse`[**Egnyte**](https://developers.egnyte.com/docs/Remote_MCP_Server)

Securely access and analyze Egnyte contentCommand`claude mcp add --transport http egnyte https://mcp-server.egnyte.com/mcp`[**Pylon**](https://support.usepylon.com/articles/2407390554-connecting-to-the-pylon-mcp-server?lang=en)

Search and manage Pylon support issuesCommand`claude mcp add --transport http pylon https://mcp.usepylon.com/`[**Honeycomb**](https://docs.honeycomb.io/troubleshoot/product-lifecycle/beta/mcp/)

Query and explore observability data and SLOsCommand`claude mcp add --transport http honeycomb https://mcp.honeycomb.io/mcp`[**Mercury**](https://docs.mercury.com/docs/connecting-mercury-mcp)

Search, analyze and understand your finances on MercuryCommand`claude mcp add mercury --transport http https://mcp.mercury.com/mcp`[**Udemy Business**](https://business-support.udemy.com/hc/en-us/articles/34213384429335-How-to-Integrate-the-Udemy-Business-MCP-Server-With-Your-AI-Tool#h_01K9CA42YGCV1AVXPY1RKABKP1)

Search and explore skill-building resourcesCommand`claude mcp add udemy-business --transport http https://api.udemy.com/mcp`[**Day AI**](https://day.ai/mcp)

Know everything about your prospects & customers with CRMxCommand`claude mcp add day-ai --transport http https://day.ai/api/mcp`[**Coupler.io**](https://help.coupler.io/article/592-coupler-local-mcp-server)

Access business data from hundreds of sourcesCommand`claude mcp add --transport http coupler https://mcp.coupler.io/mcp`[**Jotform**](https://www.jotform.com/developers/mcp/)

Create forms & analyze submissions inside ClaudeCommand`claude mcp add --transport http jotform https://mcp.jotform.com/mcp-app`[**Omni Analytics**](https://docs.omni.co/ai/mcp)

Query your data using natural language through Omni's semantic modelCommand`claude mcp add --transport http omni-analytics https://callbacks.omniapp.co/callback/mcp`[**Postman**](https://github.com/postmanlabs/postman-mcp-server)

Give API context to your coding agentsCommand`claude mcp add --transport http postman https://mcp.postman.com/minimal`[**Cloudinary**](https://cloudinary.com/documentation/cloudinary_llm_mcp#available_mcp_servers)

Manage, transform and deliver your images & videosCommand`claude mcp add --transport http cloudinary https://asset-management.mcp.cloudinary.com/sse`[**Customer.io**](https://docs.customer.io/ai/mcp-server/)

Explore customer data and generate insights via ClaudeRequires user-specific URL. [Get your URL here](https://docs.customer.io/ai/mcp-server/).

[**Candid**](https://support.claude.com/en/articles/12923235-using-the-candid-connector-in-claude)

Research nonprofits and funders using Candid's dataCommand`claude mcp add candid --transport http https://mcp.candid.org/mcp`[**Workato**](https://docs.workato.com/en/mcp.html)

Automate workflows and connect your business appsRequires user-specific URL. [Get your URL here](https://app.workato.com/ai_hub/mcp).

[**Pigment**](https://kb.pigment.com/docs/mcp-server)

Analyze business dataRequires user-specific URL. [Get your URL here](https://kb.pigment.com/docs/mcp-server).

[**LunarCrush**](https://lunarcrush.com/developers/api/ai)

Add real-time social media data to your searchesCommand`claude mcp add lunarcrush --transport http https://lunarcrush.ai/mcp`[**Harmonic**](https://support.harmonic.ai/en/articles/12785899-harmonic-mcp-server-getting-started-guide)

Discover, research, and enrich companies and peopleCommand`claude mcp add harmonic --transport http https://mcp.api.harmonic.ai`[**Dice**](https://www.dice.com/about/mcp)

Find active tech jobs on DiceCommand`claude mcp add dice --transport http https://mcp.dice.com/mcp`[**MotherDuck**](https://motherduck.com/docs/sql-reference/mcp/)

Get answers from your dataCommand`claude mcp add motherduck --transport http https://api.motherduck.com/mcp`[**AirOps**](https://docs.airops.com/mcp)

Craft content that wins AI searchCommand`claude mcp add airops --transport http https://app.airops.com/mcp`[**Midpage Legal Research**](https://midpage-docs.apidocumentation.com/documentation/integration/mcp-tools)

Conduct legal research and create work productCommand`claude mcp add --transport http midpage https://app.midpage.ai/mcp`[**Magic Patterns**](https://www.magicpatterns.com/docs/documentation/features/mcp-server/overview)

Discuss and iterate on Magic Patterns designsCommand`claude mcp add --transport http magic-patterns https://mcp.magicpatterns.com/mcp`[**Chronograph**](https://lp-help.chronograph.pe/article/735-chronograph-mcp)

Interact with your Chronograph data directly in ClaudeCommand`claude mcp add --transport http chronograph https://ai.chronograph.pe/mcp`[**ActiveCampaign**](https://developers.activecampaign.com/page/mcp)

Autonomous marketing to transform how you workRequires user-specific URL. [Get your URL here](https://developers.activecampaign.com/page/mcp).

[**MailerLite**](https://developers.mailerlite.com/mcp/#how-mcp-works)

Turn Claude into your email marketing assistantCommand`claude mcp add --transport http mailerlite https://mcp.mailerlite.com/mcp`[**Blockscout**](https://github.com/blockscout/mcp-server)

Access and analyze blockchain dataCommand`claude mcp add blockscout --transport http https://mcp.blockscout.com/mcp`[**Owkin**](https://docs.owkin.com/core-features-and-usage)

Interact with AI agents built for biologyCommand`claude mcp add owkin --transport http https://mcp.k.owkin.com/mcp`[**Aura**](https://docs.getaura.ai/)

Company intelligence & workforce analyticsCommand`claude mcp add --transport http auraintelligence https://mcp.auraintelligence.com/mcp`[**DevRev**](https://support.devrev.ai/en-US/devrev/article/ART-21859-remote-mcp-server)

Search and update your company's knowledge graphCommand`claude mcp add devrev --transport http https://api.devrev.ai/mcp/v1`[**Medidata**](https://learn.medidata.com/en-US/bundle/mcp-server-documentation/page/medidata_mcp_server_documentation.html)

Clinical trial software and site ranking toolsCommand`claude mcp add medidata --transport http https://mcp.imedidata.com/mcp`[**Sanity**](https://www.sanity.io/docs/ai/mcp-server)

Create, query, and manage structured content in SanityCommand`claude mcp add --transport http sanity https://mcp.sanity.io`[**Melon**](https://tech.kakaoent.com/ai/using-melon-mcp-server-en/)

Browse music charts & your personalized music picksCommand`claude mcp add melon --transport http https://mcp.melon.com/mcp/`[**PlayMCP**](https://www.notion.so/2189b97b4888803dbbdcef264e7eff58)

Connect and use PlayMCP servers in your toolboxCommand`claude mcp add playmcp --transport http https://playmcp.kakao.com/mcp`[**Clarify**](https://docs.clarify.ai/en/articles/13367278-clarify-mcp)

Query your CRM. Create records. Ask anything.Command`claude mcp add --transport http clarify https://api.clarify.ai/mcp`[**Krisp**](https://help.krisp.ai/hc/en-us/articles/25416265429660-Krisp-MCP-Supported-tools)

Add your meetings context via transcripts and notesCommand`claude mcp add --transport http krisp https://mcp.krisp.ai/mcp`[**Mem**](https://docs.mem.ai/mcp/overview)

The AI notebook for everything on your mindCommand`claude mcp add --transport http mem https://mcp.mem.ai/mcp`[**Zapier**](https://docs.zapier.com/mcp/home)

Automate workflows across thousands of apps via conversationCommand`claude mcp add zapier --transport http https://mcp.zapier.com/api/v1/connect`[**Ticket Tailor**](https://help.tickettailor.com/en/articles/11892797-how-to-connect-ticket-tailor-to-your-favourite-ai-agent)

Event platform for managing tickets, orders & moreCommand`claude mcp add --transport http tickettailor https://mcp.tickettailor.ai/mcp`[**Port IO**](https://docs.port.io/ai-interfaces/port-mcp-server/overview-and-installation)

Search your context lake and safely run actionsRequires user-specific URL. [Get your URL here](https://docs.port.io/ai-interfaces/port-mcp-server/overview-and-installation/?mcp-setup=claude&region=eu#installing-port-mcp).

[**Clerk**](https://clerk.com/docs/guides/ai/mcp/clerk-mcp-server)

Add authentication, organizations, and billingCommand`claude mcp add --transport http clerk https://mcp.clerk.com/mcp`[**PlanetScale**](https://planetscale.com/docs/connect/mcp)

Authenticated access to your Postgres and MySQL DB'sCommand`claude mcp add --transport http planetscale https://mcp.pscale.dev/mcp/planetscale`[**Lumin**](https://github.com/luminpdf/lumin-mcp-server)

Manage documents, send signature requests, and convert Markdown to PDFCommand`claude mcp add --transport http lumin https://mcp.luminpdf.com/mcp`[**Wyndham Hotels and Resorts**](https://www.wyndhamhotels.com/mcp-doc)

Discover the right Wyndham Hotel for you, fasterCommand`claude mcp add --transport http wyndham-hotels https://mcp.wyndhamhotels.com/claude/mcp`[**Sprouts Data Intelligence**](https://support.sprouts.ai/en/articles/13384582-sprouts-mcp-server-documentation#h_541c149a52)

From query to qualified lead in seconds.Command`claude mcp add --transport http sprouts https://sprouts-mcp-server.kartikay-dhar.workers.dev`[**LILT**](https://support.lilt.com/kb/LILT-mcp)

High-quality translation with human verificationCommand`claude mcp add --transport http lilt https://mcp.lilt.com/mcp`[**GraphOS MCP Tools**](https://www.apollographql.com/docs/graphos/platform/graphos-mcp-tools)

Search Apollo docs, specs, and best practicesCommand`claude mcp add --transport http graphos-tools https://mcp.apollographql.com`[**Benchling**](https://help.benchling.com/hc/en-us/articles/40342713479437-Benchling-MCP)

Connect to R&D data, source experiments, and notebooksRequires user-specific URL. [Get your URL here](https://help.benchling.com/hc/en-us/articles/40342713479437-Benchling-MCP).

[**Craft**](https://documents.craft.me/jWeCVJrSfxFRuA)

Notes & second brainCommand`claude mcp add --transport http craft https://mcp.craft.do/my/mcp`[**Metaview**](https://support.metaview.ai/integrations/mcp-integration/mcp-overview.mdx)

The AI platform for recruiting.Command`claude mcp add --transport http metaview https://mcp.metaview.ai/mcp`[**Airwallex Developer**](https://www.airwallex.com/docs/developer-tools/ai/developer-mcp)

Integrate with the Airwallex Platform using ClaudeCommand`claude mcp add --transport http airwallex-developer https://mcp-demo.airwallex.com/developer`[**Local Falcon**](https://github.com/local-falcon/mcp)

AI visibility and local search intelligence platformCommand`claude mcp add --transport sse local-falcon https://mcp.localfalcon.com`[**Clarity AI**](https://clarity-sfdr20-mcp.pro.clarity.ai/)

Simulate fund classifications under proposed SFDR 2.0Command`claude mcp add --transport http clarity-ai https://clarity-sfdr20-mcp.pro.clarity.ai/mcp`[**Tavily**](https://docs.tavily.com/documentation/mcp)

Connect your AI agents to the webCommand`claude mcp add --transport http tavily https://mcp.tavily.com/mcp`[**Visier**](https://docs.visier.com/developer/agents/mcp/mcp-server.htm)

Find people, productivity and business impact insightsRequires user-specific URL. [Get your URL here](https://docs.visier.com/developer/agents/mcp/mcp-server-set-up.htm).

[**DataGrail**](https://docs.datagrail.io/docs/vera/vera-mcp/introduction-and-use)

Secure, production-ready AI orchestration for privacyRequires user-specific URL. [Get your URL here](https://docs.datagrail.io/docs/vera/vera-mcp/introduction-and-use).

[**Starburst**](https://docs.starburst.io/starburst-galaxy/ai-workflows/mcp-server.html)

Securely retrieve data from your federated data sourcesRequires user-specific URL. [Get your URL here](https://docs.starburst.io/starburst-galaxy/ai-workflows/mcp-server.html).

[**Fever Event Discovery**](https://developer.feverup.com/)

Discover live entertainment events worldwideCommand`claude mcp add --transport http fever-event-discovery https://data-search.apigw.feverup.com/mcp`[**Amplitude**](https://amplitude.com/docs/analytics/amplitude-mcp)

Search, access, and get insights on your Amplitude dataCommand`claude mcp add --transport http amplitude https://mcp.amplitude.com/mcp`[**Airtable**](https://github.com/domdomegg/airtable-mcp-server)

Read and write Airtable databases

**Need a specific integration?** [Find hundreds more MCP servers on GitHub](https://github.com/modelcontextprotocol/servers), or build your own using the [MCP SDK](https://modelcontextprotocol.io/quickstart/server).


Installing MCP servers

MCP servers can be configured in three different ways depending on your needs:


Option 1: Add a remote HTTP server

HTTP servers are the recommended option for connecting to remote MCP servers. This is the most widely supported transport for cloud-based services.```# Basic syntax
claude mcp add --transport http <name> <url>

# Real example: Connect to Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Example with Bearer token
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"```Option 2: Add a remote SSE server

The SSE (Server-Sent Events) transport is deprecated. Use HTTP servers instead, where available.```# Basic syntax
claude mcp add --transport sse <name> <url>

# Real example: Connect to Asana
claude mcp add --transport sse asana https://mcp.asana.com/sse

# Example with authentication header
claude mcp add --transport sse private-api https://api.company.com/sse \
  --header "X-API-Key: your-key-here"```Option 3: Add a local stdio server

Stdio servers run as local processes on your machine. They’re ideal for tools that need direct system access or custom scripts.```# Basic syntax
claude mcp add [options] <name> -- <command> [args...]

# Real example: Add Airtable server
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server```**Important: Option ordering**All options (`--transport`,`--env`,`--scope`,`--header`) must come **before** the server name. The`--`(double dash) then separates the server name from the command and arguments that get passed to the MCP server.For example:

-`claude mcp add --transport stdio myserver -- npx server`→ runs`npx server`-`claude mcp add --transport stdio --env KEY=value myserver -- python server.py --port 8080`→ runs`python server.py --port 8080`with`KEY=value`in environment

This prevents conflicts between Claude’s flags and the server’s flags.


Managing your servers

Once configured, you can manage your MCP servers with these commands:```# List all configured servers
claude mcp list

# Get details for a specific server
claude mcp get github

# Remove a server
claude mcp remove github

# (within Claude Code) Check server status
/mcp```Dynamic tool updates

Claude Code supports MCP`list_changed`notifications, allowing MCP servers to dynamically update their available tools, prompts, and resources without requiring you to disconnect and reconnect. When an MCP server sends a`list_changed`notification, Claude Code automatically refreshes the available capabilities from that server.

Tips:

-   Use the`--scope`flag to specify where the configuration is stored:
    -`local`(default): Available only to you in the current project (was called`project`in older versions)
    -`project`: Shared with everyone in the project via`.mcp.json`file
    -`user`: Available to you across all projects (was called`global`in older versions)
-   Set environment variables with`--env`flags (for example,`--env KEY=value`)
-   Configure MCP server startup timeout using the MCP\_TIMEOUT environment variable (for example,`MCP_TIMEOUT=10000 claude`sets a 10-second timeout)
-   Claude Code will display a warning when MCP tool output exceeds 10,000 tokens. To increase this limit, set the`MAX_MCP_OUTPUT_TOKENS`environment variable (for example,`MAX_MCP_OUTPUT_TOKENS=50000`)
-   Use`/mcp`to authenticate with remote servers that require OAuth 2.0 authentication

**Windows Users**: On native Windows (not WSL), local MCP servers that use`npx`require the`cmd /c`wrapper to ensure proper execution.```# This creates command="cmd" which Windows can execute
claude mcp add --transport stdio my-server -- cmd /c npx -y @some/package```Without the`cmd /c`wrapper, you’ll encounter “Connection closed” errors because Windows cannot directly execute`npx`. (See the note above for an explanation of the`--`parameter.)


Plugin-provided MCP servers

[Plugins](/docs/en/plugins) can bundle MCP servers, automatically providing tools and integrations when the plugin is enabled. Plugin MCP servers work identically to user-configured servers. **How plugin MCP servers work**:

-   Plugins define MCP servers in`.mcp.json`at the plugin root or inline in`plugin.json`-   When a plugin is enabled, its MCP servers start automatically
-   Plugin MCP tools appear alongside manually configured MCP tools
-   Plugin servers are managed through plugin installation (not`/mcp`commands)

**Example plugin MCP configuration**: In`.mcp.json`at plugin root:```{
  "database-tools": {
    "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
    "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
    "env": {
      "DB_URL": "${DB_URL}"
    }
  }
}```Or inline in`plugin.json`:```{
  "name": "my-plugin",
  "mcpServers": {
    "plugin-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/api-server",
      "args": ["--port", "8080"]
    }
  }
}```**Plugin MCP features**:

-   **Automatic lifecycle**: At session startup, servers for enabled plugins connect automatically. If you enable or disable a plugin during a session, run`/reload-plugins`to connect or disconnect its MCP servers
-   **Environment variables**: Use`${CLAUDE_PLUGIN_ROOT}`for plugin-relative paths
-   **User environment access**: Access to same environment variables as manually configured servers
-   **Multiple transport types**: Support stdio, SSE, and HTTP transports (transport support may vary by server)

**Viewing plugin MCP servers**:```# Within Claude Code, see all MCP servers including plugin ones
/mcp```Plugin servers appear in the list with indicators showing they come from plugins. **Benefits of plugin MCP servers**:

-   **Bundled distribution**: Tools and servers packaged together
-   **Automatic setup**: No manual MCP configuration needed
-   **Team consistency**: Everyone gets the same tools when plugin is installed

See the [plugin components reference](/docs/en/plugins-reference#mcp-servers) for details on bundling MCP servers with plugins.


MCP installation scopes

MCP servers can be configured at three different scope levels, each serving distinct purposes for managing server accessibility and sharing. Understanding these scopes helps you determine the best way to configure servers for your specific needs.


Local scope

Local-scoped servers represent the default configuration level and are stored in`~/.claude.json`under your project’s path. These servers remain private to you and are only accessible when working within the current project directory. This scope is ideal for personal development servers, experimental configurations, or servers containing sensitive credentials that shouldn’t be shared.

The term “local scope” for MCP servers differs from general local settings. MCP local-scoped servers are stored in`~/.claude.json`(your home directory), while general local settings use`.claude/settings.local.json`(in the project directory). See [Settings](/docs/en/settings#settings-files) for details on settings file locations.```# Add a local-scoped server (default)
claude mcp add --transport http stripe https://mcp.stripe.com

# Explicitly specify local scope
claude mcp add --transport http stripe --scope local https://mcp.stripe.com```Project scope

Project-scoped servers enable team collaboration by storing configurations in a`.mcp.json`file at your project’s root directory. This file is designed to be checked into version control, ensuring all team members have access to the same MCP tools and services. When you add a project-scoped server, Claude Code automatically creates or updates this file with the appropriate configuration structure.```# Add a project-scoped server
claude mcp add --transport http paypal --scope project https://mcp.paypal.com/mcp```The resulting`.mcp.json`file follows a standardized format:```{
  "mcpServers": {
    "shared-server": {
      "command": "/path/to/server",
      "args": [],
      "env": {}
    }
  }
}```For security reasons, Claude Code prompts for approval before using project-scoped servers from`.mcp.json`files. If you need to reset these approval choices, use the`claude mcp reset-project-choices`command.


User scope

User-scoped servers are stored in`~/.claude.json`and provide cross-project accessibility, making them available across all projects on your machine while remaining private to your user account. This scope works well for personal utility servers, development tools, or services you frequently use across different projects.```# Add a user server
claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic```Choosing the right scope

Select your scope based on:

-   **Local scope**: Personal servers, experimental configurations, or sensitive credentials specific to one project
-   **Project scope**: Team-shared servers, project-specific tools, or services required for collaboration
-   **User scope**: Personal utilities needed across multiple projects, development tools, or frequently used services

**Where are MCP servers stored?**

-   **User and local scope**:`~/.claude.json`(in the`mcpServers`field or under project paths)
-   **Project scope**:`.mcp.json`in your project root (checked into source control)
-   **Managed**:`managed-mcp.json`in system directories (see [Managed MCP configuration](#managed-mcp-configuration))


Scope hierarchy and precedence

MCP server configurations follow a clear precedence hierarchy. When servers with the same name exist at multiple scopes, the system resolves conflicts by prioritizing local-scoped servers first, followed by project-scoped servers, and finally user-scoped servers. This design ensures that personal configurations can override shared ones when needed.


Environment variable expansion in`.mcp.json`Claude Code supports environment variable expansion in`.mcp.json`files, allowing teams to share configurations while maintaining flexibility for machine-specific paths and sensitive values like API keys. **Supported syntax:**

-`${VAR}`- Expands to the value of environment variable`VAR`-`${VAR:-default}`- Expands to`VAR`if set, otherwise uses`default`**Expansion locations:** Environment variables can be expanded in:

-`command`- The server executable path
-`args`- Command-line arguments
-`env`- Environment variables passed to the server
-`url`- For HTTP server types
-`headers`- For HTTP server authentication

**Example with variable expansion:**```{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}```If a required environment variable is not set and has no default value, Claude Code will fail to parse the config.


Practical examples


Example: Monitor errors with Sentry```claude mcp add --transport http sentry https://mcp.sentry.dev/mcp```Authenticate with your Sentry account:```/mcp```Then debug production issues:```What are the most common errors in the last 24 hours?``````Show me the stack trace for error ID abc123``````Which deployment introduced these new errors?```Example: Connect to GitHub for code reviews```claude mcp add --transport http github https://api.githubcopilot.com/mcp/```Authenticate if needed by selecting “Authenticate” for GitHub:```/mcp```Then work with GitHub:```Review PR #456 and suggest improvements``````Create a new issue for the bug we just found``````Show me all open PRs assigned to me```Example: Query your PostgreSQL database```claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"```Then query your database naturally:```What's our total revenue this month?``````Show me the schema for the orders table``````Find customers who haven't made a purchase in 90 days```Authenticate with remote MCP servers

Many cloud-based MCP servers require authentication. Claude Code supports OAuth 2.0 for secure connections.

1

Add the server that requires authentication

For example:```claude mcp add --transport http sentry https://mcp.sentry.dev/mcp```2

Use the /mcp command within Claude Code

In Claude code, use the command:```/mcp```Then follow the steps in your browser to login.

Tips:

-   Authentication tokens are stored securely and refreshed automatically
-   Use “Clear authentication” in the`/mcp`menu to revoke access
-   If your browser doesn’t open automatically, copy the provided URL and open it manually
-   If the browser redirect fails with a connection error after authenticating, paste the full callback URL from your browser’s address bar into the URL prompt that appears in Claude Code
-   OAuth authentication works with HTTP servers


Use a fixed OAuth callback port

Some MCP servers require a specific redirect URI registered in advance. By default, Claude Code picks a random available port for the OAuth callback. Use`--callback-port`to fix the port so it matches a pre-registered redirect URI of the form`http://localhost:PORT/callback`. You can use`--callback-port`on its own (with dynamic client registration) or together with`--client-id`(with pre-configured credentials).```# Fixed callback port with dynamic client registration
claude mcp add --transport http \
  --callback-port 8080 \
  my-server https://mcp.example.com/mcp```Use pre-configured OAuth credentials

Some MCP servers don’t support automatic OAuth setup. If you see an error like “Incompatible auth server: does not support dynamic client registration,” the server requires pre-configured credentials. Register an OAuth app through the server’s developer portal first, then provide the credentials when adding the server.

1

Register an OAuth app with the server

Create an app through the server’s developer portal and note your client ID and client secret.Many servers also require a redirect URI. If so, choose a port and register a redirect URI in the format`http://localhost:PORT/callback`. Use that same port with`--callback-port`in the next step.

2

Add the server with your credentials

Choose one of the following methods. The port used for`--callback-port`can be any available port. It just needs to match the redirect URI you registered in the previous step.

-   claude mcp add

-   claude mcp add-json

-   claude mcp add-json (callback port only)

-   CI / env var


Use`--client-id`to pass your app’s client ID. The`--client-secret`flag prompts for the secret with masked input:```claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp```Include the`oauth`object in the JSON config and pass`--client-secret`as a separate flag:```claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"clientId":"your-client-id","callbackPort":8080}}' \
  --client-secret```Use`--callback-port`without a client ID to fix the port while using dynamic client registration:```claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"callbackPort":8080}}'```Set the secret via environment variable to skip the interactive prompt:```MCP_CLIENT_SECRET=your-secret claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp```3

Authenticate in Claude Code

Run`/mcp`in Claude Code and follow the browser login flow.

Tips:

-   The client secret is stored securely in your system keychain (macOS) or a credentials file, not in your config
-   If the server uses a public OAuth client with no secret, use only`--client-id`without`--client-secret`-`--callback-port`can be used with or without`--client-id`-   These flags only apply to HTTP and SSE transports. They have no effect on stdio servers
-   Use`claude mcp get <name>`to verify that OAuth credentials are configured for a server


Override OAuth metadata discovery

If your MCP server returns errors on the standard OAuth metadata endpoint (`/.well-known/oauth-authorization-server`) but exposes a working OIDC endpoint, you can tell Claude Code to fetch OAuth metadata directly from a URL you specify, bypassing the standard discovery chain. Set`authServerMetadataUrl`in the`oauth`object of your server’s config in`.mcp.json`:```{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "authServerMetadataUrl": "https://auth.example.com/.well-known/openid-configuration"
      }
    }
  }
}```The URL must use`https://`. This option requires Claude Code v2.1.64 or later.


Add MCP servers from JSON configuration

If you have a JSON configuration for an MCP server, you can add it directly:

1

Add an MCP server from JSON```# Basic syntax
claude mcp add-json <name> '<json>'

# Example: Adding an HTTP server with JSON configuration
claude mcp add-json weather-api '{"type":"http","url":"https://api.weather.com/mcp","headers":{"Authorization":"Bearer token"}}'

# Example: Adding a stdio server with JSON configuration
claude mcp add-json local-weather '{"type":"stdio","command":"/path/to/weather-cli","args":["--api-key","abc123"],"env":{"CACHE_DIR":"/tmp"}}'

# Example: Adding an HTTP server with pre-configured OAuth credentials
claude mcp add-json my-server '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"clientId":"your-client-id","callbackPort":8080}}' --client-secret```2

Verify the server was added```claude mcp get weather-api```Tips:

-   Make sure the JSON is properly escaped in your shell
-   The JSON must conform to the MCP server configuration schema
-   You can use`--scope user`to add the server to your user configuration instead of the project-specific one


Import MCP servers from Claude Desktop

If you’ve already configured MCP servers in Claude Desktop, you can import them:

1

Import servers from Claude Desktop```# Basic syntax
claude mcp add-from-claude-desktop```2

Select which servers to import

After running the command, you’ll see an interactive dialog that allows you to select which servers you want to import.

3

Verify the servers were imported```claude mcp list```Tips:

-   This feature only works on macOS and Windows Subsystem for Linux (WSL)
-   It reads the Claude Desktop configuration file from its standard location on those platforms
-   Use the`--scope user`flag to add servers to your user configuration
-   Imported servers will have the same names as in Claude Desktop
-   If servers with the same names already exist, they will get a numerical suffix (for example,`server_1`)


Use MCP servers from Claude.ai

If you’ve logged into Claude Code with a [Claude.ai](https://claude.ai) account, MCP servers you’ve added in Claude.ai are automatically available in Claude Code:

1

Configure MCP servers in Claude.ai

Add servers at [claude.ai/settings/connectors](https://claude.ai/settings/connectors). On Team and Enterprise plans, only admins can add servers.

2

Authenticate the MCP server

Complete any required authentication steps in Claude.ai.

3

View and manage servers in Claude Code

In Claude Code, use the command:```/mcp```Claude.ai servers appear in the list with indicators showing they come from Claude.ai.

To disable claude.ai MCP servers in Claude Code, set the`ENABLE_CLAUDEAI_MCP_SERVERS`environment variable to`false`:```ENABLE_CLAUDEAI_MCP_SERVERS=false claude```Use Claude Code as an MCP server

You can use Claude Code itself as an MCP server that other applications can connect to:```# Start Claude as a stdio MCP server
claude mcp serve```You can use this in Claude Desktop by adding this configuration to claude\_desktop\_config.json:```{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}```**Configuring the executable path**: The`command`field must reference the Claude Code executable. If the`claude`command is not in your system’s PATH, you’ll need to specify the full path to the executable.To find the full path:```which claude```Then use the full path in your configuration:```{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "/full/path/to/claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}```Without the correct executable path, you’ll encounter errors like`spawn claude ENOENT`.

Tips:

-   The server provides access to Claude’s tools like View, Edit, LS, etc.
-   In Claude Desktop, try asking Claude to read files in a directory, make edits, and more.
-   Note that this MCP server is only exposing Claude Code’s tools to your MCP client, so your own client is responsible for implementing user confirmation for individual tool calls.


MCP output limits and warnings

When MCP tools produce large outputs, Claude Code helps manage the token usage to prevent overwhelming your conversation context:

-   **Output warning threshold**: Claude Code displays a warning when any MCP tool output exceeds 10,000 tokens
-   **Configurable limit**: You can adjust the maximum allowed MCP output tokens using the`MAX_MCP_OUTPUT_TOKENS`environment variable
-   **Default limit**: The default maximum is 25,000 tokens

To increase the limit for tools that produce large outputs:```# Set a higher limit for MCP tool outputs
export MAX_MCP_OUTPUT_TOKENS=50000
claude```This is particularly useful when working with MCP servers that:

-   Query large datasets or databases
-   Generate detailed reports or documentation
-   Process extensive log files or debugging information

If you frequently encounter output warnings with specific MCP servers, consider increasing the limit or configuring the server to paginate or filter its responses.


Respond to MCP elicitation requests

MCP servers can request structured input from you mid-task using elicitation. When a server needs information it can’t get on its own, Claude Code displays an interactive dialog and passes your response back to the server. No configuration is required on your side: elicitation dialogs appear automatically when a server requests them. Servers can request input in two ways:

-   **Form mode**: Claude Code shows a dialog with form fields defined by the server (for example, a username and password prompt). Fill in the fields and submit.
-   **URL mode**: Claude Code opens a browser URL for authentication or approval. Complete the flow in the browser, then confirm in the CLI.

To auto-respond to elicitation requests without showing a dialog, use the [`Elicitation`hook](/docs/en/hooks#elicitation). If you’re building an MCP server that uses elicitation, see the [MCP elicitation specification](https://modelcontextprotocol.io/docs/learn/client-concepts#elicitation) for protocol details and schema examples.


Use MCP resources

MCP servers can expose resources that you can reference using @ mentions, similar to how you reference files.


Reference MCP resources

1

List available resources

Type`@`in your prompt to see available resources from all connected MCP servers. Resources appear alongside files in the autocomplete menu.

2

Reference a specific resource

Use the format`@server:protocol://resource/path`to reference a resource:```Can you analyze @github:issue://123 and suggest a fix?``````Please review the API documentation at @docs:file://api/authentication```3

Multiple resource references

You can reference multiple resources in a single prompt:```Compare @postgres:schema://users with @docs:file://database/user-model```Tips:

-   Resources are automatically fetched and included as attachments when referenced
-   Resource paths are fuzzy-searchable in the @ mention autocomplete
-   Claude Code automatically provides tools to list and read MCP resources when servers support them
-   Resources can contain any type of content that the MCP server provides (text, JSON, structured data, etc.)


Scale with MCP Tool Search

When you have many MCP servers configured, tool definitions can consume a significant portion of your context window. MCP Tool Search solves this by dynamically loading tools on-demand instead of preloading all of them.


How it works

Claude Code automatically enables Tool Search when your MCP tool descriptions would consume more than 10% of the context window. You can [adjust this threshold](#configure-tool-search) or disable tool search entirely. When triggered:

1.  MCP tools are deferred rather than loaded into context upfront
2.  Claude uses a search tool to discover relevant MCP tools when needed
3.  Only the tools Claude actually needs are loaded into context
4.  MCP tools continue to work exactly as before from your perspective


For MCP server authors

If you’re building an MCP server, the server instructions field becomes more useful with Tool Search enabled. Server instructions help Claude understand when to search for your tools, similar to how [skills](/docs/en/skills) work. Add clear, descriptive server instructions that explain:

-   What category of tasks your tools handle
-   When Claude should search for your tools
-   Key capabilities your server provides


Configure tool search

Tool search is enabled by default: MCP tools are deferred and discovered on demand. When`ANTHROPIC_BASE_URL`points to a non-first-party host, tool search is disabled by default because most proxies do not forward`tool_reference`blocks. Set`ENABLE_TOOL_SEARCH`explicitly if your proxy does. This feature requires models that support`tool_reference`blocks: Sonnet 4 and later, or Opus 4 and later. Haiku models do not support tool search. Control tool search behavior with the`ENABLE_TOOL_SEARCH`environment variable:

| Value | Behavior |
| --- | --- |
| (unset) | Enabled by default. Disabled when`ANTHROPIC_BASE_URL`is a non-first-party host |
|`true`| Always enabled, including for non-first-party`ANTHROPIC_BASE_URL`|
|`auto`| Activates when MCP tools exceed 10% of context |
|`auto:<N>`| Activates at custom threshold, where`<N>`is a percentage (e.g.,`auto:5`for 5%) |
|`false`| Disabled, all MCP tools loaded upfront |```# Use a custom 5% threshold
ENABLE_TOOL_SEARCH=auto:5 claude

# Disable tool search entirely
ENABLE_TOOL_SEARCH=false claude```Or set the value in your [settings.json`env`field](/docs/en/settings#available-settings). You can also disable the MCPSearch tool specifically using the`disallowedTools`setting:```{
  "permissions": {
    "deny": ["MCPSearch"]
  }
}```Use MCP prompts as commands

MCP servers can expose prompts that become available as commands in Claude Code.


Execute MCP prompts

1

Discover available prompts

Type`/`to see all available commands, including those from MCP servers. MCP prompts appear with the format`/mcp__servername__promptname`.

2

Execute a prompt without arguments```/mcp__github__list_prs```3

Execute a prompt with arguments

Many prompts accept arguments. Pass them space-separated after the command:```/mcp__github__pr_review 456``````/mcp__jira__create_issue "Bug in login flow" high```Tips:

-   MCP prompts are dynamically discovered from connected servers
-   Arguments are parsed based on the prompt’s defined parameters
-   Prompt results are injected directly into the conversation
-   Server and prompt names are normalized (spaces become underscores)


Managed MCP configuration

For organizations that need centralized control over MCP servers, Claude Code supports two configuration options:

1.  **Exclusive control with`managed-mcp.json`**: Deploy a fixed set of MCP servers that users cannot modify or extend
2.  **Policy-based control with allowlists/denylists**: Allow users to add their own servers, but restrict which ones are permitted

These options allow IT administrators to:

-   **Control which MCP servers employees can access**: Deploy a standardized set of approved MCP servers across the organization
-   **Prevent unauthorized MCP servers**: Restrict users from adding unapproved MCP servers
-   **Disable MCP entirely**: Remove MCP functionality completely if needed


Option 1: Exclusive control with managed-mcp.json

When you deploy a`managed-mcp.json`file, it takes **exclusive control** over all MCP servers. Users cannot add, modify, or use any MCP servers other than those defined in this file. This is the simplest approach for organizations that want complete control. System administrators deploy the configuration file to a system-wide directory:

-   macOS:`/Library/Application Support/ClaudeCode/managed-mcp.json`-   Linux and WSL:`/etc/claude-code/managed-mcp.json`-   Windows:`C:\Program Files\ClaudeCode\managed-mcp.json`These are system-wide paths (not user home directories like`~/Library/...`) that require administrator privileges. They are designed to be deployed by IT administrators.

The`managed-mcp.json`file uses the same format as a standard`.mcp.json`file:```{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp"
    },
    "company-internal": {
      "type": "stdio",
      "command": "/usr/local/bin/company-mcp-server",
      "args": ["--config", "/etc/company/mcp-config.json"],
      "env": {
        "COMPANY_API_URL": "https://internal.company.com"
      }
    }
  }
}```Option 2: Policy-based control with allowlists and denylists

Instead of taking exclusive control, administrators can allow users to configure their own MCP servers while enforcing restrictions on which servers are permitted. This approach uses`allowedMcpServers`and`deniedMcpServers`in the [managed settings file](/docs/en/settings#settings-files).

**Choosing between options**: Use Option 1 (`managed-mcp.json`) when you want to deploy a fixed set of servers with no user customization. Use Option 2 (allowlists/denylists) when you want to allow users to add their own servers within policy constraints.


Restriction options

Each entry in the allowlist or denylist can restrict servers in three ways:

1.  **By server name** (`serverName`): Matches the configured name of the server
2.  **By command** (`serverCommand`): Matches the exact command and arguments used to start stdio servers
3.  **By URL pattern** (`serverUrl`): Matches remote server URLs with wildcard support

**Important**: Each entry must have exactly one of`serverName`,`serverCommand`, or`serverUrl`.


Example configuration```{
  "allowedMcpServers": [
    // Allow by server name
    { "serverName": "github" },
    { "serverName": "sentry" },

    // Allow by exact command (for stdio servers)
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem"] },
    { "serverCommand": ["python", "/usr/local/bin/approved-server.py"] },

    // Allow by URL pattern (for remote servers)
    { "serverUrl": "https://mcp.company.com/*" },
    { "serverUrl": "https://*.internal.corp/*" }
  ],
  "deniedMcpServers": [
    // Block by server name
    { "serverName": "dangerous-server" },

    // Block by exact command (for stdio servers)
    { "serverCommand": ["npx", "-y", "unapproved-package"] },

    // Block by URL pattern (for remote servers)
    { "serverUrl": "https://*.untrusted.com/*" }
  ]
}```How command-based restrictions work

**Exact matching**:

-   Command arrays must match **exactly** - both the command and all arguments in the correct order
-   Example:`["npx", "-y", "server"]`will NOT match`["npx", "server"]`or`["npx", "-y", "server", "--flag"]`**Stdio server behavior**:

-   When the allowlist contains **any**`serverCommand`entries, stdio servers **must** match one of those commands
-   Stdio servers cannot pass by name alone when command restrictions are present
-   This ensures administrators can enforce which commands are allowed to run

**Non-stdio server behavior**:

-   Remote servers (HTTP, SSE, WebSocket) use URL-based matching when`serverUrl`entries exist in the allowlist
-   If no URL entries exist, remote servers fall back to name-based matching
-   Command restrictions do not apply to remote servers


How URL-based restrictions work

URL patterns support wildcards using`*`to match any sequence of characters. This is useful for allowing entire domains or subdomains. **Wildcard examples**:

-`https://mcp.company.com/*`- Allow all paths on a specific domain
-`https://*.example.com/*`- Allow any subdomain of example.com
-`http://localhost:*/*`- Allow any port on localhost

**Remote server behavior**:

-   When the allowlist contains **any**`serverUrl`entries, remote servers **must** match one of those URL patterns
-   Remote servers cannot pass by name alone when URL restrictions are present
-   This ensures administrators can enforce which remote endpoints are allowed

Example: URL-only allowlist```{
  "allowedMcpServers": [
    { "serverUrl": "https://mcp.company.com/*" },
    { "serverUrl": "https://*.internal.corp/*" }
  ]
}```**Result**:

-   HTTP server at`https://mcp.company.com/api`: ✅ Allowed (matches URL pattern)
-   HTTP server at`https://api.internal.corp/mcp`: ✅ Allowed (matches wildcard subdomain)
-   HTTP server at`https://external.com/mcp`: ❌ Blocked (doesn’t match any URL pattern)
-   Stdio server with any command: ❌ Blocked (no name or command entries to match)

Example: Command-only allowlist```{
  "allowedMcpServers": [
    { "serverCommand": ["npx", "-y", "approved-package"] }
  ]
}```**Result**:

-   Stdio server with`["npx", "-y", "approved-package"]`: ✅ Allowed (matches command)
-   Stdio server with`["node", "server.js"]`: ❌ Blocked (doesn’t match command)
-   HTTP server named “my-api”: ❌ Blocked (no name entries to match)

Example: Mixed name and command allowlist```{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverCommand": ["npx", "-y", "approved-package"] }
  ]
}```**Result**:

-   Stdio server named “local-tool” with`["npx", "-y", "approved-package"]`: ✅ Allowed (matches command)
-   Stdio server named “local-tool” with`["node", "server.js"]`: ❌ Blocked (command entries exist but doesn’t match)
-   Stdio server named “github” with`["node", "server.js"]`: ❌ Blocked (stdio servers must match commands when command entries exist)
-   HTTP server named “github”: ✅ Allowed (matches name)
-   HTTP server named “other-api”: ❌ Blocked (name doesn’t match)

Example: Name-only allowlist```{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverName": "internal-tool" }
  ]
}```**Result**:

-   Stdio server named “github” with any command: ✅ Allowed (no command restrictions)
-   Stdio server named “internal-tool” with any command: ✅ Allowed (no command restrictions)
-   HTTP server named “github”: ✅ Allowed (matches name)
-   Any server named “other”: ❌ Blocked (name doesn’t match)


Allowlist behavior (`allowedMcpServers`)

-`undefined`(default): No restrictions - users can configure any MCP server
-   Empty array`[]`: Complete lockdown - users cannot configure any MCP servers
-   List of entries: Users can only configure servers that match by name, command, or URL pattern


Denylist behavior (`deniedMcpServers`)

-`undefined`(default): No servers are blocked
-   Empty array`[]`: No servers are blocked
-   List of entries: Specified servers are explicitly blocked across all scopes


Important notes

-   **Option 1 and Option 2 can be combined**: If`managed-mcp.json`exists, it has exclusive control and users cannot add servers. Allowlists/denylists still apply to the managed servers themselves.
-   **Denylist takes absolute precedence**: If a server matches a denylist entry (by name, command, or URL), it will be blocked even if it’s on the allowlist
-   Name-based, command-based, and URL-based restrictions work together: a server passes if it matches **either** a name entry, a command entry, or a URL pattern (unless blocked by denylist)

**When using`managed-mcp.json`**: Users cannot add MCP servers through`claude mcp add`or configuration files. The`allowedMcpServers`and`deniedMcpServers`settings still apply to filter which managed servers are actually loaded.

Was this page helpful?

[Programmatic usage](/docs/en/headless)[Troubleshooting](/docs/en/troubleshooting)

⌘I
