"""
setup_db.py — One-shot script to apply schema.sql to the PostgreSQL database.
Usage: python setup_db.py
Mirrors the behaviour of the original Node.js src/db-setup.js.
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def setup():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "clynicx"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    conn.autocommit = True
    cur = conn.cursor()

    schema_file = os.path.abspath(SCHEMA_PATH)
    print(f"🔧 Reading schema from: {schema_file}")

    with open(schema_file, "r", encoding="utf-8") as f:
        sql = f.read()

    print("🔧 Running database schema...")
    cur.execute(sql)
    print("✅ Database schema applied successfully!")
    print("\nTables created/verified:")
    print("  - users")
    print("  - appointments")
    print("  - prescriptions")
    print("  - medical_reports")
    print("  - doctor_activity")

    cur.close()
    conn.close()


if __name__ == "__main__":
    try:
        setup()
    except Exception as e:
        print(f"❌ Schema error: {e}")
        raise
