# migrations.py
import sqlite3
import os

def run_migrations():
    """
    Run database migrations to add new columns to discussions table
    """
    try:
        # Connect to SQLite database
        conn = sqlite3.connect('swe_qa.db')  # Update this to match your actual database file
        cursor = conn.cursor()

        # Check if question column exists
        cursor.execute("PRAGMA table_info(discussions)")
        columns = [info[1] for info in cursor.fetchall()]

        # Add new columns if they don't exist
        new_columns = {
            "question": "TEXT",
            "answer": "TEXT",
            "category": "TEXT",
            "knowledge": "TEXT",
            "code": "TEXT"
        }

        for column, column_type in new_columns.items():
            if column not in columns:
                print(f"Adding column {column} to discussions table")
                cursor.execute(f"ALTER TABLE discussions ADD COLUMN {column} {column_type}")

        conn.commit()
        print("Migrations completed successfully")

    except Exception as e:
        print(f"Error during migrations: {str(e)}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    run_migrations()