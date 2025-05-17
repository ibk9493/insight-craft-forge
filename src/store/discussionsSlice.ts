import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Discussion } from '@/services/api/types';
import { fetchDiscussions as fetchDiscussionsApi } from '@/services/api/endpoints';

interface DiscussionsState {
  discussions: Discussion[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: DiscussionsState = {
  discussions: [],
  loading: false,
  error: null,
  lastFetched: null,
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

export const discussionsSlice = createSlice({
  name: 'discussions',
  initialState,
  reducers: {},
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
      });
  },
});

export default discussionsSlice.reducer;
