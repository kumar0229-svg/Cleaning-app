import psycopg2

conn = psycopg2.connect(
    host="localhost", port=5432, dbname="cleaning_db",
    user="postgres", password="Raymond@210410"
)
conn.autocommit = True
cur = conn.cursor()

migrations = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS product_category TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS product_attribute TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS cas_number TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS chemical_number TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS final_product_id INTEGER",
]

for sql in migrations:
    try:
        cur.execute(sql)
        print("OK:", sql)
    except Exception as e:
        print("SKIP:", e)

# Verify
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='products' ORDER BY ordinal_position
""")
print("\nFinal products columns:", [r[0] for r in cur.fetchall()])
conn.close()
