import { padNumber } from '../utils/helpers.js';

class Leaderboard {
  constructor() {
    this.storageKey = 'fruitslash_leaderboard';
    this.defaultScores = [];
    
    // Auto-clean existing placeholder data from localStorage
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const scores = JSON.parse(stored);
        const hasPlaceholders = scores.some(s => s.name === 'NINJA_MASTER');
        if (hasPlaceholders) {
          localStorage.removeItem(this.storageKey);
        }
      } catch (e) {}
    }
  }

  getScores() {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      // Initialize with default high scores
      this.saveScores(this.defaultScores);
      return this.defaultScores;
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Corrupt leaderboard data, resetting", e);
      return this.defaultScores;
    }
  }

  saveScores(scores) {
    localStorage.setItem(this.storageKey, JSON.stringify(scores));
  }

  checkHighScore(score) {
    const scores = this.getScores();
    if (scores.length < 20) return true;
    return score > scores[scores.length - 1].score;
  }

  addScore(name, score, accuracy) {
    const scores = this.getScores();
    const cleanName = name.trim().toUpperCase().slice(0, 15) || 'SLASHER';
    
    // Format current date
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${padNumber(d.getMonth() + 1, 2)}-${padNumber(d.getDate(), 2)} ${padNumber(d.getHours(), 2)}:${padNumber(d.getMinutes(), 2)}`;

    scores.push({ name: cleanName, score, accuracy, date: dateStr });
    
    // Sort descending
    scores.sort((a, b) => b.score - a.score);
    
    // Keep top 20
    const topScores = scores.slice(0, 20);
    
    this.saveScores(topScores);
    return topScores;
  }

  renderLeaderboard() {
    const scores = this.getScores();
    
    // 1st, 2nd, 3rd elements
    const podiumNames = [
      document.getElementById('podium-name-1'),
      document.getElementById('podium-name-2'),
      document.getElementById('podium-name-3')
    ];
    
    const podiumScores = [
      document.getElementById('podium-score-1'),
      document.getElementById('podium-score-2'),
      document.getElementById('podium-score-3')
    ];

    // Populate top 3 podium
    for (let i = 0; i < 3; i++) {
      const pName = podiumNames[i];
      const pScore = podiumScores[i];
      
      // Index translation: 0 is 1st, 1 is 2nd, 2 is 3rd
      // The array order corresponds to (1st, 2nd, 3rd)
      const data = scores[i];
      if (data) {
        pName.textContent = data.name;
        pScore.textContent = data.score.toLocaleString();
      } else {
        pName.textContent = '---';
        pScore.textContent = '0';
      }
    }

    // Populate table rows for ranks 4 to 20
    const tbody = document.getElementById('leaderboard-tbody');
    tbody.innerHTML = '';

    scores.forEach((entry, idx) => {
      const rank = idx + 1;
      const tr = document.createElement('tr');

      // Rank styling
      let rankClass = '';
      let rankIcon = rank.toString();
      if (rank === 1) {
        rankClass = 'rank-gold';
        rankIcon = '🥇';
      } else if (rank === 2) {
        rankClass = 'rank-silver';
        rankIcon = '🥈';
      } else if (rank === 3) {
        rankClass = 'rank-bronze';
        rankIcon = '🥉';
      }

      tr.innerHTML = `
        <td class="rank-cell ${rankClass}">${rankIcon}</td>
        <td style="font-weight: 600;">${entry.name}</td>
        <td class="score-cell">${entry.score.toLocaleString()}</td>
        <td>${entry.accuracy}%</td>
        <td style="color: var(--color-text-muted); font-size: 11px;">${entry.date}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

const leaderboard = new Leaderboard();
export default leaderboard;
