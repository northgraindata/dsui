---
title: Mental model
description: Resource is data, store is state, action is behavior, page is composition, context is environment, adapter is the boundary.
---

# Mental model

Six concepts, each with one job. If you remember nothing else, remember
which box a piece of code belongs in.

**Resource** is external data: databases, warehouses, query history,
logs. A resource is parameterized (a database name, a filter), validated
with Zod, and managed by the runtime. The runtime fetches it, refreshes
it, and cleans it up. Adapter code describes the query and never runs it.

**Store** is local state: the selected warehouse, filter values, SQL
being edited, the active tab. Stores have typed actions and
subscriptions, and they live either for the adapter instance or for one
rendered page. If the data came from a service, it does not belong in a
store. If losing it on refresh would only annoy, it probably does.

**Action** is behavior: suspend a warehouse, run a query, grant a role.
An action takes validated input and performs a side effect. It never
describes presentation. Labels, buttons, and layout belong to
components; the action only does the thing.

**Page** is composition: a route that turns URL params and store state
into components and bindings. Pages never fetch and never implement
business logic. When a page file starts querying clients directly,
that logic belongs in a resource.

**Context** is environment: the API client, the logger, and the
validated configuration for one running instance. Every resource query
and every action receives it. It never holds UI state. Selected
warehouse goes in a store; the client that talks to Snowflake goes in
context.

**Adapter** is the boundary: identity plus the five pieces above. One
definition serves many isolated instances. Production and development
connections share every line of adapter code and none of the runtime
state.

A useful test when placing code: delete the candidate and ask what
breaks. If external data stops flowing, it was a resource. If the UI
forgets its place, it was a store. If nothing happens on click, it was
an action. If pixels are wrong but data is right, it was a component.

## What to read next

- [Bindings and execution](./bindings-and-execution) for the definition, binding, and execution split
- [Instances and isolation](./instances-and-isolation) for how one definition serves many connections
