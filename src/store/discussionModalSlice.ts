
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Discussion } from '@/services/api/types';

interface DiscussionModalState {
  isOpen: boolean;
  discussion: Discussion | null;
}

const initialState: DiscussionModalState = {
  isOpen: false,
  discussion: null,
};

export const discussionModalSlice = createSlice({
  name: 'discussionModal',
  initialState,
  reducers: {
    openModal: (state, action: PayloadAction<Discussion>) => {
      state.isOpen = true;
      state.discussion = action.payload;
    },
    closeModal: (state) => {
      state.isOpen = false;
    },
  },
});

export const { openModal, closeModal } = discussionModalSlice.actions;
export default discussionModalSlice.reducer;
