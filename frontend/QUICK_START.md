# Quick Start Guide - NexusRAG UI

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Environment variables (see .env.example)

### Installation
```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000 to see the app.

## 📁 Project Structure

```
src/
├── app/                 # Next.js pages and routing
├── components/          # Reusable React components
├── lib/                 # Utility functions and configurations
├── store/               # Zustand state management
└── types/              # TypeScript type definitions
```

## 🎨 Using Components

### Import UI Components
```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge-enhanced";
```

### Layout Components
```tsx
import { MainLayout } from "@/components/layout/main-layout";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header-enhanced";
```

### Chat & Document Components
```tsx
import { ChatInterface } from "@/components/chat/chat-interface-enhanced";
import { ContextPanel } from "@/components/chat/context-panel";
import { DocumentLibrary } from "@/components/documents/document-library";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
```

## 🎯 Common Patterns

### Creating a Page with Layout
```tsx
"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { Header } from "@/components/layout/header-enhanced";

export default function MyPage() {
  return (
    <MainLayout>
      <Header />
      <main className="flex-1 overflow-auto p-6">
        {/* Your content */}
      </main>
    </MainLayout>
  );
}
```

### Using State Management
```tsx
import { useAppStore } from "@/store";

export function MyComponent() {
  const { documents, addDocument } = useAppStore();
  
  return (
    // Use store values and actions
  );
}
```

### Responsive Grid
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => (
    <Card key={item.id}>
      {/* card content */}
    </Card>
  ))}
</div>
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-16">
  <Icon className="w-12 h-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold text-foreground mb-2">
    No items
  </h3>
  <p className="text-muted-foreground mb-6">
    Description
  </p>
  <Button>Action</Button>
</div>
```

## 🎨 Styling

### Using Tailwind Classes
```tsx
// Colors
className="text-foreground bg-background"
className="text-primary text-muted-foreground"

// Spacing
className="p-4 mb-6 gap-3"

// Responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"

// Transitions
className="transition-all hover:shadow-lg"
```

### Dark Mode
Dark mode is applied by default. Use `dark:` prefix only for exceptions:
```tsx
<div className="bg-white dark:bg-card">
  Content
</div>
```

## 📋 Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/globals.css` | Design tokens & theme |
| `src/types/index.ts` | TypeScript interfaces |
| `src/store/index.ts` | Zustand state store |
| `src/lib/api.ts` | API client |
| `UI_ARCHITECTURE.md` | Full documentation |
| `DESIGN_SYSTEM.md` | Styling guide |

## 🔧 Development Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code (if prettier is installed)
npm run format
```

## 📝 Component Examples

### Button
```tsx
<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button size="sm">Small</Button>
<Button className="gap-2">
  <Icon className="w-4 h-4" />
  With Icon
</Button>
```

### Badge
```tsx
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="processing">Processing</Badge>
```

### Input
```tsx
<Input placeholder="Enter text..." />
<Input type="email" />
<Input disabled value="Disabled" />
<Input className="bg-muted/50" />
```

### Card
```tsx
<Card>
  <div className="p-6">
    <h3 className="font-semibold">Title</h3>
    <p className="text-sm text-muted-foreground">Description</p>
  </div>
</Card>
```

## 🎯 Common Tasks

### Add a New Page
1. Create folder in `src/app/(dashboard)/`
2. Create `page.tsx` file
3. Use `MainLayout` for consistency
4. Import components and build UI

### Add a New Component
1. Create file in `src/components/`
2. Use TypeScript for props
3. Export component and any types
4. Add to component library docs

### Style a Component
1. Use Tailwind classes for layout
2. Use design tokens for colors/spacing
3. Add dark mode support with `dark:` prefix
4. Add transitions for interactivity

### Add State
1. Update store in `src/store/index.ts`
2. Use `useAppStore` hook to access
3. Update types if needed in `src/types/index.ts`

## 🐛 Debugging

### Check Console Errors
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for API calls

### Enable Dark Mode
Dark mode is default. Toggle in browser:
```tsx
// Force dark mode
<html className="dark">

// Force light mode  
<html className="light">
```

### Debug Styles
Use Tailwind's class name inspection:
```tsx
// Check what classes are applied
<div className="p-4 md:p-6 lg:p-8">
  {/* Inspect to see applied styles */}
</div>
```

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Lucide Icons](https://lucide.dev)

## 🤝 Contributing

1. Follow the component structure
2. Use TypeScript for type safety
3. Follow design system guidelines
4. Test responsive design
5. Check accessibility

## 📞 Support

For questions about:
- **UI Architecture**: See `UI_ARCHITECTURE.md`
- **Styling**: See `DESIGN_SYSTEM.md`
- **Components**: Check `src/components/`
- **State**: Check `src/store/index.ts`

## 🎯 Next Features to Implement

- [ ] Real API integration
- [ ] Authentication complete
- [ ] Document upload processing
- [ ] Chat history persistence
- [ ] Advanced search
- [ ] User preferences
- [ ] Notifications
- [ ] Collaboration features

---

**Last Updated**: June 15, 2024
**Version**: 1.0.0
