
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const DISCUSSIONS_FILE = path.join(DATA_DIR, 'discussions.json');
const ANNOTATIONS_FILE = path.join(DATA_DIR, 'annotations.json');
const CONSENSUS_FILE = path.join(DATA_DIR, 'consensus.json');
const AUTHORIZED_USERS_FILE = path.join(DATA_DIR, 'authorized_users.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure data directories exist
[DATA_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize data files if they don't exist
function initializeDataFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData), 'utf8');
  }
}

initializeDataFile(DISCUSSIONS_FILE, []);
initializeDataFile(ANNOTATIONS_FILE, []);
initializeDataFile(CONSENSUS_FILE, []);
initializeDataFile(AUTHORIZED_USERS_FILE, []);

// Helper: Read data from file
function readDataFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
}

// Helper: Write data to file
function writeDataFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    return false;
  }
}

// API key verification middleware
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'development_api_key';
  
  if (apiKey && apiKey === validApiKey) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized: Invalid API key' });
  }
};

// Apply API key verification to all routes except those that don't need it
app.use('/api', verifyApiKey);

// ROUTES

// Discussions
app.get('/api/discussions', (req, res) => {
  const status = req.query.status;
  const discussions = readDataFile(DISCUSSIONS_FILE);
  
  if (status) {
    const filteredDiscussions = discussions.filter(d => {
      if (status === 'completed') {
        return d.tasks.task1.status === 'completed' && 
               d.tasks.task2.status === 'completed' && 
               d.tasks.task3.status === 'completed';
      } else if (status === 'unlocked') {
        return d.tasks.task1.status === 'unlocked' || 
               d.tasks.task2.status === 'unlocked' || 
               d.tasks.task3.status === 'unlocked';
      } else {
        return d.tasks.task1.status === 'locked' && 
               d.tasks.task2.status === 'locked' && 
               d.tasks.task3.status === 'locked';
      }
    });
    
    return res.json(filteredDiscussions);
  }
  
  res.json(discussions);
});

app.get('/api/discussions/:id', (req, res) => {
  const { id } = req.params;
  const discussions = readDataFile(DISCUSSIONS_FILE);
  const discussion = discussions.find(d => d.id === id);
  
  if (discussion) {
    res.json(discussion);
  } else {
    res.status(404).json({ message: 'Discussion not found' });
  }
});

// Annotations
app.get('/api/annotations', (req, res) => {
  const { discussionId, userId, taskId } = req.query;
  const annotations = readDataFile(ANNOTATIONS_FILE);
  
  let filtered = [...annotations];
  
  if (discussionId) {
    filtered = filtered.filter(a => a.discussionId === discussionId);
  }
  
  if (userId) {
    filtered = filtered.filter(a => a.userId === userId);
  }
  
  if (taskId) {
    filtered = filtered.filter(a => a.taskId === Number(taskId));
  }
  
  // If specific user and task, return a single annotation
  if (userId && taskId && discussionId && filtered.length === 1) {
    return res.json(filtered[0]);
  }
  
  res.json(filtered);
});

app.post('/api/annotations', (req, res) => {
  const annotation = req.body;
  const annotations = readDataFile(ANNOTATIONS_FILE);
  
  // Add timestamp
  const newAnnotation = {
    ...annotation,
    timestamp: new Date().toISOString()
  };
  
  // Check if this annotation already exists
  const existingIndex = annotations.findIndex(
    a => a.discussionId === annotation.discussionId && 
         a.userId === annotation.userId && 
         a.taskId === annotation.taskId
  );
  
  if (existingIndex !== -1) {
    annotations[existingIndex] = newAnnotation;
  } else {
    annotations.push(newAnnotation);
  }
  
  if (writeDataFile(ANNOTATIONS_FILE, annotations)) {
    // Update discussion task status
    const discussions = readDataFile(DISCUSSIONS_FILE);
    const discussionIndex = discussions.findIndex(d => d.id === annotation.discussionId);
    
    if (discussionIndex !== -1) {
      const taskKey = `task${annotation.taskId}`;
      discussions[discussionIndex].tasks[taskKey].annotators += 1;
      writeDataFile(DISCUSSIONS_FILE, discussions);
    }
    
    res.status(201).json(newAnnotation);
  } else {
    res.status(500).json({ message: 'Failed to save annotation' });
  }
});

