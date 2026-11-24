# Status pages

Publish service status and notices for the teams that depend on your services.
The plugin owns its pages, components, notices and updates in its own `status-pages.sqlite` database.

```yaml
plugins:
  status-pages:
    source: local
    path: ./packages/plugin-status-pages
    enabled: true
```

Run DSUI from the repository root for this relative path, or use an absolute path.
Configure pages and notices in **Status pages** in the sidebar. `maxServices` optionally limits the service picker (default: 5000).

Service health is optional. When enabled, its `status-history` resource provides recorded status, maintenance and daily counters for 90-day uptime bars. Opening a status page never probes a service. Without Service health, notices remain usable and uptime is shown as unavailable.

Incidents is optional. When both plugins are installed, Incidents can publish, update and resolve notices through the `post-notice`, `update-notice` and `resolve-notice` actions. The `status-pages` and `status-page` resources expose the pages and their details to other plugins.

Page visibility requires access to every service on the page. Editing requires manage access to all affected services; publishing requires execute access. Pages without services require an administrator.

The plugin has its own generated logo and sidebar entry. It requires no secrets or environment variables. Status pages are workspace pages; public share links are not included.
