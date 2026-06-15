# NexusRAG Frontend - Production UI Design

## Overview

This is a modern, production-quality UI for NexusRAG, inspired by NotebookLM's clean and minimal design philosophy. The interface is built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, and Lucide Icons.

## Architecture

### Design System

- **Theme**: Dark-first design with light mode support via `next-themes`
- **Colors**: NotebookLM-inspired deep dark palette with primary blue accents
- **Typography**: Geist font family for modern, clean appearance
- **Spacing**: Consistent 12-16px border radius with generous whitespace
- **Shadows**: Soft, subtle shadows for elevation

### Component Structure

```
components/
├── layout/
│   ├── sidebar.tsx                # Main navigation sidebar
│   ├── main-layout.tsx            # Root layout wrapper
│   └── header-enhanced.tsx        # Top header with workspace info
├── chat/
│   ├── chat-interface-enhanced.tsx # Chat messages & input
│   └── context-panel.tsx          # Selected documents context
├── documents/
│   ├── document-card.tsx          # Individual document card
│   ├── document-library.tsx       # Document grid/list view
│   └── file-upload-zone.tsx       # Drag-drop file upload
├── ui/
│   ├── badge-enhanced.tsx         # Enhanced badge component
│   ├── skeleton.tsx               # Loading skeletons
│   └── [other shadcn components]
└── providers/
    └── theme-provider.tsx         # Next.js theme provider
```

### Pages

```
app/
├── (dashboard)/
│   ├── dashboard/page.tsx         # Dashboard overview
│   ├── workspace/[workspaceId]/page.tsx  # Workspace main page
│   └── settings/page.tsx          # Settings page
├── (auth)/
│   ├── login/page.tsx
│   └── auth/callback/route.ts
└── layout.tsx                     # Root layout with theme
```

## Features

### Dashboard Page

- **Stats Cards**: Workspaces count, total documents, storage usage, recent chats
- **Workspace Grid**: Cards with workspace info, document count, creation date
- **Quick Actions**: Gradient banner with CTA to first workspace
- **Empty States**: Guidance when no workspaces exist

### Workspace Page

Two-mode interface:

1. **Chat Mode** (Default)
   - Large chat interface with welcome empty state
   - Suggested prompts for new conversations
   - Message bubbles with AI and user distinctions
   - Markdown rendering support
   - Citations with confidence scores
   - Message actions (copy, like, share)
   - Real-time typing indicators
   - Context panel showing selected documents

2. **Document Mode**
   - Document library grid/list view
   - Filter by status (Processing, Indexed, Failed)
   - Sort by date, name, or size
   - Bulk selection and operations
   - File status badges
   - Quick upload from library view

### Context Panel

- Shows selected documents for current chat
- Statistics: total chunks, embedding status
- Document removal buttons
- Recent activity timeline
- Configuration options

### Sidebar Navigation

- **Collapsible**: Toggle between full and icon-only modes
- **Workspace Switcher**: Quick access to all workspaces
- **Create Workspace**: Primary CTA
- **User Profile**: Account dropdown with logout
- **Settings Link**: Access to settings page
- **Responsive**: Adapts to mobile

### Settings Page

Comprehensive settings with tabs:

1. **Profile**: Name, email, bio
2. **Preferences**: Theme (light/dark/system), notifications
3. **Security**: Password, 2FA, active sessions
4. **API Keys**: Generate and manage API keys
5. **LLM Settings**: Model selection, temperature, max tokens

## Key Components

### DocumentCard
- File icon based on type
- Filename with hover effects
- File metadata (size, chunks, date)
- Status badge with icon
- Hover actions (download, more menu)
- Selection checkbox

### DocumentLibrary
- Grid or list view toggle
- Filtering and sorting controls
- Bulk selection
- Empty states
- Responsive grid (1-4 columns)

### ChatInterface
- Message bubbles (user/assistant)
- Markdown rendering
- Citation display with confidence scores
- Suggested prompts
- Loading indicators
- Empty state with prompts
- Document selector dropdown

### ContextPanel
- Collapsible sections
- Document list with removal
- Embedding status indicators
- Chunk count statistics
- Recent activity timeline
- Settings link

## Design Patterns

### Empty States
- Descriptive icon
- Headline
- Supporting text
- Primary CTA

### Loading States
- Skeleton loaders for each component
- Pulse animations
- Gradual content reveal

### Animations
- Smooth transitions (150ms)
- Hover effects on interactive elements
- Staggered animations for lists
- Loading spinners with bounce

### Responsive Design
- Mobile: Single column, collapsed sidebar
- Tablet: Two columns, visible sidebar
- Desktop: Full layout with context panel
- Touch-friendly hit targets (min 44px)

## Tailwind Configuration

Extended with:
- Custom color palette (OKLCH format)
- Rounded corner utilities
- Animation utilities
- Custom utilities for surfaces

## State Management

Uses Zustand store (`useAppStore`) for:
- Workspaces
- Documents
- Selected documents
- Chat messages
- UI loading states

## Accessibility

- Semantic HTML
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators
- Color contrast compliance
- Screen reader support

## Performance

- Image optimization
- Code splitting by route
- Lazy loading components
- Optimistic UI updates
- Efficient re-renders with proper memoization

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Environment Setup

```bash
npm install
npm run dev
```

Environment variables needed:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Theme Customization

Edit `src/app/globals.css` to modify:
- Color scheme (OKLCH values)
- Typography
- Spacing scale
- Animation timings

## Future Enhancements

- [ ] Real-time collaboration
- [ ] Advanced analytics
- [ ] Custom theming
- [ ] Keyboard shortcuts guide
- [ ] Command palette (Cmd+K)
- [ ] Advanced RAG configuration
- [ ] Conversation templates
- [ ] Workspace templates
