"""
db.py — PostgreSQL connection pool for Clynicx Python backend.
Mirrors the behaviour of the original Node.js src/db.js.
"""
import os
import psycopg2
from psycopg2 import pool as pg_pool
from dotenv import load_dotenv

load_dotenv()

# Build a thread-safe connection pool (min=2, max=20 connections)
_pool: pg_pool.ThreadedConnectionPool | None = None


def get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            dbname=os.getenv("DB_NAME", "clynicx"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            connect_timeout=5,
        )
    return _pool


def get_conn():
    """Borrow a connection from the pool. Must be returned with put_conn()."""
    return get_pool().getconn()


def put_conn(conn):
    """Return a connection to the pool."""
    get_pool().putconn(conn)


class DBConn:
    """Context manager: auto-returns connection to pool on exit."""

    def __enter__(self):
        self.conn = get_conn()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.conn.rollback()
        put_conn(self.conn)
        return False


def query(sql: str, params=None) -> list[dict]:
    """Execute a query and return all rows as a list of dicts."""
    with DBConn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            if cur.description is None:
                conn.commit()
                return []
            cols = [desc[0] for desc in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
            conn.commit()
            return rows


def execute(sql: str, params=None) -> list[dict]:
    """Execute a DML statement with RETURNING clause, return affected rows."""
    return query(sql, params)


# Test connection on module import
try:
    _test = query("SELECT 1 AS ok")
    print("✅ Connected to PostgreSQL database")
except Exception as e:
    print(f"❌ Failed to connect to PostgreSQL: {e}")
