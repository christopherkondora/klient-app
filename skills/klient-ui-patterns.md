---
name: klient-ui-patterns
description: Use this skill when working on UI components - covers design system, component patterns, state management, Tailwind conventions, and how to add new views. Essential for any frontend development task.
---

# Klient UI Patterns & Design System

## Design Philosophy

Klient's UI is **dark-themed**, **minimal**, and **professional**. The design prioritizes:
- **Readability** - Clear typography, sufficient contrast
- **Efficiency** - Quick actions, keyboard shortcuts
- **Consistency** - Reusable components, predictable patterns
- **Hungarian UX** - All text in Hungarian, Hungarian date/number formats

---

## Color System

### Core Colors (Tailwind)

**Background:**
- `ink` - Dark blue-black (`#0f172a` + custom adjustment)
- `ink-light` - Slightly lighter background for cards

**Accent:**
- `teal` - Primary accent color (`#14b8a6`)
- `teal/10`, `teal/20` - Semi-transparent teal variants

**Text:**
- `cream` - Primary text color (light, high contrast)
- `ash` - Secondary text (slightly darker)
- `steel` - Muted text (even darker)

**Semantic:**
- `emerald-400`, `emerald-500` - Success states
- `red-400`, `red-500` - Error states
- `amber-400`, `amber-500` - Warning states

### Usage Guidelines

- **Backgrounds:** Use `bg-ink` for main areas, `bg-ink-light` for cards/panels
- **Buttons:** Primary actions use `bg-teal text-ink`, secondary use `bg-steel/20 text-cream`
- **Text:** Use `text-cream` for headings, `text-ash` for body, `text-steel` for hints
- **Borders:** Use `border-steel/20` for subtle borders, `border-teal` for focused elements
- **Hover States:** Add `hover:bg-teal/10` or `hover:bg-steel/30` for interactivity

---

## Typography

### Font

**Default:** System font stack (sans-serif)

**Sizes (Tailwind):**
- `text-xs` - 12px (hints, labels)
- `text-sm` - 14px (body text)
- `text-base` - 16px (default)
- `text-lg` - 18px (section headings)
- `text-xl` - 20px (page titles)
- `text-2xl`, `text-3xl` - Large headings

### Font Weights

- `font-normal` - 400 (default)
- `font-medium` - 500 (emphasis)
- `font-semibold` - 600 (headings)
- `font-bold` - 700 (strong emphasis)

---

## Layout Patterns

### Main Layout

**Component:** `src/components/Layout.tsx`

**Structure:**
```
┌──────────────────────────────────┐
│ TitleBar (custom title bar)     │  32px
├───────────┬──────────────────────┤
│           │                      │
│  Sidebar  │  Page Content        │
│  (fixed)  │  (scrollable)        │
│           │                      │
│           │                      │
└───────────┴──────────────────────┘
```

**Sidebar Width:** 64px (collapsed) or 240px (expanded)

**Content Area:** `flex-1` with padding

### Card Pattern

**Usage:** Clients, Projects, Notes

```tsx
<div className="bg-ink-light rounded-xl border border-steel/20 p-4 hover:border-steel/40 transition-colors">
  <h3 className="text-cream font-semibold mb-2">Card Title</h3>
  <p className="text-ash text-sm">Card content</p>
</div>
```

### Modal Pattern

**Usage:** Expenses, Invoices, Contracts

```tsx
<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
  <div className="bg-ink-light rounded-xl border border-teal/15 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold text-cream">Modal Title</h2>
      <button onClick={onClose} className="text-steel hover:text-cream">
        <X className="w-5 h-5" />
      </button>
    </div>
    {/* Modal content */}
  </div>
</div>
```

---

## Component Patterns

### Button

**Primary:**
```tsx
<button className="bg-teal text-ink px-4 py-2 rounded-lg font-medium hover:bg-teal/90 transition-colors disabled:opacity-50">
  Mentés
</button>
```

**Secondary:**
```tsx
<button className="bg-steel/20 text-cream px-4 py-2 rounded-lg font-medium hover:bg-steel/30 transition-colors">
  Mégse
</button>
```

**Danger:**
```tsx
<button className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors">
  Törlés
</button>
```

### Input

```tsx
<input
  type="text"
  className="w-full px-3 py-2 bg-ink border border-steel/30 rounded-lg text-cream placeholder-steel focus:outline-none focus:border-teal"
  placeholder="Keresés..."
/>
```

### Select

