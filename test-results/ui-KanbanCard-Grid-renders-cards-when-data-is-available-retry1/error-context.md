# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5] [cursor=pointer]:
    - generic [ref=e6]:
      - img [ref=e8]
      - generic [ref=e16]: Healthy
    - heading "Add \"Add Today\" quick action button in header" [level=3] [ref=e17]
    - paragraph [ref=e18]: "## Description Add a quick action button in the header area that allows users to log or edit today's activity without having to find today's square in the contribution grid. This improves UX by reducing friction for the most common use case. ## Requirements - **Location:** Header area (near year selector/dark mode toggle) - **Behavior:** Opens the existing ActivityModal with today's date pre-filled - **Dynamic text:** - Show \"Add Today\" if no activity exists for today - Show \"Edit Today\" if an activity is already logged for today - **Styling:** Left to implementer's discretion ## Technical Notes - Reuse the existing `ActivityModal` component - Check if today's date exists in the activity data to determine button text - Button should be consistent with the existing UI design ## Affected Files - `frontend/src/App.tsx` - Add button to header - `frontend/src/hooks/useActivityData.ts` - May need helper to check if today has activity"
  - generic [ref=e19] [cursor=pointer]:
    - generic [ref=e20]:
      - img [ref=e22]
      - generic [ref=e30]: Healthy
    - heading "Add dot pattern background to the app" [level=3] [ref=e31]
    - paragraph [ref=e32]: "## Description Replace the current background with a subtle dot pattern background inspired by [Aceternity UI's dot backgrounds](https://ui.aceternity.com/components/grid-and-dot-backgrounds). ## Requirements - Dot background in **both light and dark modes** - **Consistent pattern** across the entire viewport (no fade effect at edges) - Default styling: 1px dots, 20px spacing ## Implementation Details Use CSS `radial-gradient` for the dot pattern: - Light mode: `radial-gradient(#d4d4d4 1px, transparent 1px)` - Dark mode: `radial-gradient(#404040 1px, transparent 1px)` - Background size: `20px 20px` ## Affected Files - `frontend/src/App.tsx` or global CSS"
```