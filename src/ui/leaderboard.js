import { padNumber } from '../utils/helpers.js';

class Leaderboard {
  constructor() {
    this.storageKey = 'fruitslash_leaderboard';
    this.defaultScores = [
      { name: 'HAYABUSA', score: 12450, accuracy: 96, date: '2026-11-10 14:20' },
      { name: 'KATANA_99', score: 9800, accuracy: 92, date: '2026-11-12 18:45' },
      { name: 'SHADOW_SLICE', score: 7650, accuracy: 89, date: '2026-11-14 11:30' }
    ];
    
    // Auto-clean any corrupt or obsolete data
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
      this.saveScores(this.defaultScores);
    }
  }

  getScores() {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) {
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
    
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${padNumber(d.getMonth() + 1, 2)}-${padNumber(d.getDate(), 2)} ${padNumber(d.getHours(), 2)}:${padNumber(d.getMinutes(), 2)}`;

    scores.push({ name: cleanName, score, accuracy, date: dateStr });
    scores.sort((a, b) => b.score - a.score);
    
    const topScores = scores.slice(0, 20);
    this.saveScores(topScores);
    return topScores;
  }

  renderLeaderboard() {
    const scores = this.getScores();
    
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
      if (!pName || !pScore) continue;

      const data = scores[i];
      if (data) {
        pName.textContent = data.name;
        pScore.textContent = data.score.toLocaleString();
      } else {
        pName.textContent = '---';
        pScore.textContent = '0';
      }
    }

    // Populate table rows
    const tbody = document.getElementById('leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    scores.forEach((entry, idx) => {
      const rank = idx + 1;
      const tr = document.createElement('tr');

      let badgeClass = 'badge-standard';
      if (rank === 1) badgeClass = 'badge-gold';
      else if (rank === 2) badgeClass = 'badge-silver';
      else if (rank === 3) badgeClass = 'badge-bronze';

      const rankBadge = `<span class="rank-chip ${badgeClass}">${padNumber(rank, 2)}</span>`;

      tr.innerHTML = `
        <td class="rank-col">${rankBadge}</td>
        <td class="player-col">${entry.name}</td>
        <td class="score-col">${entry.score.toLocaleString()}</td>
        <td class="acc-col">${entry.accuracy}%</td>
        <td class="date-col">${entry.date}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

const leaderboard = new Leaderboard();
export default leaderboard;
