
import { configureStore } from '@reduxjs/toolkit';
import discussionModalReducer from './discussionModalSlice';
import discussionsReducer from './discussionsSlice';

export const store = configureStore({
  reducer: {
    discussionModal: discussionModalReducer,
    discussions: discussionsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
