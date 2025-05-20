
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Discussion } from '@/services/api/types';
import { api, fetchDiscussions as fetchDiscussionsApi } from '@/services/api/endpoints';

interface DiscussionsState {
  discussions: Discussion[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  selectedDiscussion: Discussion | null;
}

const initialState: DiscussionsState = {
  discussions: [],
  loading: false,
  error: null,
  lastFetched: null,
  selectedDiscussion: null,
};

// Only fetch if data is stale (older than 5 minutes)
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

export const fetchDiscussions = createAsyncThunk(
  'discussions/fetch',
  async (_, { getState }) => {
    const { discussions } = getState() as { discussions: DiscussionsState };
    const now = Date.now();
    
    // If we have cached data that's still fresh, use it
    if (discussions.lastFetched && now - discussions.lastFetched < CACHE_TIME) {
      return discussions.discussions;
    }
    
    // Otherwise fetch new data
    return await fetchDiscussionsApi();
  }
);

// Fetch a single discussion by ID
export const fetchDiscussionById = createAsyncThunk(
  'discussions/fetchById',
  async (discussionId: string, { getState, dispatch }) => {
    const { discussions } = getState() as { discussions: DiscussionsState };
    
    // First try to find the discussion in the existing list
    const existingDiscussion = discussions.discussions.find(d => d.id === discussionId);
    
    if (existingDiscussion) {
      return existingDiscussion;
    }
    
    // If not found or cache is stale, fetch from API
    const fetchedDiscussion = await api.discussions.getById(discussionId);
    const fetchedDiscussion = await api.discussions.getById(discussionId);
    
    // If the discussions list isn't populated yet, also fetch all discussions
    if (discussions.discussions.length === 0) {
      dispatch(fetchDiscussions());
    }
    
    return fetchedDiscussion;
  }
);

export const discussionsSlice = createSlice({
  name: 'discussions',
  initialState,
  reducers: {
    setSelectedDiscussion: (state, action: PayloadAction<Discussion | null>) => {
      state.selectedDiscussion = action.payload;
    },
    clearDiscussionCache: (state) => {
      state.lastFetched = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiscussions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDiscussions.fulfilled, (state, action: PayloadAction<Discussion[]>) => {
        state.loading = false;
        state.discussions = action.payload;
        state.lastFetched = Date.now();
      })
      .addCase(fetchDiscussions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch discussions';
      })
      .addCase(fetchDiscussionById.fulfilled, (state, action: PayloadAction<Discussion>) => {
        // Update the discussion in the list if it exists
        const index = state.discussions.findIndex(d => d.id === action.payload.id);
        if (index >= 0) {
          state.discussions[index] = action.payload;
        } else {
          // Otherwise add it to the list
          state.discussions.push(action.payload);
        }
        // Also set as selected discussion
        state.selectedDiscussion = action.payload;
      });
  },
});

export const { setSelectedDiscussion, clearDiscussionCache } = discussionsSlice.actions;

export default discussionsSlice.reducer;
