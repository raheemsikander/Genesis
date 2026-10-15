# Adding a Role-Restricted Portal Route

Three files, always all three:

1. **Page**: create `apps/web/src/app/portal/<name>/page.tsx`
2. **Config**: add an entry to `routeAccessConfig` in `apps/web/src/config/route-access.ts`:
   ```ts
   "/portal/<name>": { allowedRoles: [Roles.ADMIN] },
   ```
3. **Nav**: add the entry to `navigationItems` in `apps/web/src/config/navigation-items.tsx` (single source of truth for both the sidebar and breadcrumb labels)

The route guard (`PortalRoleGuard`) and the sidebar filter (`filterNavItemsByRole`) both read `routeAccessConfig`, so there is one source of truth and no drift between "this route redirects X role" and "this nav item is hidden for X role." Routes not listed in the config default to "any authenticated user."

Always use the `Roles.ADMIN` / `Roles.MEMBER` constants from `packages/shared/src/models/user.types.ts`, never raw `"admin"` / `"member"` strings.

For hiding a subtree rather than gating a whole page, use `<Authorizer>` instead of a route entry.