app.put('/api/annotations/:discussionId/:userId/:taskId', (req, res) => {
  const { discussionId, userId, taskId } = req.params;
  const updatedData = req.body;
  const annotations = readDataFile(ANNOTATIONS_FILE);
  const index = annotations.findIndex(
    a => a.discussionId === discussionId && a.userId === userId && a.taskId === Number(taskId)
  );
  
  if (index === -1) {
    return res.status(404).json({ message: 'Annotation not found' });
  }
  
  annotations[index] = {
    ...updatedData,
    timestamp: new Date().toISOString()
  };
  
  if (writeDataFile(ANNOTATIONS_FILE, annotations)) {
    res.json(annotations[index]);
  } else {
    res.status(500).json({ message: 'Failed to update annotation' });
  }
});

// Consensus
app.get('/api/consensus', (req, res) => {
  const { discussionId, taskId } = req.query;
  const consensusAnnotations = readDataFile(CONSENSUS_FILE);
  
  const consensus = consensusAnnotations.find(
    c => c.discussionId === discussionId && c.taskId === Number(taskId)
  );
  
  if (consensus) {
    res.json(consensus);
  } else {
    res.status(404).json({ message: 'Consensus not found' });
  }
});

app.post('/api/consensus', (req, res) => {
  const consensusData = req.body;
  const consensusAnnotations = readDataFile(CONSENSUS_FILE);
  
  // Add timestamp
  const newConsensus = {
    ...consensusData,
    timestamp: new Date().toISOString()
  };
  
  // Check if this consensus already exists
  const existingIndex = consensusAnnotations.findIndex(
    c => c.discussionId === consensusData.discussionId && c.taskId === consensusData.taskId
  );
  
  if (existingIndex !== -1) {
    consensusAnnotations[existingIndex] = newConsensus;
  } else {
    consensusAnnotations.push(newConsensus);
  }
  
  if (writeDataFile(CONSENSUS_FILE, consensusAnnotations)) {
    res.status(201).json(newConsensus);
  } else {
    res.status(500).json({ message: 'Failed to save consensus' });
  }
});

app.post('/api/consensus/calculate', (req, res) => {
  const { discussionId, taskId } = req.query;
  const annotations = readDataFile(ANNOTATIONS_FILE);
  
  // Get all annotations for this discussion and task
  const relevantAnnotations = annotations.filter(
    a => a.discussionId === discussionId && a.taskId === Number(taskId)
  );
  
  // Simple implementation: just check if there are enough annotations
  if (relevantAnnotations.length >= 3) {
    res.json({ result: 'Agreement', agreement: true });
  } else {
    res.json({ result: 'Not enough annotations', agreement: false });
  }
});

app.post('/api/consensus/override', (req, res) => {
  const { discussionId, taskId, data } = req.body;
  const consensusAnnotations = readDataFile(CONSENSUS_FILE);
  
  const index = consensusAnnotations.findIndex(
    c => c.discussionId === discussionId && c.taskId === Number(taskId)
  );
  
  const updatedConsensus = {
    discussionId,
    userId: 'override',
    taskId: Number(taskId),
    data,
    timestamp: new Date().toISOString()
  };
  
  if (index !== -1) {
    consensusAnnotations[index] = updatedConsensus;
  } else {
    consensusAnnotations.push(updatedConsensus);
  }
  
  if (writeDataFile(CONSENSUS_FILE, consensusAnnotations)) {
    res.json(updatedConsensus);
  } else {
    res.status(500).json({ message: 'Failed to override consensus' });
  }
});

// Files
app.post('/api/files/upload', (req, res) => {
  // This would normally use multer for file uploads
  // For demo purposes, we'll just return a mock URL
  const discussionId = req.body.discussionId || uuidv4();
  const fileUrl = `/uploads/${discussionId}_${Date.now()}.png`;
  
  res.json({ fileUrl });
});

// Code
app.get('/api/code/download', (req, res) => {
  const { discussionId, repo } = req.query;
  
  // In a real app, this would generate/fetch the actual download URL
  const downloadUrl = `https://github.com/${repo}/archive/refs/heads/master.zip`;
  
  res.json({ downloadUrl });
});

