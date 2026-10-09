# Diagnose service health

Use this guide when investigating an unavailable service, failed DAG, failed
run, or another operational incident.

1. List the services and identify the relevant service IDs. Start with any
   services mentioned by the user, then inspect related services as needed.
2. Call `get_service_health` for relevant services. Discover available
   resources and read the incident, run, task, or log resources exposed by
   their adapters. Use `list_events` for recorded DSUI events.
3. Separate observed status and error messages from likely causes. Cite service
   and resource IDs; state when logs or events are unavailable or incomplete.
4. Suggest concrete next checks. Do not claim to retry runs, edit settings, or
   monitor future events; those actions are outside the current read-only tools.

Adapter resources and action names vary. Discover them before use; never guess
an Airflow, dbt, or database operation from the adapter name.
