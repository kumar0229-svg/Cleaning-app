"""
One-shot migration: copies all data from maco.db (SQLite) to PostgreSQL.
Safe to re-run — truncates PG tables before inserting.
"""
import os
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "maco.db")
PG_DSN = "postgresql://postgres:Raymond%40210410@localhost:5432/cleaning_db"

# Columns stored as 0/1 integers in SQLite that must become booleans in PostgreSQL
BOOL_COLUMNS = {
    "users":        {"is_archived", "force_password_reset"},
    "products":     {"is_archived"},
    "maco_results": {"is_governing"},
}

# Migration order respects FK: protocol_archive before cleaning_validation_reports
TABLES = [
    "system_config",
    "facilities",
    "equipment_category",
    "equipment",
    "users",
    "products",
    "product_equipment",
    "maco_runs",
    "maco_results",
    "audit_log",
    "protocol_archive",
    "sampling_plan_entry",
    "cleaning_validation_reports",
]

def get_columns(sqlite_cur, table):
    sqlite_cur.execute(f"PRAGMA table_info([{table}])")
    return [row[1] for row in sqlite_cur.fetchall()]

def migrate():
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(PG_DSN)
    pg_conn.autocommit = False
    pg_cur = pg_conn.cursor()

    try:
        for table in TABLES:
            # Check table exists in SQLite
            sqlite_cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
            )
            if not sqlite_cur.fetchone():
                print(f"  SKIP  {table} (not in SQLite)")
                continue

            cols = get_columns(sqlite_cur, table)
            sqlite_cur.execute(f"SELECT * FROM [{table}]")
            rows = sqlite_cur.fetchall()

            if not rows:
                print(f"  EMPTY {table}")
                continue

            # Truncate PG table first (cascade handles FK child rows via order)
            pg_cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')

            col_list = ", ".join(f'"{c}"' for c in cols)
            bool_cols = BOOL_COLUMNS.get(table, set())
            bool_idxs = {i for i, c in enumerate(cols) if c in bool_cols}
            def coerce(row):
                r = list(row)
                for i in bool_idxs:
                    if r[i] is not None:
                        r[i] = bool(r[i])
                return tuple(r)
            values = [coerce(row) for row in rows]

            execute_values(
                pg_cur,
                f'INSERT INTO "{table}" ({col_list}) VALUES %s',
                values,
            )
            print(f"  OK    {table}: {len(values)} rows")

        # Reset sequences so new inserts don't collide with migrated IDs
        seq_resets = [
            ("audit_log_audit_id_seq",                        "audit_log",                      "audit_id"),
            ("users_user_id_seq",                             "users",                           "user_id"),
            ("facilities_facility_id_seq",                    "facilities",                      "facility_id"),
            ("equipment_category_category_id_seq",            "equipment_category",              "category_id"),
            ("equipment_equipment_id_seq",                    "equipment",                       "equipment_id"),
            ("products_product_id_seq",                       "products",                        "product_id"),
            ("product_equipment_id_seq",                      "product_equipment",               "id"),
            ("maco_runs_run_id_seq",                          "maco_runs",                       "run_id"),
            ("maco_results_result_id_seq",                    "maco_results",                    "result_id"),
            ("protocol_archive_archive_id_seq",               "protocol_archive",                "archive_id"),
            ("sampling_plan_entry_entry_id_seq",              "sampling_plan_entry",             "entry_id"),
            ("cleaning_validation_reports_report_id_seq",     "cleaning_validation_reports",     "report_id"),
        ]
        for seq, table, col in seq_resets:
            pg_cur.execute(
                f"SELECT setval('{seq}', (SELECT GREATEST(MAX({col}), 1) FROM \"{table}\"))"
            )
        print("  OK    sequences reset")

        pg_conn.commit()
        print("\nMigration complete.")

    except Exception as e:
        pg_conn.rollback()
        print(f"\nERROR — rolled back: {e}")
        raise
    finally:
        sqlite_cur.close()
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()

if __name__ == "__main__":
    migrate()
