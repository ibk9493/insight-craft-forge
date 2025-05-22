# migrations.py
import sqlite3
import os


def run_migrations():
    """
    Run database migrations to add new columns and indexes.
    """
    db_path = 'swe_qa.db'  # Update this to match your actual database file
    conn = None  # Initialize conn to None

    try:
        # Connect to SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # --- Migrations for 'discussions' table (existing logic) ---
        cursor.execute("PRAGMA table_info(discussions)")
        discussions_columns_info = cursor.fetchall()
        discussions_existing_columns = [info[1] for info in discussions_columns_info]

        new_discussions_columns = {
            "question": "TEXT",
            "answer": "TEXT",
            "category": "TEXT",
            "knowledge": "TEXT",
            "code": "TEXT"
        }

        for column, column_type in new_discussions_columns.items():
            if column not in discussions_existing_columns:
                print(f"Adding column {column} to 'discussions' table")
                cursor.execute(f"ALTER TABLE discussions ADD COLUMN {column} {column_type}")
            else:
                print(f"Column {column} already exists in 'discussions' table.")

        # --- Migrations for 'consensus_annotations' table ---
        print("\nStarting migrations for 'consensus_annotations' table...")
        cursor.execute("PRAGMA table_info(consensus_annotations)")
        consensus_columns_info = cursor.fetchall()
        consensus_existing_columns = [info[1] for info in consensus_columns_info]

        new_consensus_columns = {
            "user_id": "TEXT",  # Stores ID of user who saved the record (from token)
            "annotator_id": "TEXT"  # Stores ID of the annotator (from payload's user_id)
        }

        # Add new columns if they don't exist
        for column, column_type in new_consensus_columns.items():
            if column not in consensus_existing_columns:
                print(f"Adding column {column} to 'consensus_annotations' table")
                # Making these nullable for now to avoid issues with existing rows,
                # but your model defines them as nullable=False.
                # Consider data backfill or making them NOT NULL with a DEFAULT if appropriate.
                cursor.execute(f"ALTER TABLE consensus_annotations ADD COLUMN {column} {column_type}")
            else:
                print(f"Column {column} already exists in 'consensus_annotations' table.")

        # Add indexes for new columns for better query performance
        new_indexes_consensus = {
            "idx_consensus_user_id": "user_id",
            "idx_consensus_annotator_id": "annotator_id",
            "idx_consensus_discussion_id": "discussion_id",  # If not already indexed
            "idx_consensus_task_id": "task_id"  # If not already indexed
        }

        cursor.execute("PRAGMA index_list(consensus_annotations)")
        existing_indexes_info = cursor.fetchall()
        existing_index_names = [info[1] for info in existing_indexes_info]

        for index_name, column_name in new_indexes_consensus.items():
            if index_name not in existing_index_names:
                print(f"Creating index {index_name} on 'consensus_annotations' ({column_name})")
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON consensus_annotations ({column_name})")
            else:
                print(f"Index {index_name} already exists on 'consensus_annotations'.")

        # Attempt to create the new unique index for discussion_id, task_id, annotator_id
        new_unique_index_name = "uix_discussion_task_annotator"
        if new_unique_index_name not in existing_index_names:
            print(
                f"Attempting to create unique index '{new_unique_index_name}' on 'consensus_annotations' (discussion_id, task_id, annotator_id)")
            try:
                cursor.execute(
                    f"CREATE UNIQUE INDEX {new_unique_index_name} ON consensus_annotations (discussion_id, task_id, annotator_id)")
                print(f"Successfully created unique index '{new_unique_index_name}'.")
            except sqlite3.OperationalError as e:
                if "already exists" in str(e) or "UNIQUE constraint failed" in str(
                        e):  # Check for specific error for uniqueness
                    print(
                        f"Could not create unique index '{new_unique_index_name}'. It might conflict with existing data or another unique index. Error: {e}")
                else:
                    print(f"Error creating unique index '{new_unique_index_name}': {e}")
        else:
            print(f"Unique index '{new_unique_index_name}' already exists.")

        print(
            "\nNote: If an old unique constraint 'uix_consensus' (on discussion_id, task_id) exists from the table definition,")
        print("this script does not remove it. SQLite requires a table rebuild to modify or drop such constraints.")
        print("If you encounter 'UNIQUE constraint failed' errors related to the old constraint after these changes,")
        print("you may need to manually recreate the 'consensus_annotations' table with the new schema.")

        conn.commit()
        print("\nMigrations completed successfully.")

    except sqlite3.Error as e:  # Catch SQLite specific errors
        print(f"SQLite error during migrations: {str(e)}")
        if conn:
            conn.rollback()  # Rollback on SQLite error
    except Exception as e:
        print(f"General error during migrations: {str(e)}")
        if conn:
            conn.rollback()  # Rollback on general error
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    run_migrations()
