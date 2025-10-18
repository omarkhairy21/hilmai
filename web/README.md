# Wait - Astro Waitlist Landing Page

A modern, production-ready waitlist landing page built with Astro and Cloudflare Pages. Inspired by Framer's design aesthetic.

## 🚀 Features

- **Hero Section** with email capture and countdown timer
- **How It Works** video section with custom player
- **Features Grid** showcasing product capabilities
- **FAQ Accordion** with smooth animations
- **Content Collections** for blog posts and pages
- **Tailwind CSS v4** for styling
- **Cloudflare Pages** ready for deployment

## 📦 Project Structure

```
astro-site/
├── src/
│   ├── components/       # Reusable components
│   │   ├── Hero.astro
│   │   ├── HowItWorks.astro
│   │   ├── Features.astro
│   │   ├── FAQ.astro
│   │   └── Footer.astro
│   ├── content/          # Content collections
│   │   ├── blog/         # Blog posts (Markdown)
│   │   └── pages/        # Static pages (Markdown)
│   ├── layouts/
│   │   └── Layout.astro  # Base layout
│   ├── pages/
│   │   ├── index.astro   # Homepage
│   │   └── blog/         # Blog routes
│   └── styles/
│       └── global.css    # Global styles + Tailwind
└── public/               # Static assets
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server (localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deployment to Cloudflare Pages

### Option 1: Wrangler CLI

```bash
# Build
npm run build

# Deploy (configure wrangler.toml first)
npx wrangler pages deploy dist
```

### Option 2: Cloudflare Dashboard

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set build output directory: `dist`
4. Deploy!

## 🎨 Customization

### Colors

Edit the theme in `src/styles/global.css`:

```css
@theme {
  --color-lime: #d4ff2a;  /* Primary brand color */
}
```

### Content

- **Hero**: Edit `src/components/Hero.astro`
- **Features**: Modify features array in `src/components/Features.astro`
- **FAQ**: Update questions in `src/components/FAQ.astro`
- **Blog**: Add markdown files to `src/content/blog/`

### Countdown Timer

Set your target date in `src/components/Hero.astro`:

```javascript
const targetDate = new Date('2025-06-01T00:00:00').getTime();
```

## 📝 Content Management

### Adding Blog Posts

Create a new markdown file in `src/content/blog/`:

```markdown
---
title: "Your Post Title"
description: "Post description"
pubDate: 2025-01-15
author: "Your Name"
tags: ["tag1", "tag2"]
---

Your content here...
```

### Adding Pages

Create markdown files in `src/content/pages/` for additional static pages.

## 🔧 Configuration

- **Astro Config**: `astro.config.mjs`
- **TypeScript**: `tsconfig.json`
- **Tailwind**: Configured via `@tailwindcss/vite` plugin

## 📚 Tech Stack

- [Astro](https://astro.build) - Static site framework
- [Tailwind CSS v4](https://tailwindcss.com) - Styling
- [Cloudflare Pages](https://pages.cloudflare.com) - Hosting & Edge functions
- TypeScript - Type safety

## 🎯 Next Steps

1. **Connect Backend**: Add API endpoint for email collection
2. **Analytics**: Integrate Cloudflare Analytics or your preferred tool
3. **Email Service**: Connect to your email provider (SendGrid, Resend, etc.)
4. **Custom Domain**: Configure in Cloudflare Pages settings
5. **SEO**: Add meta tags, Open Graph images, sitemap

## 📄 License

MIT