```tsx
<select className="w-full px-3 py-2 bg-ink border border-steel/30 rounded-lg text-cream focus:outline-none focus:border-teal">
  <option value="">Válassz...</option>
  <option value="1">Opció 1</option>
</select>
```

### Icon Button

```tsx
<button className="p-2 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors">
  <Plus className="w-5 h-5" />
</button>
```

### Badge

**Status:**
```tsx
<span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
  Aktív
</span>
```

**Priority:**
```tsx
<span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
  Sürgős
</span>
```

---

## State Management

### Global State (Zustand)

**Usage:** Rarely used, prefer React Context

**Location:** Not currently implemented (potential future use)

### React Context

**AuthContext** (`src/contexts/AuthContext.tsx`)
- Manages Supabase authentication
- Provides: `user`, `login()`, `logout()`, `signup()`, `loading`

**SubscriptionContext** (`src/contexts/SubscriptionContext.tsx`)
- Manages Stripe subscription state
- Provides: `subscription`, `isActive`, `openCheckout()`, `refresh()`, `celebratingPayment`

**ThemeContext** (`src/contexts/ThemeContext.tsx`)
- Manages dark/light theme toggle
- Provides: `theme`, `toggleTheme()`
- **Note:** Currently always dark, light theme not fully implemented

### Local State (useState)

**Pattern:**
```tsx
function MyComponent() {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await window.electron.getData();
      setData(result);
    } catch (err) {
      setError('Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Betöltés...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return <div>{/* Render data */}</div>;
}
```

---

## IPC Communication (Electron)

### Pattern

**Preload:** `electron/preload.ts` exposes `window.electron.*` methods

**Usage in React:**
```tsx
// Create client
const newClient = await window.electron.createClient({
  name: 'Teszt Kft.',
  email: 'test@example.com',
  phone: '+36 20 123 4567',
  company: 'Teszt Kft.',
  color: '#6366f1'
});

// Fetch all clients
const clients = await window.electron.getClients();

// Update client
await window.electron.updateClient(clientId, { name: 'Új név' });

// Delete client
await window.electron.deleteClient(clientId);
```

### Type Safety

**Type Definitions:** `src/vite-env.d.ts`

```typescript
interface Window {
  electron: {
    // Clients
    getClients: () => Promise<Client[]>;
    createClient: (client: Omit<Client, 'id'>) => Promise<Client>;
    updateClient: (id: string, client: Partial<Client>) => Promise<void>;
    deleteClient: (id: string) => Promise<void>;

    // Projects
    getProjects: () => Promise<Project[]>;
    createProject: (project: Omit<Project, 'id'>) => Promise<Project>;
    // ... etc
  };
}
```

---

## Adding a New Page

### Step-by-Step

1. **Create page component** in `src/pages/`
   ```tsx
   // src/pages/MyNewPage.tsx
   export default function MyNewPage() {
     return (
       <div className="p-6">
         <h1 className="text-2xl font-bold text-cream mb-4">
           Új oldal
         </h1>
       </div>
     );
   }
   ```

2. **Add route** in `src/App.tsx`
   ```tsx
   import MyNewPage from './pages/MyNewPage';

   // Inside <Routes>
   <Route path="/my-new-page" element={<MyNewPage />} />
   ```

3. **Add sidebar link** in `src/components/Sidebar.tsx`
   ```tsx
   <SidebarLink to="/my-new-page" icon={IconName} label="Új oldal" />
   ```

4. **Add IPC handlers** (if needed) in `electron/ipc.ts`
   ```typescript
   ipcMain.handle('my-new-data', async () => {
     // Query database
     const db = getDb();
     const result = db.exec('SELECT * FROM my_table');
     return result;
   });
   ```

5. **Add type definitions** in `src/vite-env.d.ts`
   ```typescript
   interface Window {
     electron: {
       myNewData: () => Promise<MyData[]>;
     };
   }
   ```

---

## Loading States

### Pattern

```tsx
{loading && (
  <div className="flex items-center justify-center p-8">
    <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
  </div>
)}
```

### Skeleton Loading (Recommended)

```tsx
<div className="bg-steel/10 h-4 rounded animate-pulse" />
```

---

## Error Handling

### Pattern

```tsx
{error && (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
    {error}
  </div>
)}
```

### Toast Notifications (Not Implemented)

**Recommendation:** Add toast library (e.g., react-hot-toast)

---

## Icons

**Library:** Lucide React

**Usage:**
```tsx
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';

<Plus className="w-5 h-5" />
```

