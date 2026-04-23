const API_BASE_URL = 'http://localhost:3000/api';

// State
let currentPolls = [];
let userVotedPolls = new Set(); // Track voted polls client-side

// DOM Elements
const createPollForm = document.getElementById('createPollForm');
const optionsContainer = document.getElementById('optionsContainer');
const addOptionBtn = document.getElementById('addOptionBtn');
const pollsContainer = document.getElementById('pollsContainer');
const pollCount = document.getElementById('pollCount');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPolls();
    setupEventListeners();
    checkLocalVotes();
});

function setupEventListeners() {
    createPollForm.addEventListener('submit', handleCreatePoll);
    addOptionBtn.addEventListener('click', addOptionField);
    optionsContainer.addEventListener('click', handleRemoveOption);
}

// Check local storage for voted polls
function checkLocalVotes() {
    const stored = localStorage.getItem('votedPolls');
    if (stored) {
        userVotedPolls = new Set(JSON.parse(stored));
    }
}

// Toast notification
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Load all polls
async function loadPolls() {
    try {
        const response = await fetch(`${API_BASE_URL}/polls`);
        const data = await response.json();
        
        if (data.success) {
            currentPolls = data.data;
            renderPolls();
        }
    } catch (error) {
        showToast('Failed to load polls', 'error');
        console.error('Error loading polls:', error);
    }
}

// Render polls
function renderPolls() {
    if (currentPolls.length === 0) {
        pollsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No polls yet. Create the first one!</p>
            </div>
        `;
        pollCount.textContent = '0 polls';
        return;
    }

    pollCount.textContent = `${currentPolls.length} poll${currentPolls.length !== 1 ? 's' : ''}`;
    
    pollsContainer.innerHTML = currentPolls.map(poll => {
        const hasVoted = userVotedPolls.has(poll.id);
        return `
            <div class="poll-card" data-poll-id="${poll.id}">
                <div class="poll-header">
                    <h3 class="poll-question">${escapeHtml(poll.question)}</h3>
                    <button class="delete-btn" onclick="deletePoll('${poll.id}')" title="Delete poll">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="poll-options">
                    ${poll.options.map((option, index) => {
                        const result = poll.results[index];
                        const percentage = parseFloat(result.percentage);
                        return `
                            <div class="option-item">
                                <button 
                                    class="vote-btn ${hasVoted ? 'voted' : ''}"
                                    onclick="voteOnPoll('${poll.id}', ${index})"
                                    ${hasVoted ? 'disabled' : ''}
                                >
                                    <div class="progress-bar" style="width: ${hasVoted ? percentage : 0}%"></div>
                                    <div class="vote-content">
                                        <span>${escapeHtml(option.text)}</span>
                                        ${hasVoted ? `
                                            <span class="vote-stats">
                                                <span class="vote-percentage">${percentage}%</span>
                                                <span class="vote-count">(${result.votes} vote${result.votes !== 1 ? 's' : ''})</span>
                                            </span>
                                        ` : ''}
                                    </div>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="poll-footer">
                    <div class="total-votes">
                        <i class="fas fa-users"></i>
                        <span>${poll.totalVotes} total vote${poll.totalVotes !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="poll-date">
                        ${new Date(poll.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Create poll
async function handleCreatePoll(e) {
    e.preventDefault();
    
    const question = document.getElementById('question').value.trim();
    const optionInputs = document.querySelectorAll('.option-field');
    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(opt => opt !== '');

    // Validation
    if (!question) {
        showToast('Please enter a question', 'error');
        return;
    }

    if (options.length < 2 || options.length > 4) {
        showToast('You need between 2 and 4 options', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/polls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question, options })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Poll created successfully! 🎉');
            createPollForm.reset();
            resetOptions();
            loadPolls();
        } else {
            showToast(data.error || 'Failed to create poll', 'error');
        }
    } catch (error) {
        showToast('Failed to create poll', 'error');
        console.error('Error creating poll:', error);
    }
}

// Vote on poll
async function voteOnPoll(pollId, optionIndex) {
    if (userVotedPolls.has(pollId)) {
        showToast('You have already voted on this poll', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/polls/${pollId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ optionIndex })
        });

        const data = await response.json();

        if (data.success) {
            // Track vote locally
            userVotedPolls.add(pollId);
            localStorage.setItem('votedPolls', JSON.stringify([...userVotedPolls]));
            
            showToast('Vote recorded! 📊');
            loadPolls();
        } else {
            showToast(data.error || 'Failed to vote', 'error');
        }
    } catch (error) {
        showToast('Failed to record vote', 'error');
        console.error('Error voting:', error);
    }
}

// Delete poll
async function deletePoll(pollId) {
    if (!confirm('Are you sure you want to delete this poll?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/polls/${pollId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            // Remove from local tracking if present
            userVotedPolls.delete(pollId);
            localStorage.setItem('votedPolls', JSON.stringify([...userVotedPolls]));
            
            showToast('Poll deleted successfully');
            loadPolls();
        } else {
            showToast(data.error || 'Failed to delete poll', 'error');
        }
    } catch (error) {
        showToast('Failed to delete poll', 'error');
        console.error('Error deleting poll:', error);
    }
}

// Add option field
function addOptionField() {
    const optionInputs = document.querySelectorAll('.option-field');
    
    if (optionInputs.length >= 4) {
        showToast('Maximum 4 options allowed', 'error');
        return;
    }

    const newOption = document.createElement('div');
    newOption.className = 'option-input';
    newOption.innerHTML = `
        <input 
            type="text" 
            class="option-field" 
            placeholder="Option ${optionInputs.length + 1}" 
            required
        >
        <button type="button" class="btn-icon remove-option" title="Remove option">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    optionsContainer.appendChild(newOption);
    newOption.querySelector('input').focus();
}

// Remove option field
function handleRemoveOption(e) {
    if (e.target.closest('.remove-option')) {
        const optionInputs = document.querySelectorAll('.option-field');
        
        if (optionInputs.length <= 2) {
            showToast('Minimum 2 options required', 'error');
            return;
        }
        
        const optionInput = e.target.closest('.option-input');
        optionInput.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            optionInput.remove();
        }, 250);
    }
}

// Reset options to default
function resetOptions() {
    optionsContainer.innerHTML = `
        <div class="option-input">
            <input type="text" class="option-field" placeholder="Option 1" required>
            <button type="button" class="btn-icon remove-option" title="Remove option">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="option-input">
            <input type="text" class="option-field" placeholder="Option 2" required>
            <button type="button" class="btn-icon remove-option" title="Remove option">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}