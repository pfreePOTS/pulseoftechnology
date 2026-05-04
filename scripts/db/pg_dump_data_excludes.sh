#!/usr/bin/env bash
# Shared exclude-table flags for data-only pg_dump of this app’s schema.
# Keep in sync with SQLAlchemy __tablename__ values in backend/models/.
#
# Usage (source from other scripts):
#   # shellcheck source=scripts/db/pg_dump_data_excludes.sh
#   source "$SCRIPT_DIR/pg_dump_data_excludes.sh"
#   excludes=( "${PG_DUMP_ALWAYS_EXCLUDE[@]}" )
#   if [[ "$without_users_subscribers" -eq 1 ]]; then
#     excludes+=( "${PG_DUMP_NO_ACCOUNT_OR_SUBSCRIBER_DATA[@]}" )
#   fi

PG_DUMP_ALWAYS_EXCLUDE=(--exclude-table=alembic_version)

# Console accounts, marketing subscribers, and rows tied to them or recipient email.
PG_DUMP_NO_ACCOUNT_OR_SUBSCRIBER_DATA=(
  --exclude-table=admin_users
  --exclude-table=subscribers
  --exclude-table=hubspot_sync_logs
  --exclude-table=survey_responses
  --exclude-table=newsletter_issues
)
