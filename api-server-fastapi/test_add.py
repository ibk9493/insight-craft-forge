# test_direct_insert.py
from datetime import datetime
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import os
import json
import models
from database import engine, get_db

def direct_insert_test():
    # Connect to the database
    db = next(get_db())

    # Test data - use exactly what's in your paste.txt
    test_data = {
        "url": "https://github.com/testsss/asdsadas/discussions/211112132133277",
        "title": "Discuasdasdssion from testssadasdss/asdsasdsadadas",
        "repository": "testssadsadss/asdsaasdsaddas",
        "created_at": "2024-12-20T07:14:03.000Z",
        "question": "How to pasdsadrint the name of a file uploaded via a button?\n\nAs shown below, I have two questions:\r\n\r\n1...",
        "answer": "@hopezh , you haveasdas to assign UI elements to global variables and output the global variable...",
        "category": "<SWE_KNOWLEDGE>",
        "knowledge": "- Assign UI elements to global variables\n    - Output the global variable...",
        "repository_language": "Python"
    }

    # Create an ID
    discussion_id = f"testsss_asdsadas_211113asdasdasd277"

    try:
        # Create discussion object
        discussion = models.Discussion(
            id=discussion_id,
            title=test_data["title"],
            url=test_data["url"],
            repository=test_data["repository"],
            created_at=test_data["created_at"],
            repository_language=test_data["repository_language"],
            question=test_data["question"],
            answer=test_data["answer"],
            category=test_data["category"],
            knowledge=test_data["knowledge"]
        )

        # Add and commit
        db.add(discussion)
        db.commit()
        print("Discussion added successfully!")

        # Verify it was added correctly
        added = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
        if added:
            print("\nRETRIEVED FROM DATABASE:")
            for attr_name, attr_value in vars(added).items():
                if attr_name != '_sa_instance_state':
                    if attr_name in ['question', 'answer', 'knowledge', 'category']:
                        value_preview = str(attr_value)[:30] + "..." if attr_value else None
                        print(f"- {attr_name}: {value_preview}")
                    else:
                        print(f"- {attr_name}: {attr_value}")
        else:
            print("WARNING: Could not find discussion after commit!")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    direct_insert_test()