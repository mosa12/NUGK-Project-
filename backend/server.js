const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// In-memory database
const db = {
  polls: [],
  votes: new Map() // IP -> Set of poll IDs to track votes
};

// Helper function to get client IP
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.connection.socket.remoteAddress;
};

// Calculate results for a poll
const calculateResults = (poll) => {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  const results = poll.options.map(option => ({
    text: option.text,
    votes: option.votes,
    percentage: totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0
  }));
  
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    results,
    totalVotes,
    createdAt: poll.createdAt
  };
};

// GET /polls - Get all polls with results
app.get('/api/polls', (req, res) => {
  try {
    const pollsWithResults = db.polls.map(poll => calculateResults(poll));
    res.json({
      success: true,
      data: pollsWithResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch polls'
    });
  }
});

// POST /polls - Create a new poll
app.post('/api/polls', (req, res) => {
  try {
    const { question, options } = req.body;

    // Validation
    if (!question || !options || !Array.isArray(options)) {
      return res.status(400).json({
        success: false,
        error: 'Question and options array are required'
      });
    }

    if (options.length < 2 || options.length > 4) {
      return res.status(400).json({
        success: false,
        error: 'Poll must have 2-4 options'
      });
    }

    if (options.some(opt => !opt.trim())) {
      return res.status(400).json({
        success: false,
        error: 'All options must be non-empty strings'
      });
    }

    const newPoll = {
      id: uuidv4(),
      question: question.trim(),
      options: options.map(text => ({
        text: text.trim(),
        votes: 0
      })),
      createdAt: new Date().toISOString()
    };

    db.polls.unshift(newPoll);

    res.status(201).json({
      success: true,
      data: calculateResults(newPoll)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create poll'
    });
  }
});

// POST /polls/:id/vote - Vote on a poll
app.post('/api/polls/:id/vote', (req, res) => {
  try {
    const { id } = req.params;
    const { optionIndex } = req.body;
    const clientIP = getClientIP(req);

    // Find poll
    const poll = db.polls.find(p => p.id === id);
    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    // Validate option index
    if (optionIndex === undefined || optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid option index'
      });
    }

    // Check for duplicate voting
    if (!db.votes.has(clientIP)) {
      db.votes.set(clientIP, new Set());
    }
    
    const userVotes = db.votes.get(clientIP);
    if (userVotes.has(id)) {
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this poll'
      });
    }

    // Record vote
    poll.options[optionIndex].votes++;
    userVotes.add(id);

    res.json({
      success: true,
      data: calculateResults(poll),
      message: 'Vote recorded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to record vote'
    });
  }
});

// DELETE /polls/:id - Delete a poll
app.delete('/api/polls/:id', (req, res) => {
  try {
    const { id } = req.params;
    const pollIndex = db.polls.findIndex(p => p.id === id);

    if (pollIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    db.polls.splice(pollIndex, 1);

    res.json({
      success: true,
      message: 'Poll deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete poll'
    });
  }
});

// GET /polls/:id/results - Get specific poll results
app.get('/api/polls/:id/results', (req, res) => {
  try {
    const { id } = req.params;
    const poll = db.polls.find(p => p.id === id);

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: 'Poll not found'
      });
    }

    res.json({
      success: true,
      data: calculateResults(poll)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch results'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});