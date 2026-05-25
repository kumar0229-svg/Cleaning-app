import sqlite3, os
db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "maco.db")
print("DB path:", db)
print("DB exists:", os.path.exists(db))
if os.path.exists(db):
    print("DB size (bytes):", os.path.getsize(db))
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print("Tables:", tables)
    for t in tables:
        cur.execute("SELECT COUNT(*) FROM " + t)
        print("  " + t + ": " + str(cur.fetchone()[0]) + " rows")
    conn.close()
