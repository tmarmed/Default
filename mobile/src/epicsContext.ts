import { createContext, useContext } from 'react';
import type { Epic } from './types';

/** Epics connues, par id : partagées par la liste, le formulaire et la roadmap. */
export const EpicsContext = createContext<Map<string, Epic>>(new Map());

export const useEpics = () => useContext(EpicsContext);
