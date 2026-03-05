# Stratege — Design System

## Architecture

Production : static HTML/CSS/JS multi-page (Cloudflare Pages)
Staging : React SPA (Mantine + Tailwind + Shadcn/ui) — reference visuelle

## Couleurs

### Primary (Teal)
| Token | Hex | Usage |
|-------|-----|-------|
| `--primary-50` | `#EBF8F5` | Backgrounds légers, badges soft |
| `--primary-100` | `#C8EDE8` | Hover states légers |
| `--primary-200` | `#9EDCD5` | Borders soft |
| `--primary-300` | `#4ECDC4` | **Couleur principale action** |
| `--primary-400` | `#35B8AF` | Hover sur primary |
| `--primary-500` | `#26A09A` | Active/pressed state |
| `--primary-600` | `#1A857F` | Texte sur fond clair |
| `--primary-700` | `#136B66` | Dark accent |
| `--primary-800` | `#0D524E` | Very dark teal |
| `--primary-900` | `#083A37` | Near-black teal |

### Secondary (Navy / Bleu-gris)
| Token | Hex | Usage |
|-------|-----|-------|
| `--secondary-500` | `#4D6E82` | Texte secondaire |
| `--secondary-600` | `#3D5A70` | Texte moyen |
| `--secondary-700` | `#2E4558` | Headings secondaires |
| `--secondary-800` | `#1F3040` | **Navy principal** (dark BG, navbar text) |
| `--secondary-900` | `#152330` | Extra dark |

### Neutral (gris)
| Token | Hex | Usage |
|-------|-----|-------|
| `--neutral-50` | `#F8F9FA` | Page background |
| `--neutral-100` | `#F1F3F5` | Card backgrounds, surface-2 |
| `--neutral-200` | `#E9ECEF` | Borders |
| `--neutral-300` | `#DEE2E6` | Disabled borders |
| `--neutral-400` | `#CED4DA` | Placeholder text |
| `--neutral-500` | `#ADB5BD` | Secondary text |
| `--neutral-600` | `#868E96` | Helper text |
| `--neutral-700` | `#495057` | Body text |
| `--neutral-800` | `#1B2A4A` | **Primary text / dark backgrounds** |

### Status
| Token | Hex | Usage |
|-------|-----|-------|
| `--success-500` | `#3DB87A` | Success states |
| `--warning-500` | `#F5A623` | Warnings |
| `--error-500` | `#E8445A` | Errors |

### Aliases semantiques
```css
--color-navy:   var(--neutral-800);    /* #1B2A4A */
--color-teal:   var(--primary-300);    /* #4ECDC4 */
--color-bg:     var(--neutral-50);     /* #F8F9FA */
--color-surface: #FFFFFF;
--color-text:   var(--neutral-800);
--color-text-secondary: var(--neutral-500);
--color-border: var(--neutral-200);
```

## Typographie

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display | Playfair Display | 400, 600, 700 | h1-h4, hero, titres de section |
| Body | Inter | 300, 400, 500, 600 | Texte courant, labels, buttons |
| Mono | JetBrains Mono | 400, 500 | Prix, pourcentages, codes |

### Tailles desktop
| Element | Size | Line-height |
|---------|------|-------------|
| h1 | 40px | 48px |
| h2 | 36px | 44px |
| h3 | 32px | 40px |
| h4 | 28px | 36px |
| h5 | 24px | 32px |
| h6 | 20px | 28px |
| body | 15px | 1.6 |

### Tailles mobile (max-width: 768px)
| Element | Size | Line-height |
|---------|------|-------------|
| h1 | 36px | 44px |
| h2 | 32px | 40px |
| h3 | 28px | 36px |
| h4 | 24px | 32px |

## Espacements

Systeme base 4px :
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px
- `--space-16`: 64px
- `--space-20`: 80px

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Petits elements |
| `--radius-sm` | 8px | Inputs, badges |
| `--radius-md` | 12px | Cards internes |
| `--radius-lg` | 16px | Cards |
| `--radius-xl` | 24px | Modales, grandes cards |
| `--radius-pill` | 50px | Buttons, badges |
| `--radius-full` | 999px | Avatars, dots |

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(27,42,74,0.06)` | Cards au repos |
| `--shadow-md` | `0 4px 12px rgba(27,42,74,0.08)` | Cards hover |
| `--shadow-lg` | `0 8px 24px rgba(27,42,74,0.1)` | Modales |
| `--shadow-xl` | `0 16px 48px rgba(27,42,74,0.12)` | Grands overlays |
| `--shadow-teal` | `0 8px 32px rgba(78,205,196,0.3)` | CTA primary hover |

## Composants

### Buttons
3 variants x 3 tailles :
- **Primary** : fond teal, texte blanc, shadow-teal on hover
- **Secondary/Outline** : bordure teal, fond transparent
- **Ghost** : texte navy, fond transparent
- Tailles : sm (8px 16px), md (12px 24px), lg (16px 32px)
- Tous : `border-radius: var(--radius-pill)`

### Badges
Pill shape, 12px font, 5 couleurs :
- primary (teal), secondary (navy), success, warning, error
- Variant soft : fond clair + bordure + texte fonce

### Inputs
- Border 1.5px solid neutral-200
- Focus : teal border + ring 3px rgba(78,205,196,0.15)
- Error : red border
- Helper text : 12px neutral-500
- Input suffix : positioned absolute right

### Cards
- fond blanc, border neutral-200, radius-xl, shadow-sm
- hover : translateY(-2px) + shadow-md
- featured : border primary-200 + shadow-teal

### Alerts
4 types avec fond semi-transparent :
- success (vert), warning (orange), error (rouge), info (teal)

### Progress Steps
- Cercle 32px avec numero
- Etats : pending (border gris), active (border teal), done (fond teal, check blanc)
- Connecteur ligne 2px entre etapes

### Avatars
- Circle, 3 tailles : sm (32px), md (40px), lg (56px)
- 3 variants : photo, initiales, icone
- Status indicator (dot vert)

### Modales
- Overlay : fond noir 50% + blur 4px
- Box : blanc, radius-xl, padding 40px, shadow-xl, max-height 90vh scroll

## Breakpoints

| Point | Value | Cible |
|-------|-------|-------|
| Desktop | > 1024px | Layout complet |
| Tablet | <= 1024px | Grilles 2 cols, sidebar cachee |
| Mobile | <= 768px | Single column, nav hamburger |
| Small mobile | <= 480px | Padding reduit |

## Animations

| Nom | Effet | Usage |
|-----|-------|-------|
| `fadeUp` | opacity 0→1 + translateY(20px→0) | Sections au scroll |
| `spin` | rotate 360deg | Loader |
| `pulse-ring` | scale + opacity | Notification |

Trigger : IntersectionObserver a 0.1 threshold, classe `.visible`

## Logo Stratege

SVG inline : etoile 4 branches
- Corps : `#2D3A52` (navy)
- Accents : `#4ECDC4` (teal) + `#95E8DF` (teal clair)
- Accompagne du texte "Stratege" en font-display 700

## Icones

Pas de librairie externe. Utilise :
- Emoji Unicode (📊 🏠 📄 etc.) pour sidebar/sections
- SVG inline pour logo, lock, social media
- Aucun FontAwesome / Material Icons
