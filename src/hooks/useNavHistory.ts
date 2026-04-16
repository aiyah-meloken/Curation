import { useReducer, useCallback } from 'react';

export type NavLocation = {
  appMode: "articles" | "cards";
  selectedArticleId: string | null;
  selectedAccountId: number | null;
  selectedCardId: string | null;
  cardViewDate: string | null;
  cardViewTab: "aggregated" | "source";
};

type State = { stack: NavLocation[]; cursor: number };
type Action =
  | { type: 'push'; loc: NavLocation }
  | { type: 'back' }
  | { type: 'forward' };

function locEqual(a: NavLocation, b: NavLocation) {
  return (
    a.appMode === b.appMode &&
    a.selectedArticleId === b.selectedArticleId &&
    a.selectedAccountId === b.selectedAccountId &&
    a.selectedCardId === b.selectedCardId &&
    a.cardViewDate === b.cardViewDate &&
    a.cardViewTab === b.cardViewTab
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'push': {
      const current = state.stack[state.cursor];
      if (current && locEqual(current, action.loc)) return state; // deduplicate
      const stack = [...state.stack.slice(0, state.cursor + 1), action.loc];
      return { stack, cursor: stack.length - 1 };
    }
    case 'back':
      return state.cursor > 0 ? { ...state, cursor: state.cursor - 1 } : state;
    case 'forward':
      return state.cursor < state.stack.length - 1
        ? { ...state, cursor: state.cursor + 1 }
        : state;
  }
}

export function useNavHistory(initial: NavLocation) {
  const [state, dispatch] = useReducer(reducer, { stack: [initial], cursor: 0 });

  const canBack = state.cursor > 0;
  const canForward = state.cursor < state.stack.length - 1;

  const push = useCallback((loc: NavLocation) => dispatch({ type: 'push', loc }), []);

  const back = useCallback((): NavLocation | null => {
    if (state.cursor === 0) return null;
    dispatch({ type: 'back' });
    return state.stack[state.cursor - 1];
  }, [state]);

  const forward = useCallback((): NavLocation | null => {
    if (state.cursor >= state.stack.length - 1) return null;
    dispatch({ type: 'forward' });
    return state.stack[state.cursor + 1];
  }, [state]);

  return { push, back, forward, canBack, canForward };
}
