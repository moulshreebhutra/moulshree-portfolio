# Moulshree Bhutra · Portfolio

Personal portfolio of Moulshree Bhutra, Product Manager (Founding APM at Vudio.ai), based in Bengaluru.

**Live:** https://moulshree-portfolio.vercel.app

## What is in here

A single static page, no build step and no dependencies. The two concept projects are full apps in `apps/` that deploy separately.

- `index.html`: the whole site (HTML, CSS and a little JavaScript)
- `logos/`: company, school and profile images used on the page
- `apps/rationale`: turn customer feedback into what to build next (Next.js, own Vercel project, live at https://moulshree-rationale.vercel.app)
- `apps/shelfmate`: a skincare routine builder with a shopper and a merchant view (Next.js, own Vercel project, live at https://moulshree-shelfmate.vercel.app)

## Theme

One colour theme, **lavender**. The site always opens in light mode; the sun/moon button switches to dark, and the choice is remembered.

## Run it locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Deployment

Hosted on Vercel and connected to this repository. Every push to `main` deploys automatically.
It is a plain static site, so no framework or build command is needed.

## Analytics

Visitor counts use Vercel Web Analytics. The two-line snippet right after the `</style>` tag in `index.html` loads `/_vercel/insights/script.js`, which Vercel serves once Analytics is enabled for the project (Project → Analytics → Enable). Results appear in the Analytics tab of the Vercel project. The `@vercel/analytics` npm package is not used because this site has no build step.
