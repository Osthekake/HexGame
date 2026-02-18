const NICKNAME_KEY = 'hexgame_nickname';

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) || '';
}

export function setNickname(name: string): void {
  localStorage.setItem(NICKNAME_KEY, name);
}