**Common Icons:**
- `Plus` - Add new
- `Edit`, `Pencil` - Edit
- `Trash2` - Delete
- `Calendar` - Dates
- `Clock` - Time
- `FileText` - Documents
- `User`, `Users` - People
- `Settings` - Settings
- `X` - Close
- `ChevronDown`, `ChevronRight` - Expand/collapse

---

## Animations

### Tailwind Transitions

**Standard:**
```tsx
className="transition-colors duration-200"
```

**Hover:**
```tsx
className="hover:bg-teal/10 transition-colors"
```

**Scale:**
```tsx
className="hover:scale-105 transition-transform"
```

### Celebration Animation

**Component:** `Paywall.tsx` (lines 312-343)

**Usage:** Confetti particles + glow effect on payment success

---

## Rich Text Editor (Tiptap)

**Component:** `src/components/NotesPanel.tsx`

**Features:**
- Bold, italic, underline
- Headings (H1, H2, H3)
- Bullet lists, numbered lists
- Task lists (checkboxes)
- Links
- Images
- Text alignment
- Highlights
- Placeholder text

**Usage:**
```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const editor = useEditor({
  extensions: [StarterKit],
  content: '<p>Initial content</p>',
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    // Save HTML
  },
});

return <EditorContent editor={editor} />;
```

---

## Date & Time Formatting

### Hungarian Format

**Date:** `2026. 03. 28.` (YYYY. MM. DD. format)

**Time:** `14:30` (24-hour format)

**Library:** date-fns 4.1

**Usage:**
```tsx
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

const formattedDate = format(new Date(), 'yyyy. MM. dd.', { locale: hu });
const formattedTime = format(new Date(), 'HH:mm');
```

---

## Responsive Design

**Current:** Desktop-only (no mobile responsiveness)

**Breakpoints (if needed):**
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

**Pattern:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

---

## Accessibility

**Current State:** Basic accessibility (keyboard navigation, semantic HTML)

**Improvements Needed:**
- ARIA labels for icon-only buttons
- Focus visible states (outline-none should be replaced with custom focus rings)
- Screen reader announcements for dynamic content

**Pattern:**
```tsx
<button
  className="..."
  aria-label="Új projekt hozzáadása"
>
  <Plus className="w-5 h-5" />
</button>
```

---

## Performance Optimization

### Memoization

**Use `useMemo` for expensive computations:**
```tsx
const filteredProjects = useMemo(() => {
  return projects.filter(p => p.status === 'active');
}, [projects]);
```

**Use `useCallback` for event handlers passed as props:**
```tsx
const handleDelete = useCallback((id: string) => {
  deleteProject(id);
}, [deleteProject]);
```

### Lazy Loading

**Pattern:**
```tsx
const LazyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<div>Betöltés...</div>}>
  <LazyComponent />
</Suspense>
```

---

## Common Pitfalls

1. **Forgetting to call `saveDb()`** - Always save database after modifications in Electron IPC handlers
2. **Not handling IPC errors** - Always wrap IPC calls in try-catch
3. **Inline functions in render** - Use `useCallback` to avoid re-renders
4. **Missing keys in lists** - Always add `key` prop to list items
5. **Direct state mutation** - Use `setState` or immutable updates, never mutate state directly

---

## Code Style

### Naming Conventions

- **Components:** PascalCase (`ClientDetail.tsx`)
- **Functions:** camelCase (`handleDelete()`)
- **Constants:** UPPER_SNAKE_CASE (`PRICE_IDS`)
- **Types:** PascalCase (`interface Client {}`)

### File Organization

**Component file structure:**
```tsx
// 1. Imports
import { useState } from 'react';
import { Plus } from 'lucide-react';

// 2. Types
interface Props {
  title: string;
}

// 3. Component
export default function MyComponent({ title }: Props) {
  // 4. State
  const [data, setData] = useState([]);

  // 5. Effects
  useEffect(() => {
    loadData();
  }, []);

  // 6. Handlers
  const handleClick = () => {
    // ...
  };

  // 7. Render
  return <div>...</div>;
}
```

---

## Quick Reference

**Color Classes:**
- `bg-ink` - Dark background
- `bg-teal` - Primary accent
- `text-cream` - Light text
- `border-steel/20` - Subtle border

**Buttons:**
- Primary: `bg-teal text-ink`
- Secondary: `bg-steel/20 text-cream`
- Danger: `bg-red-500 text-white`

**Spacing:**
- Small: `p-2` (8px)
- Medium: `p-4` (16px)
- Large: `p-6` (24px)

**Rounded Corners:**
- Small: `rounded-lg` (8px)
- Medium: `rounded-xl` (12px)
- Large: `rounded-2xl` (16px)
