import React, { useState, useEffect } from 'react';

interface AnnotatorEmailProps {
  userId: string;
  getUserEmailById?: (userId: string) => Promise<string>;
}

const AnnotatorEmail: React.FC<AnnotatorEmailProps> = ({ userId, getUserEmailById }) => {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmail = async () => {
      if (getUserEmailById) {
        try {
          const fetchedEmail = await getUserEmailById(userId);
          setEmail(fetchedEmail);
        } catch (error) {
          console.error("Error fetching email:", error);
          setEmail(null);
        }
      }
    };

    fetchEmail();
  }, [userId, getUserEmailById]);

  return <>{email || `Annotator (ID: ${userId})`}</>;
};

export default AnnotatorEmail;