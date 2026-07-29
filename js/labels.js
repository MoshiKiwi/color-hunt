export const DIFFICULTY_LABELS = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' };
export const CADENCE_LABELS = { weekly: 'Hebdomadaire', monthly: 'Mensuel' };

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function difficultyBadge(difficulty) {
  return `<span class="difficulty-badge difficulty-${difficulty}">${DIFFICULTY_LABELS[difficulty] || difficulty}</span>`;
}
