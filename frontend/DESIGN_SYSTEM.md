# NexusRAG Design System & Styling Guide

## Design Tokens

### Color Palette

#### Light Mode (Fallback)
- **Background**: `oklch(0.995 0.001 80)` - Pure white
- **Foreground**: `oklch(0.15 0.01 260)` - Deep dark blue
- **Primary**: `oklch(0.50 0.17 255)` - Vibrant blue
- **Muted**: `oklch(0.96 0.002 80)` - Light gray

#### Dark Mode (Primary)
- **Background**: `oklch(0.135 0.008 260)` - Deep dark blue
- **Foreground**: `oklch(0.92 0.004 80)` - Off-white
- **Primary**: `oklch(0.68 0.16 255)` - Bright blue
- **Card**: `oklch(0.16 0.010 260)` - Slightly lighter dark
- **Muted**: `oklch(0.19 0.010 260)` - Dark gray
- **Border**: `oklch(1 0 0 / 7%)` - Subtle white with transparency

### Typography

```css
/* Font Families */
--font-sans: var(--font-geist-sans);     /* Body text */
--font-mono: var(--font-geist-mono);     /* Code blocks */
--font-heading: var(--font-sans);        /* Headings */
```

**Font Scale:**
- h1: 2.25rem (36px) - Page titles
- h2: 1.875rem (30px) - Section headers
- h3: 1.5rem (24px) - Subsections
- h4: 1.25rem (20px) - Card titles
- body: 1rem (16px) - Default text
- sm: 0.875rem (14px) - Secondary text
- xs: 0.75rem (12px) - Tertiary/labels
- mono: 0.875rem (14px) - Code

### Spacing

```css
--spacing: 4px (base unit)
--radius: 12px
--radius-sm: 7.2px   (60% of base)
--radius-md: 9.6px   (80% of base)
--radius-lg: 12px    (100% of base - default)
--radius-xl: 16.8px  (140% of base)
--radius-2xl: 21.6px (180% of base)
--radius-3xl: 26.4px (220% of base)
--radius-4xl: 31.2px (260% of base)
```

**Gap & Padding Scale:**
- xs: 2px
- sm: 4px
- base: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px

## Component Styles

### Buttons

```tsx
// Primary (Call-to-action)
<Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
  Action
</Button>

// Secondary (Default)
<Button variant="outline" className="border-border/50">
  Secondary
</Button>

// Ghost (Minimal)
<Button variant="ghost">
  Minimal
</Button>
```

### Cards

```tsx
// Default card
<Card className="p-6 space-y-4">
  {/* content */}
</Card>

// Elevated card (with shadow)
<div className="surface-elevated">
  {/* content */}
</div>
```

### Badges

```tsx
// Status badges
<Badge variant="success">Indexed</Badge>
<Badge variant="processing">Processing</Badge>
<Badge variant="warning">Failed</Badge>

// Custom badges
<Badge variant="outline">Count</Badge>
```

### Text Styles

```tsx
// Headings
<h1 className="text-3xl font-bold text-foreground">Page Title</h1>
<h2 className="text-xl font-bold text-foreground">Section</h2>
<h3 className="text-lg font-semibold text-foreground">Subsection</h3>

// Body text
<p className="text-foreground">Regular text</p>
<p className="text-sm text-muted-foreground">Secondary text</p>
<p className="text-xs text-muted-foreground">Tertiary text</p>

// Code
<code className="bg-muted px-2 py-1 rounded text-xs font-mono">
  code snippet
</code>
```

### Input Fields

```tsx
// Standard input
<Input 
  className="bg-card border-border/50"
  placeholder="Placeholder text"
/>

// Muted input (for secondary info)
<Input 
  className="bg-muted/50 border-border/50"
  disabled
/>
```

### Icons

Use Lucide Icons consistently:

```tsx
import { Plus, Settings, Bell, ChevronDown } from "lucide-react";

// Icon sizes
<Plus className="w-4 h-4" />      // Small (buttons, badges)
<Settings className="w-5 h-5" />  // Regular (default)
<Bell className="w-6 h-6" />      // Large (headers)

// Icon colors
<Plus className="text-primary" />
<Settings className="text-muted-foreground" />
<Bell className="text-destructive" />
```

## Animation & Transitions

### Hover Effects