// Admin
app.post('/api/admin/discussions/upload', (req, res) => {
  const { discussions } = req.body;
  const existingDiscussions = readDataFile(DISCUSSIONS_FILE);
  
  try {
    const processedDiscussions = discussions.map(disc => {
      const repository = disc.repository || extractRepositoryFromUrl(disc.url);
      return {
        ...disc,
        repository,
        tasks: {
          task1: disc.tasks?.task1 || { status: 'locked', annotators: 0 },
          task2: disc.tasks?.task2 || { status: 'locked', annotators: 0 },
          task3: disc.tasks?.task3 || { status: 'locked', annotators: 0 }
        }
      };
    });
    
    const newDiscussions = [...existingDiscussions, ...processedDiscussions];
    
    if (writeDataFile(DISCUSSIONS_FILE, newDiscussions)) {
      res.json({
        success: true,
        message: `Successfully uploaded ${processedDiscussions.length} discussions`,
        discussionsAdded: processedDiscussions.length
      });
    } else {
      throw new Error('Failed to write discussions to file');
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing discussions',
      discussionsAdded: 0,
      errors: [error.message]
    });
  }
});

app.put('/api/admin/tasks/status', (req, res) => {
  const { discussionId, taskId, status } = req.body;
  const discussions = readDataFile(DISCUSSIONS_FILE);
  const discussionIndex = discussions.findIndex(d => d.id === discussionId);
  
  if (discussionIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Discussion not found'
    });
  }
  
  // Update the task status
  const taskKey = `task${taskId}`;
  discussions[discussionIndex].tasks[taskKey].status = status;
  
  if (writeDataFile(DISCUSSIONS_FILE, discussions)) {
    res.json({
      success: true,
      message: `Task ${taskId} status updated to ${status}`,
      discussion: discussions[discussionIndex]
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to update task status'
    });
  }
});

app.put('/api/admin/annotations/override', (req, res) => {
  const annotation = req.body;
  const annotations = readDataFile(ANNOTATIONS_FILE);
  
  // Add timestamp
  const overriddenAnnotation = {
    ...annotation,
    timestamp: new Date().toISOString()
  };
  
  // Check if this annotation already exists
  const existingIndex = annotations.findIndex(
    a => a.discussionId === annotation.discussionId && 
         a.userId === annotation.userId && 
         a.taskId === annotation.taskId
  );
  
  if (existingIndex !== -1) {
    annotations[existingIndex] = overriddenAnnotation;
  } else {
    annotations.push(overriddenAnnotation);
  }
  
  if (writeDataFile(ANNOTATIONS_FILE, annotations)) {
    res.json(overriddenAnnotation);
  } else {
    res.status(500).json({ message: 'Failed to override annotation' });
  }
});

// Auth
app.post('/api/auth/google', (req, res) => {
  // In a real app, this would verify the Google token with Google's servers
  const { token } = req.body;
  
  // For demo purposes, we'll just return success
  res.json({
    success: true,
    user: {
      id: uuidv4(),
      username: 'google.user@example.com',
      email: 'google.user@example.com',
      role: 'annotator',
      provider: 'google'
    }
  });
});

app.get('/api/auth/authorized-users', (req, res) => {
  const authorizedUsers = readDataFile(AUTHORIZED_USERS_FILE);
  res.json(authorizedUsers);
});

app.post('/api/auth/authorized-users', (req, res) => {
  const { email, role } = req.body;
  const authorizedUsers = readDataFile(AUTHORIZED_USERS_FILE);
  
  // Check if user already exists
  const existingIndex = authorizedUsers.findIndex(u => u.email === email);
  
  if (existingIndex !== -1) {
    authorizedUsers[existingIndex].role = role;
  } else {
    authorizedUsers.push({ email, role });
  }
  
  if (writeDataFile(AUTHORIZED_USERS_FILE, authorizedUsers)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save authorized user' });
  }
});

app.delete('/api/auth/authorized-users/:email', (req, res) => {
  const { email } = req.params;
  const authorizedUsers = readDataFile(AUTHORIZED_USERS_FILE);
  
  const filteredUsers = authorizedUsers.filter(u => u.email !== decodeURIComponent(email));
  
  if (writeDataFile(AUTHORIZED_USERS_FILE, filteredUsers)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, message: 'Failed to remove authorized user' });
  }
});

// Utility function to extract repository name from GitHub URL
function extractRepositoryFromUrl(url) {
  try {
    const githubUrlPattern = /github\.com\/([^\/]+\/[^\/]+)/i;
    const match = url.match(githubUrlPattern);
    return match ? match[1] : 'unknown/repository';
  } catch (error) {
    console.error('Error extracting repository from URL:', error);
    return 'unknown/repository';
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
