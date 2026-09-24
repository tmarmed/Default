import type { ItemType, Priorite } from './types';

export const colors = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#1B2330',
  muted: '#6B7686',
  border: '#E1E6EE',
  primary: '#1A73E8',
  danger: '#D93025',
  success: '#188038',
  warning: '#E37400',
};

export const typeColors: Record<ItemType, string> = {
  tache: '#1A73E8',
  'rendez-vous': '#E37400',
  appel: '#00897B',
  demarche: '#795548',
  mission: '#8E24AA',
  story: '#188038',
  exploration: '#C2185B',
  bug: '#D93025',
};

export const prioriteColors: Record<Priorite, string> = {
  basse: '#9AA3AF',
  normale: '#1A73E8',
  haute: '#D93025',
};