```css
/* Smooth transitions */
transition: all 0.15s ease

/* Interactive surfaces */
@utility surface-interactive {
  transition: all 0.15s ease;
  &:hover {
    box-shadow: 0 2px 8px oklch(0 0 0 / 30%);
  }
}
```

### Loading States

```tsx
// Skeleton loader
<div className="animate-pulse bg-muted rounded h-8 w-32" />

// Bounce animation (for status)
<div className="animate-bounce" style={{ animationDelay: "0s" }} />
<div className="animate-bounce" style={{ animationDelay: "0.2s" }} />
<div className="animate-bounce" style={{ animationDelay: "0.4s" }} />
```

## Layout Patterns

### Container
```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* content */}
</div>
```

### Grid Layouts
```tsx
// Responsive card grid
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* cards */}
</div>

// Settings layout
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  {/* sidebar + content */}
</div>
```

### Flex Layouts
```tsx
// Between items
<div className="flex items-center justify-between">
  {/* left */ {/* right */}
</div>

// Centered
<div className="flex items-center justify-center">
  {/* content */}
</div>

// Stack with gap
<div className="flex items-center gap-3">
  {/* items */}
</div>
```

## Responsive Breakpoints

```css
sm: 640px   (mobile)
md: 768px   (tablet)
lg: 1024px  (desktop)
xl: 1280px  (large desktop)
2xl: 1536px (extra large)
```

### Mobile-First Examples

```tsx
// Hidden on mobile, visible on tablet+
<div className="hidden md:block">
  {/* sidebar */}
</div>

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl">
  Responsive Heading
</h1>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* items */}
</div>

// Responsive padding
<div className="px-4 md:px-6 lg:px-8">
  {/* content */}
</div>
```

## Accessibility Guidelines

### Color Contrast
- Text on background: min 4.5:1 ratio
- UI components: min 3:1 ratio
- Large text (18pt+): min 3:1 ratio

### Focus States
```tsx
// All interactive elements need focus state
className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
```

### ARIA Labels
```tsx
<Button aria-label="Close dialog">
  <X />
</Button>

<nav aria-label="Main navigation">
  {/* nav items */}
</nav>
```

### Semantic HTML
```tsx
// Use semantic elements
<button>   {/* interactive */}
<a href=""> {/* navigation */}
<h1>       {/* headings */}
<section>  {/* sections */}
<article>  {/* content */}
<nav>      {/* navigation */}
```

## Dark Mode

All components are dark-mode first. Use `dark:` prefix only when needed:

```tsx
// Usually not needed - inherits from theme
<div className="bg-background text-foreground">
  {/* automatically respects dark mode */}
</div>

// Only use dark: for exceptions
<div className="bg-white dark:bg-card">
  {/* specific dark mode override */}
</div>
```

## Common Patterns

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-16">
  <Icon className="w-12 h-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold text-foreground mb-2">
    Title
  </h3>
  <p className="text-muted-foreground mb-6 max-w-xs">
    Description
  </p>
  <Button>Action</Button>
</div>
```

### Loading State
```tsx
{loading ? (
  <Skeleton className="h-64 w-full" />
) : (
  {/* content */}
)}
```

### Error State
```tsx
<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
  <p className="text-sm text-destructive font-medium">
    Error message
  </p>
</div>
```

### Dropdown Menu
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost">Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Option 1</DropdownMenuItem>
    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Best Practices

1. **Consistency**: Use the design tokens, don't hardcode colors
2. **Spacing**: Always use consistent spacing scale
3. **Typography**: Follow the font scale hierarchy
4. **Responsive**: Test on mobile, tablet, and desktop
5. **Accessibility**: Include focus states and ARIA labels
6. **Performance**: Minimize animations on lower-end devices
7. **Dark Mode**: Design for dark mode first
8. **Testing**: Verify color contrast and keyboard navigation

## Tools & Resources

- **Colors**: [OKLCH Color Picker](https://oklch.com)
- **Icons**: [Lucide Icons](https://lucide.dev)
- **Fonts**: [Geist Font](https://vercel.com/font)
- **Shadows**: Tailwind CSS shadow utilities
- **Animation**: Tailwind CSS animation utilities

## Future Updates

- [ ] Custom animation library
- [ ] Component storybook
- [ ] Design tokens package
- [ ] Figma design file
- [ ] Accessibility audit
