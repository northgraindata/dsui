# dsui data-stack demo

Start the complete demonstration from the repository root:

```bash
docker compose -f examples/data-stack/compose.yaml up --build
```

Open <http://localhost:3000>. Trino, Kafka, and MinIO are already configured. The `events` Kafka topic and `warehouse/readme.txt` MinIO object are created during startup.

The credentials and encryption key in this example are development-only and must never be reused in another environment.
